import asyncio

import pytest

from services import subunit_refresh_lock
from services.subunit_refresh_lock import (
    SubunitRefreshLock,
    SubunitRefreshLockConfig,
    SubunitRefreshLockError,
    release_subunit_refresh_lock,
    renew_subunit_refresh_lock,
    try_acquire_subunit_refresh_lock,
)

CONFIG = SubunitRefreshLockConfig(
    ttl_seconds=30,
    wait_timeout_seconds=1.0,
    poll_interval_seconds=0.01,
    redis_timeout_seconds=0.05,
)


class FakeRedis:
    def __init__(self, *, set_result=True):
        self.set_result = set_result
        self.set_calls = []
        self.eval_calls = []

    async def set(self, *args, **kwargs):
        self.set_calls.append((args, kwargs))
        return self.set_result

    async def eval(self, *args):
        self.eval_calls.append(args)
        return 1


@pytest.mark.asyncio
async def test_try_acquire_subunit_refresh_lock_returns_token(monkeypatch):
    redis = FakeRedis(set_result=True)
    monkeypatch.setattr(subunit_refresh_lock, "get_redis", lambda: redis)

    lock = await try_acquire_subunit_refresh_lock("123456789", config=CONFIG)

    assert lock is not None
    assert lock.key == "brreg:subunits:refresh:123456789"
    args, kwargs = redis.set_calls[0]
    assert args[0] == "brreg:subunits:refresh:123456789"
    assert kwargs == {"nx": True, "ex": 30}


@pytest.mark.asyncio
async def test_try_acquire_subunit_refresh_lock_returns_none_when_held(monkeypatch):
    redis = FakeRedis(set_result=False)
    monkeypatch.setattr(subunit_refresh_lock, "get_redis", lambda: redis)

    lock = await try_acquire_subunit_refresh_lock("123456789", config=CONFIG)

    assert lock is None


@pytest.mark.asyncio
async def test_try_acquire_subunit_refresh_lock_times_out(monkeypatch):
    class SlowRedis:
        async def set(self, *args, **kwargs):
            await asyncio.sleep(1)
            return True

    monkeypatch.setattr(subunit_refresh_lock, "get_redis", lambda: SlowRedis())

    with pytest.raises(SubunitRefreshLockError):
        await try_acquire_subunit_refresh_lock("123456789", config=CONFIG)


@pytest.mark.asyncio
async def test_release_subunit_refresh_lock_uses_compare_and_delete(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(subunit_refresh_lock, "get_redis", lambda: redis)

    await release_subunit_refresh_lock(
        SubunitRefreshLock(key="brreg:subunits:refresh:123456789", token="test-lock-token"),  # noqa: S106
        config=CONFIG,
    )

    assert redis.eval_calls
    assert redis.eval_calls[0][1:] == (1, "brreg:subunits:refresh:123456789", "test-lock-token")


@pytest.mark.asyncio
async def test_renew_subunit_refresh_lock_uses_compare_and_expire(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(subunit_refresh_lock, "get_redis", lambda: redis)

    await renew_subunit_refresh_lock(
        SubunitRefreshLock(key="brreg:subunits:refresh:123456789", token="test-lock-token"),  # noqa: S106
        config=CONFIG,
    )

    assert redis.eval_calls[0][1:] == (1, "brreg:subunits:refresh:123456789", "test-lock-token", 30)


@pytest.mark.asyncio
async def test_renew_rejects_lost_ownership(monkeypatch):
    redis = FakeRedis()

    async def lost(*args):
        return 0

    redis.eval = lost
    monkeypatch.setattr(subunit_refresh_lock, "get_redis", lambda: redis)

    with pytest.raises(SubunitRefreshLockError, match="Lost ownership"):
        await renew_subunit_refresh_lock(
            SubunitRefreshLock(key="brreg:subunits:refresh:123456789", token="old-token"),  # noqa: S106
            config=CONFIG,
        )
