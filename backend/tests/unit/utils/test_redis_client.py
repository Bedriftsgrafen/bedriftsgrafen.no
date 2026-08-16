"""Unit tests for the shared async Redis client."""

from unittest.mock import AsyncMock, patch

import pytest

import utils.redis_client as redis_client


@pytest.fixture(autouse=True)
def reset_redis_client():
    redis_client._pool = None
    redis_client._redis = None
    yield
    redis_client._pool = None
    redis_client._redis = None


def test_pool_uses_bounded_socket_timeouts(monkeypatch):
    monkeypatch.setenv("REDIS_HOST", "redis")
    monkeypatch.setenv("REDIS_PORT", "6379")
    monkeypatch.setenv("REDIS_DB", "0")
    monkeypatch.delenv("REDIS_PASSWORD", raising=False)
    monkeypatch.delenv("REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("REDIS_SOCKET_TIMEOUT_SECONDS", raising=False)

    with patch.object(redis_client, "ConnectionPool") as pool_class:
        pool = redis_client._get_pool()

    assert pool is pool_class.return_value
    pool_class.assert_called_once_with(
        host="redis",
        port=6379,
        db=0,
        password=None,
        decode_responses=True,
        max_connections=20,
        socket_connect_timeout=1.0,
        socket_timeout=1.0,
    )


def test_pool_uses_configured_socket_timeouts(monkeypatch):
    monkeypatch.setenv("REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS", "0.25")
    monkeypatch.setenv("REDIS_SOCKET_TIMEOUT_SECONDS", "0.75")

    with patch.object(redis_client, "ConnectionPool") as pool_class:
        redis_client._get_pool()

    assert pool_class.call_args.kwargs["socket_connect_timeout"] == 0.25
    assert pool_class.call_args.kwargs["socket_timeout"] == 0.75


@pytest.mark.parametrize("name", ["REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS", "REDIS_SOCKET_TIMEOUT_SECONDS"])
@pytest.mark.parametrize("value", ["0", "-1", "nan", "inf", "invalid"])
def test_pool_rejects_invalid_socket_timeout(monkeypatch, name, value):
    monkeypatch.setenv(name, value)

    with pytest.raises(ValueError, match=rf"{name} must be a finite number greater than zero"):
        redis_client._get_pool()


@pytest.mark.asyncio
async def test_health_check_returns_false_on_timeout():
    client = AsyncMock()
    client.ping = AsyncMock(side_effect=TimeoutError)

    with patch.object(redis_client, "get_redis", return_value=client):
        assert await redis_client.check_redis_health() is False
