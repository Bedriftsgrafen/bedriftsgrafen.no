"""Redis-backed single-flight lock for Brreg subunit refreshes."""

from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import Awaitable
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from typing import Any, cast

from redis.exceptions import RedisError

from utils.redis_client import get_redis

_LOCK_KEY_PREFIX = "brreg:subunits:refresh"

_RELEASE_LOCK_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
end
return 0
"""

_RENEW_LOCK_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("EXPIRE", KEYS[1], ARGV[2])
end
return 0
"""


class SubunitRefreshLockError(Exception):
    """Raised when the subunit refresh lock cannot be enforced safely."""


@dataclass(frozen=True)
class SubunitRefreshLockConfig:
    ttl_seconds: int
    wait_timeout_seconds: float
    poll_interval_seconds: float
    redis_timeout_seconds: float


@dataclass(frozen=True)
class SubunitRefreshLock:
    key: str
    token: str


def _int_from_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _float_from_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def load_subunit_refresh_lock_config() -> SubunitRefreshLockConfig:
    """Load app-internal lock timing config."""
    return SubunitRefreshLockConfig(
        ttl_seconds=max(1, _int_from_env("SUBUNIT_REFRESH_LOCK_TTL_SECONDS", 120)),
        wait_timeout_seconds=max(0.0, _float_from_env("SUBUNIT_REFRESH_LOCK_WAIT_TIMEOUT_SECONDS", 30.0)),
        poll_interval_seconds=max(0.01, _float_from_env("SUBUNIT_REFRESH_LOCK_POLL_INTERVAL_SECONDS", 0.1)),
        redis_timeout_seconds=max(0.01, _float_from_env("SUBUNIT_REFRESH_LOCK_REDIS_TIMEOUT_SECONDS", 1.0)),
    )


def _lock_key(parent_orgnr: str) -> str:
    return f"{_LOCK_KEY_PREFIX}:{parent_orgnr}"


async def try_acquire_subunit_refresh_lock(
    parent_orgnr: str,
    *,
    config: SubunitRefreshLockConfig | None = None,
) -> SubunitRefreshLock | None:
    """Try to acquire the per-parent refresh lock.

    Returns a lock token for the caller that should perform the refresh, or
    None if another worker is already refreshing the same parent.
    """
    config = config or load_subunit_refresh_lock_config()
    key = _lock_key(parent_orgnr)
    token = uuid.uuid4().hex
    redis = get_redis()
    try:
        set_result = cast(
            Awaitable[Any],
            redis.set(key, token, nx=True, ex=config.ttl_seconds),
        )
        acquired = await asyncio.wait_for(set_result, timeout=config.redis_timeout_seconds)
    except TimeoutError as exc:
        raise SubunitRefreshLockError("Timed out acquiring subunit refresh lock") from exc
    except RedisError as exc:
        raise SubunitRefreshLockError("Redis unavailable for subunit refresh lock") from exc
    except Exception as exc:
        raise SubunitRefreshLockError("Failed to acquire subunit refresh lock") from exc

    return SubunitRefreshLock(key=key, token=token) if acquired else None


async def release_subunit_refresh_lock(
    lock: SubunitRefreshLock,
    *,
    config: SubunitRefreshLockConfig | None = None,
) -> None:
    """Release a lock token if it is still owned by this caller."""
    config = config or load_subunit_refresh_lock_config()
    redis = get_redis()
    try:
        eval_result = cast(
            Awaitable[Any],
            redis.eval(_RELEASE_LOCK_SCRIPT, 1, lock.key, lock.token),
        )
        await asyncio.wait_for(eval_result, timeout=config.redis_timeout_seconds)
    except Exception:
        # The lock has a bounded TTL, so release failures are logged by callers
        # only if they need request-level diagnostics.
        return


async def renew_subunit_refresh_lock(
    lock: SubunitRefreshLock,
    *,
    config: SubunitRefreshLockConfig | None = None,
) -> None:
    """Extend a lease only while its ownership token still matches."""
    config = config or load_subunit_refresh_lock_config()
    redis = get_redis()
    try:
        eval_result = cast(
            Awaitable[Any],
            redis.eval(_RENEW_LOCK_SCRIPT, 1, lock.key, lock.token, config.ttl_seconds),
        )
        renewed = await asyncio.wait_for(eval_result, timeout=config.redis_timeout_seconds)
    except TimeoutError as exc:
        raise SubunitRefreshLockError("Timed out renewing subunit refresh lock") from exc
    except RedisError as exc:
        raise SubunitRefreshLockError("Redis unavailable while renewing subunit refresh lock") from exc
    except Exception as exc:
        raise SubunitRefreshLockError("Failed to renew subunit refresh lock") from exc

    if int(renewed) != 1:
        raise SubunitRefreshLockError("Lost ownership of subunit refresh lock")


@asynccontextmanager
async def maintain_subunit_refresh_lock(
    lock: SubunitRefreshLock,
    *,
    config: SubunitRefreshLockConfig | None = None,
):
    """Keep a lock alive and abort the protected task if ownership is lost."""
    config = config or load_subunit_refresh_lock_config()
    owner = asyncio.current_task()
    stopped = asyncio.Event()
    lease_error: SubunitRefreshLockError | None = None
    interval = max(0.05, config.ttl_seconds / 3)

    async def heartbeat() -> None:
        nonlocal lease_error
        while True:
            try:
                await asyncio.wait_for(stopped.wait(), timeout=interval)
                return
            except TimeoutError:
                pass
            try:
                await renew_subunit_refresh_lock(lock, config=config)
            except SubunitRefreshLockError as exc:
                lease_error = exc
                if owner is not None:
                    owner.cancel()
                return

    heartbeat_task = asyncio.create_task(heartbeat(), name=f"renew-{lock.key}")
    try:
        yield
    except asyncio.CancelledError:
        if lease_error is not None:
            raise lease_error from None
        raise
    finally:
        stopped.set()
        heartbeat_task.cancel()
        with suppress(asyncio.CancelledError):
            await heartbeat_task
        await release_subunit_refresh_lock(lock, config=config)

    if lease_error is not None:
        raise lease_error


__all__ = [
    "SubunitRefreshLock",
    "SubunitRefreshLockConfig",
    "SubunitRefreshLockError",
    "load_subunit_refresh_lock_config",
    "maintain_subunit_refresh_lock",
    "release_subunit_refresh_lock",
    "renew_subunit_refresh_lock",
    "try_acquire_subunit_refresh_lock",
]
