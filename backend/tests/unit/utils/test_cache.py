import pytest
import asyncio
from utils.cache import AsyncLRUCache, cached_query


@pytest.mark.asyncio
async def test_lru_cache_set_get():
    cache = AsyncLRUCache(maxsize=10, ttl=60)
    await cache.set("key1", "value1")

    val = await cache.get("key1")
    assert val == "value1"


@pytest.mark.asyncio
async def test_lru_cache_expiry():
    # Cache with 0.01 sec TTL
    cache = AsyncLRUCache(maxsize=10, ttl=0.01)
    await cache.set("key1", "value1")

    val = await cache.get("key1")
    assert val == "value1"

    await asyncio.sleep(0.02)
    val = await cache.get("key1")
    assert val is None


@pytest.mark.asyncio
async def test_lru_eviction():
    cache = AsyncLRUCache(maxsize=2, ttl=60)
    await cache.set("k1", "v1")
    await cache.set("k2", "v2")

    # Access k1 to make it most recently used
    await cache.get("k1")

    # Add k3, should evict k2 (LRU)
    await cache.set("k3", "v3")

    assert await cache.get("k2") is None
    assert await cache.get("k1") == "v1"
    assert await cache.get("k3") == "v3"


@pytest.mark.asyncio
async def test_cached_query_decorator():
    # Helper class to simulate service method
    class Service:
        call_count = 0

        # Use a new cache instance for this test to avoid global state issues
        _test_cache = AsyncLRUCache(maxsize=10, ttl=60)

        @cached_query(ttl=60, cache_instance=_test_cache)
        async def get_data(self, arg):
            self.call_count += 1
            return f"result-{arg}"

    svc = Service()
    res1 = await svc.get_data("foo")
    assert res1 == "result-foo"
    assert svc.call_count == 1

    # Second call should hit cache
    res2 = await svc.get_data("foo")
    assert res2 == "result-foo"
    assert svc.call_count == 1

    # Different arg should call function
    res3 = await svc.get_data("bar")
    assert res3 == "result-bar"
    assert svc.call_count == 2
