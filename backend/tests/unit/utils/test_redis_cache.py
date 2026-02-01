"""Unit tests for RedisCache class."""

import pytest
from unittest.mock import AsyncMock, patch

from utils.redis_cache import RedisCache


class TestRedisCache:
    """Test RedisCache with mocked Redis client."""

    @pytest.fixture
    def cache(self) -> RedisCache:
        """Create a test cache instance."""
        return RedisCache(prefix="test", ttl=60)

    @pytest.mark.asyncio
    async def test_get_returns_none_on_miss(self, cache: RedisCache):
        """Test that get returns None when key doesn't exist."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        with patch("utils.redis_cache.get_redis", return_value=mock_redis):
            result = await cache.get("nonexistent")

        assert result is None
        mock_redis.get.assert_called_once_with("test:nonexistent")

    @pytest.mark.asyncio
    async def test_get_returns_parsed_json(self, cache: RedisCache):
        """Test that get returns parsed JSON data."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value='{"foo": "bar"}')

        with patch("utils.redis_cache.get_redis", return_value=mock_redis):
            result = await cache.get("mykey")

        assert result == {"foo": "bar"}

    @pytest.mark.asyncio
    async def test_get_returns_none_on_error(self, cache: RedisCache):
        """Test that get gracefully handles Redis errors."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Connection lost"))

        with patch("utils.redis_cache.get_redis", return_value=mock_redis):
            result = await cache.get("mykey")

        assert result is None

    @pytest.mark.asyncio
    async def test_set_uses_correct_ttl(self, cache: RedisCache):
        """Test that set uses correct TTL."""
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()

        with patch("utils.redis_cache.get_redis", return_value=mock_redis):
            await cache.set("mykey", {"data": 123})

        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == "test:mykey"  # Key with prefix
        assert call_args[0][1] == 60  # Default TTL

    @pytest.mark.asyncio
    async def test_set_with_custom_ttl(self, cache: RedisCache):
        """Test that set accepts custom TTL."""
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()

        with patch("utils.redis_cache.get_redis", return_value=mock_redis):
            await cache.set("mykey", "value", ttl=120)

        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == 120  # Custom TTL

    @pytest.mark.asyncio
    async def test_set_silently_fails_on_error(self, cache: RedisCache):
        """Test that set doesn't raise on Redis error."""
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock(side_effect=Exception("Connection lost"))

        with patch("utils.redis_cache.get_redis", return_value=mock_redis):
            # Should not raise
            await cache.set("mykey", "value")

    @pytest.mark.asyncio
    async def test_clear_uses_scan(self, cache: RedisCache):
        """Test that clear uses SCAN iterator, not KEYS."""
        mock_redis = AsyncMock()
        # Simulate SCAN returning keys then done
        mock_redis.scan = AsyncMock(
            side_effect=[
                (5, ["test:key1", "test:key2"]),  # First call: cursor 5, some keys
                (0, []),  # Second call: cursor 0, done
            ]
        )
        mock_redis.delete = AsyncMock()

        with patch("utils.redis_cache.get_redis", return_value=mock_redis):
            await cache.clear()

        assert mock_redis.scan.call_count == 2
        mock_redis.delete.assert_called_once_with("test:key1", "test:key2")

    @pytest.mark.asyncio
    async def test_key_prefixing(self, cache: RedisCache):
        """Test that keys are properly prefixed."""
        assert cache._key("foo") == "test:foo"
        assert cache._key("bar/baz") == "test:bar/baz"
