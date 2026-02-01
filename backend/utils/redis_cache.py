"""
Redis-backed cache with same interface as AsyncLRUCache.

Uses SCAN (not KEYS) for production safety and handles Redis failures gracefully.
"""

import json
import logging
from typing import Any

from utils.redis_client import get_redis

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis-backed cache with graceful fallback on errors."""

    def __init__(self, prefix: str = "cache", ttl: int = 300):
        """
        Initialize Redis cache.

        Args:
            prefix: Key prefix to namespace cache entries
            ttl: Default TTL in seconds (default: 5 minutes)
        """
        self.prefix = prefix
        self.ttl = ttl

    def _key(self, key: str) -> str:
        return f"{self.prefix}:{key}"

    async def get(self, key: str) -> Any | None:
        """Get value from cache, returns None on miss or error."""
        try:
            data = await get_redis().get(self._key(key))
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"Redis get failed for {self.prefix}: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set value in cache with TTL. Silently fails on error."""
        try:
            await get_redis().setex(
                self._key(key),
                ttl or self.ttl,
                json.dumps(value, default=str),
            )
        except Exception as e:
            logger.warning(f"Redis set failed for {self.prefix}: {e}")

    async def clear(self) -> None:
        """Clear all keys with this prefix using SCAN (non-blocking)."""
        try:
            redis = get_redis()
            cursor = 0
            deleted = 0
            while True:
                cursor, keys = await redis.scan(cursor, match=f"{self.prefix}:*", count=100)
                if keys:
                    await redis.delete(*keys)
                    deleted += len(keys)
                if cursor == 0:
                    break
            if deleted:
                logger.info(f"Cleared {deleted} keys with prefix '{self.prefix}'")
        except Exception as e:
            logger.warning(f"Redis clear failed for {self.prefix}: {e}")
