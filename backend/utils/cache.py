import asyncio
import hashlib
import json
import logging
import time
from collections import OrderedDict
from collections.abc import Callable
from functools import wraps
from typing import Any

logger = logging.getLogger(__name__)


class AsyncLRUCache:
    """A tiny async-safe LRU cache with TTL.

    Not distributed — in-memory only. Suitable for caching search results
    with short TTL on a single backend instance.
    """

    def __init__(self, maxsize: int = 500, ttl: int = 60):
        self.maxsize = maxsize
        self.ttl = ttl
        self._data: OrderedDict[str, tuple[Any, float | None]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            item = self._data.get(key)
            if not item:
                return None
            value, expires = item
            if expires is not None and expires < time.time():
                # expired
                del self._data[key]
                return None
            # move to end (most recently used)
            self._data.move_to_end(key)
            return value

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        async with self._lock:
            # Use provided ttl, or fall back to instance default
            effective_ttl = ttl if ttl is not None else self.ttl
            expires = time.time() + effective_ttl if effective_ttl else None
            self._data[key] = (value, expires)
            self._data.move_to_end(key)
            # evict oldest
            while len(self._data) > self.maxsize:
                self._data.popitem(last=False)

    async def clear(self) -> None:
        async with self._lock:
            self._data.clear()


# Global cache for decorated queries
_query_cache = AsyncLRUCache(maxsize=100, ttl=300)


def cached_query(ttl: int = 300, maxsize: int = 100, cache_instance: AsyncLRUCache | None = None):
    """Decorator for caching async repository/service query methods

    Args:
        ttl: Time-to-live in seconds (default: 300s/5min)
        maxsize: Maximum cache entries (default: 100)
        cache_instance: Custom cache instance to use (default: global cache)

    Usage:
        @cached_query(ttl=600)
        async def get_aggregated_stats(self) -> Dict[str, float]:
            ...

        @cached_query(ttl=300, cache_instance=custom_cache)
        async def count(self) -> int:
            ...
    """
    cache = cache_instance or _query_cache

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Create cache key from function name + args + kwargs
            # Skip 'self' argument (args[0]) for instance methods
            cache_args = args[1:] if args and hasattr(args[0], "__dict__") else args

            try:
                key_data = {"func": func.__name__, "args": str(cache_args), "kwargs": sorted(kwargs.items())}
                key = hashlib.md5(json.dumps(key_data, sort_keys=True, default=str).encode()).hexdigest()
            except Exception as e:
                logger.warning(f"Failed to create cache key for {func.__name__}: {e}")
                # Fallback: skip cache if key creation fails
                return await func(*args, **kwargs)

            # Try cache first
            cached = await cache.get(key)
            if cached is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached

            # Compute and cache
            result = await func(*args, **kwargs)
            await cache.set(key, result, ttl=ttl)
            logger.debug(f"Cached result for {func.__name__} with TTL {ttl}s")

            return result

        return wrapper

    return decorator
