"""
Async Redis client singleton with graceful fallback.

Uses a single ConnectionPool for efficiency. The pool handles connection health
automatically, so we don't ping on every request (only in health checks).
"""

import logging
import math
import os

from redis.asyncio import ConnectionPool, Redis

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None
_redis: Redis | None = None

_DEFAULT_SOCKET_CONNECT_TIMEOUT_SECONDS = 1.0
_DEFAULT_SOCKET_TIMEOUT_SECONDS = 1.0


def _positive_float_from_env(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        value = float(raw_value)
    except ValueError:
        raise ValueError(f"{name} must be a finite number greater than zero") from None

    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name} must be a finite number greater than zero")
    return value


def load_redis_socket_timeouts() -> tuple[float, float]:
    """Load bounded Redis connect and command timeouts from the environment."""
    return (
        _positive_float_from_env("REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS", _DEFAULT_SOCKET_CONNECT_TIMEOUT_SECONDS),
        _positive_float_from_env("REDIS_SOCKET_TIMEOUT_SECONDS", _DEFAULT_SOCKET_TIMEOUT_SECONDS),
    )


def _get_pool() -> ConnectionPool:
    """Lazily create connection pool."""
    global _pool
    if _pool is None:
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", "6379"))
        redis_db = int(os.getenv("REDIS_DB", "0"))
        redis_password = os.getenv("REDIS_PASSWORD") or None
        socket_connect_timeout, socket_timeout = load_redis_socket_timeouts()

        _pool = ConnectionPool(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            password=redis_password,
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=socket_connect_timeout,
            socket_timeout=socket_timeout,
        )
        logger.info(
            "Redis pool created for %s:%s (connect_timeout=%.2fs, socket_timeout=%.2fs)",
            redis_host,
            redis_port,
            socket_connect_timeout,
            socket_timeout,
        )
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
        # Use await on the coroutine directly.
        # Mypy sometimes struggles with redis-py async types.
        await get_redis().ping()  # type: ignore[misc]
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
