"""
Redis-backed cache with same interface as AsyncLRUCache.

Uses SCAN (not KEYS) for production safety and handles Redis failures gracefully.
Includes a connection-failure circuit breaker: after 10 consecutive failures,
Redis is skipped for 30 seconds and requests are served as cache misses.
"""

import json
import logging
import time
from typing import Any

from utils.redis_client import get_redis

logger = logging.getLogger(__name__)

# Circuit breaker thresholds (module-level, shared across all RedisCache instances)
_REDIS_FAILURE_THRESHOLD = 10
_REDIS_COOLDOWN_SECONDS = 30

_redis_failure_count: int = 0
_redis_last_failure_time: float = 0.0
_redis_circuit_open_until: float = 0.0
_redis_unavailable_logged: bool = False


def _is_redis_circuit_open() -> bool:
    """Return True if the Redis circuit breaker is open."""
    global _redis_circuit_open_until
    now = time.monotonic()
    if _redis_circuit_open_until > 0 and now < _redis_circuit_open_until:
        return True
    if _redis_circuit_open_until > 0 and now >= _redis_circuit_open_until:
        _redis_circuit_open_until = 0.0
    return False


def _record_redis_failure() -> None:
    """Track a Redis failure; open the circuit after threshold is reached."""
    global _redis_failure_count, _redis_last_failure_time, _redis_circuit_open_until, _redis_unavailable_logged
    now = time.monotonic()
    _redis_failure_count += 1
    _redis_last_failure_time = now
    if _redis_failure_count >= _REDIS_FAILURE_THRESHOLD and _redis_circuit_open_until == 0.0:
        _redis_circuit_open_until = now + _REDIS_COOLDOWN_SECONDS
        if not _redis_unavailable_logged:
            logger.warning(
                "redis.unavailable — %d consecutive failures; skipping Redis for %ds",
                _redis_failure_count,
                _REDIS_COOLDOWN_SECONDS,
            )
            _redis_unavailable_logged = True


def _record_redis_success() -> None:
    """Reset the circuit breaker after a successful Redis operation."""
    global _redis_failure_count, _redis_circuit_open_until, _redis_unavailable_logged
    if _redis_failure_count > 0 or _redis_circuit_open_until > 0:
        logger.info("redis.recovered")
        _redis_unavailable_logged = False
    _redis_failure_count = 0
    _redis_circuit_open_until = 0.0


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
        if _is_redis_circuit_open():
            return None
        try:
            data = await get_redis().get(self._key(key))
            if data:
                _record_redis_success()
                return json.loads(data)
            _record_redis_success()
            return None
        except Exception as e:
            _record_redis_failure()
            logger.debug("Redis get failed for %s: %s", self.prefix, e)
            return None

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set value in cache with TTL. Silently fails on error."""
        if _is_redis_circuit_open():
            return
        try:
            await get_redis().setex(
                self._key(key),
                ttl or self.ttl,
                json.dumps(value, default=str),
            )
            _record_redis_success()
        except Exception as e:
            _record_redis_failure()
            logger.debug("Redis set failed for %s: %s", self.prefix, e)

    async def clear(self) -> None:
        """Clear all keys with this prefix using SCAN (non-blocking)."""
        if _is_redis_circuit_open():
            return
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
                logger.info("Cleared %d keys with prefix '%s'", deleted, self.prefix)
            _record_redis_success()
        except Exception as e:
            _record_redis_failure()
            logger.debug("Redis clear failed for %s: %s", self.prefix, e)
