"""Redis-backed global egress guard for Brreg HTTP attempts."""

from __future__ import annotations

import asyncio
import math
import os
import time
from collections.abc import Awaitable
from dataclasses import dataclass
from typing import Any, cast

from redis.exceptions import RedisError

from utils.metrics import (
    BRREG_EGRESS_CONFIG,
    BRREG_GUARD_DECISIONS_TOTAL,
    BRREG_GUARD_REDIS_ERRORS_TOTAL,
    BRREG_GUARD_WAIT_SECONDS,
)
from utils.redis_client import get_redis

_BUCKET_KEY = "brreg:egress:global"
_TOKEN_COST = 1.0

_REDIS_BUCKET_SCRIPT = """
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local burst = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now_ms = tonumber(ARGV[4])
local ttl_ms = tonumber(ARGV[5])

local state = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(state[1])
local ts = tonumber(state[2])

if tokens == nil then
    tokens = burst
end
if ts == nil then
    ts = now_ms
end

local elapsed = math.max(0, now_ms - ts)
tokens = math.min(burst, tokens + (elapsed * rate / 1000))

local allowed = 0
local wait_ms = 0
if tokens >= cost then
    tokens = tokens - cost
    allowed = 1
else
    wait_ms = math.ceil((cost - tokens) * 1000 / rate)
end

redis.call("HSET", key, "tokens", tokens, "ts", now_ms)
redis.call("PEXPIRE", key, ttl_ms)

return {allowed, wait_ms}
"""


class BrregEgressGuardError(Exception):
    """Raised when Brreg egress cannot be permitted safely."""

    def __init__(self, message: str, *, retry_after_seconds: float | None = None) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__(message)


@dataclass(frozen=True)
class BrregEgressGuardConfig:
    enabled: bool
    rate_per_second: float | None
    burst: int | None
    wait_timeout_seconds: float
    redis_timeout_seconds: float

    @property
    def configured(self) -> bool:
        return self.rate_per_second is not None and self.burst is not None

    @property
    def ttl_ms(self) -> int:
        if not self.rate_per_second or not self.burst:
            return 1000
        refill_seconds = self.burst / self.rate_per_second
        return max(1000, math.ceil((refill_seconds * 2 + 1) * 1000))


def _flag_from_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _float_from_env(name: str, default: float | None = None) -> float | None:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def _int_from_env(name: str, default: int | None = None) -> int | None:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def load_brreg_egress_guard_config() -> BrregEgressGuardConfig:
    """Load guard config from environment without inventing a production cap."""
    wait_timeout_seconds = cast(float, _float_from_env("BRREG_EGRESS_WAIT_TIMEOUT_SECONDS", 0.0))
    redis_timeout_seconds = cast(float, _float_from_env("BRREG_EGRESS_REDIS_TIMEOUT_SECONDS", 1.0))
    config = BrregEgressGuardConfig(
        enabled=_flag_from_env("BRREG_EGRESS_GUARD_ENABLED", True),
        rate_per_second=_float_from_env("BRREG_EGRESS_RATE_PER_SECOND"),
        burst=_int_from_env("BRREG_EGRESS_BURST"),
        wait_timeout_seconds=wait_timeout_seconds,
        redis_timeout_seconds=redis_timeout_seconds,
    )
    if config.enabled:
        if config.rate_per_second is None or not math.isfinite(config.rate_per_second) or config.rate_per_second <= 0:
            raise ValueError("BRREG_EGRESS_RATE_PER_SECOND must be a finite number greater than zero")
        if config.burst is None or config.burst <= 0:
            raise ValueError("BRREG_EGRESS_BURST must be a positive integer")
    if not math.isfinite(config.wait_timeout_seconds) or config.wait_timeout_seconds < 0:
        raise ValueError("BRREG_EGRESS_WAIT_TIMEOUT_SECONDS must be a finite non-negative number")
    if not math.isfinite(config.redis_timeout_seconds) or config.redis_timeout_seconds <= 0:
        raise ValueError("BRREG_EGRESS_REDIS_TIMEOUT_SECONDS must be a finite number greater than zero")
    BRREG_EGRESS_CONFIG.labels(setting="enabled").set(1 if config.enabled else 0)
    BRREG_EGRESS_CONFIG.labels(setting="rate_per_second").set(config.rate_per_second or 0)
    BRREG_EGRESS_CONFIG.labels(setting="burst").set(config.burst or 0)
    BRREG_EGRESS_CONFIG.labels(setting="wait_timeout_seconds").set(config.wait_timeout_seconds)
    return config


def brreg_traffic_class() -> str:
    explicit = os.getenv("BRREG_EGRESS_TRAFFIC_CLASS")
    if explicit:
        normalized = explicit.strip().lower()
        return normalized if normalized in {"public", "background"} else "unknown"
    return "background" if _flag_from_env("START_SCHEDULER", False) else "public"


def _record_decision(endpoint: str, traffic_class: str, result: str) -> None:
    BRREG_GUARD_DECISIONS_TOTAL.labels(endpoint=endpoint, traffic_class=traffic_class, result=result).inc()


async def _eval_bucket(config: BrregEgressGuardConfig) -> tuple[bool, int]:
    if not config.rate_per_second or not config.burst:
        raise BrregEgressGuardError("Brreg egress guard is not configured")

    redis = get_redis()
    now_ms = int(time.time() * 1000)
    eval_result = cast(
        Awaitable[Any],
        redis.eval(
            _REDIS_BUCKET_SCRIPT,
            1,
            _BUCKET_KEY,
            str(config.rate_per_second),
            str(config.burst),
            str(_TOKEN_COST),
            str(now_ms),
            str(config.ttl_ms),
        ),
    )
    result = await asyncio.wait_for(eval_result, timeout=config.redis_timeout_seconds)
    values = list(result) if isinstance(result, tuple | list) else [result]
    allowed = int(values[0]) == 1
    wait_ms = int(values[1]) if len(values) > 1 else 0
    return allowed, wait_ms


async def acquire_brreg_egress_capacity(
    *,
    endpoint: str,
    traffic_class: str,
    config: BrregEgressGuardConfig | None = None,
) -> None:
    """Acquire one global Brreg egress token or fail closed.

    The token bucket is a single low-cardinality Redis key shared by backend
    and worker containers. Each caller consumes exactly one token immediately
    before an outbound HTTP attempt.
    """
    config = config or load_brreg_egress_guard_config()
    if not config.enabled:
        _record_decision(endpoint, traffic_class, "allowed")
        return

    if not config.configured or not config.rate_per_second or config.rate_per_second <= 0 or not config.burst:
        _record_decision(endpoint, traffic_class, "rejected")
        raise BrregEgressGuardError("Brreg egress guard is enabled but rate/burst are not configured")

    deadline = time.monotonic() + max(0.0, config.wait_timeout_seconds)
    total_wait = 0.0

    while True:
        try:
            allowed, wait_ms = await _eval_bucket(config)
        except TimeoutError as exc:
            _record_decision(endpoint, traffic_class, "rejected")
            BRREG_GUARD_REDIS_ERRORS_TOTAL.labels(operation="acquire", error_type="timeout").inc()
            raise BrregEgressGuardError("Brreg egress guard Redis timeout") from exc
        except RedisError as exc:
            _record_decision(endpoint, traffic_class, "rejected")
            BRREG_GUARD_REDIS_ERRORS_TOTAL.labels(operation="acquire", error_type="redis").inc()
            raise BrregEgressGuardError("Brreg egress guard Redis unavailable") from exc
        except BrregEgressGuardError:
            _record_decision(endpoint, traffic_class, "rejected")
            raise
        except Exception as exc:
            _record_decision(endpoint, traffic_class, "rejected")
            BRREG_GUARD_REDIS_ERRORS_TOTAL.labels(operation="acquire", error_type="redis").inc()
            raise BrregEgressGuardError("Brreg egress guard failed closed") from exc

        if allowed:
            _record_decision(endpoint, traffic_class, "allowed")
            if total_wait > 0:
                BRREG_GUARD_WAIT_SECONDS.labels(endpoint=endpoint, traffic_class=traffic_class).observe(total_wait)
            return

        wait_seconds = max(0.0, wait_ms / 1000)
        remaining = deadline - time.monotonic()
        if wait_seconds <= 0 or wait_seconds > remaining:
            _record_decision(endpoint, traffic_class, "rejected")
            raise BrregEgressGuardError(
                "Brreg egress capacity exhausted",
                retry_after_seconds=wait_seconds if wait_seconds > 0 else None,
            )

        _record_decision(endpoint, traffic_class, "waited")
        await asyncio.sleep(wait_seconds)
        total_wait += wait_seconds


__all__ = [
    "BrregEgressGuardConfig",
    "BrregEgressGuardError",
    "acquire_brreg_egress_capacity",
    "brreg_traffic_class",
    "load_brreg_egress_guard_config",
]
