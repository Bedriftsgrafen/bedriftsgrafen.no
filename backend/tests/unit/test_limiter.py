"""Unit tests for limiter configuration."""

import os
from unittest.mock import patch


class TestLimiterConfiguration:
    """Test rate limiter storage configuration."""

    def test_limiter_uses_memory_when_no_redis_host(self):
        """Test that limiter uses in-memory storage when REDIS_HOST is not set."""
        env_vars = {
            "REDIS_HOST": "",
            "REDIS_PORT": "6379",
            "REDIS_PASSWORD": "",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            # Force reimport to pick up new env vars
            import importlib
            import limiter as limiter_module

            importlib.reload(limiter_module)

            # storage_uri should be memory://
            assert limiter_module.storage_uri == "memory://"

    def test_limiter_uses_redis_when_host_set(self):
        """Test that limiter uses Redis storage when REDIS_HOST is set."""
        env_vars = {
            "REDIS_HOST": "redis-host",
            "REDIS_PORT": "6380",
            "REDIS_PASSWORD": "",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            import importlib
            import limiter as limiter_module

            importlib.reload(limiter_module)

            assert limiter_module.storage_uri == "redis://redis-host:6380/1"

    def test_limiter_includes_password_in_uri(self):
        """Test that limiter includes password in Redis URI when set."""
        env_vars = {
            "REDIS_HOST": "redis-host",
            "REDIS_PORT": "6379",
            "REDIS_PASSWORD": "secret123",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            import importlib
            import limiter as limiter_module

            importlib.reload(limiter_module)

            assert limiter_module.storage_uri == "redis://:secret123@redis-host:6379/1"
