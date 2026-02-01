"""
Async Redis client singleton with graceful fallback.

Uses a single ConnectionPool for efficiency. The pool handles connection health
automatically, so we don't ping on every request (only in health checks).
"""

import os
import logging
from redis.asyncio import Redis, ConnectionPool

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None
_redis: Redis | None = None


def _get_pool() -> ConnectionPool:
    """Lazily create connection pool."""
    global _pool
    if _pool is None:
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", "6379"))
        redis_db = int(os.getenv("REDIS_DB", "0"))
        redis_password = os.getenv("REDIS_PASSWORD") or None

        _pool = ConnectionPool(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            password=redis_password,
            decode_responses=True,
            max_connections=20,
        )
        logger.info(f"Redis pool created for {redis_host}:{redis_port}")
    return _pool


def get_redis() -> Redis:
    """Get Redis client (sync, no ping - ConnectionPool handles health)."""
    global _redis
    if _redis is None:
        _redis = Redis(connection_pool=_get_pool())
    return _redis


async def check_redis_health() -> bool:
    """Check Redis connectivity (for health endpoint only)."""
    try:
        await get_redis().ping()
        return True
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        return False


async def close_redis() -> None:
    """Close Redis connection pool."""
    global _pool, _redis
    _redis = None
    if _pool:
        await _pool.disconnect()
        _pool = None
        logger.info("Redis pool closed")
