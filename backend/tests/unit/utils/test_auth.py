"""Tests for admin authentication security.

Tests cover:
- Constant-time comparison (timing attack prevention)
- Production enforcement of ADMIN_API_KEY
- Audit logging for security events
- Missing/invalid key handling
"""

import os
import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


class TestVerifyAdminKey:
    """Tests for verify_admin_key dependency."""

    @pytest.mark.asyncio
    async def test_valid_admin_key_grants_access(self):
        """Valid API key should grant access and log success."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "test-secret-key", "ENVIRONMENT": "development"}):
            # Re-import to pick up new env
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            mock_request = MagicMock()
            mock_request.headers = {}
            mock_request.client.host = "127.0.0.1"
            mock_request.url.path = "/admin/import/progress"

            with patch.object(auth_module.logger, "info") as mock_log:
                # Should not raise
                await auth_module.verify_admin_key(request=mock_request, x_admin_key="test-secret-key")

                # Should log successful access
                mock_log.assert_called_once()
                assert "Admin access granted" in mock_log.call_args[0][0]

    @pytest.mark.asyncio
    async def test_invalid_key_returns_403(self):
        """Invalid API key should return 403 and log warning."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "correct-key", "ENVIRONMENT": "development"}):
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            mock_request = MagicMock()
            mock_request.headers = {}
            mock_request.client.host = "192.168.1.100"
            mock_request.url.path = "/admin/import/bulk/start"

            with patch.object(auth_module.logger, "warning") as mock_log:
                with pytest.raises(HTTPException) as exc_info:
                    await auth_module.verify_admin_key(request=mock_request, x_admin_key="wrong-key")

                assert exc_info.value.status_code == 403
                assert "Invalid admin API key" in exc_info.value.detail

                # Should log security warning with IP
                mock_log.assert_called_once()
                log_message = mock_log.call_args[0][0]
                assert "SECURITY" in log_message
                assert "invalid key" in log_message
                assert "192.168.1.100" in log_message

    @pytest.mark.asyncio
    async def test_missing_key_returns_401(self):
        """Missing API key should return 401 and log warning."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "some-key", "ENVIRONMENT": "development"}):
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            mock_request = MagicMock()
            mock_request.headers = {}
            mock_request.client.host = "10.0.0.5"
            mock_request.url.path = "/admin/import/geocode"

            with patch.object(auth_module.logger, "warning") as mock_log:
                with pytest.raises(HTTPException) as exc_info:
                    await auth_module.verify_admin_key(request=mock_request, x_admin_key=None)

                assert exc_info.value.status_code == 401
                assert "Missing X-Admin-Key" in exc_info.value.detail

                # Should log with IP
                mock_log.assert_called_once()
                assert "10.0.0.5" in mock_log.call_args[0][0]

    @pytest.mark.asyncio
    async def test_development_without_key_allows_access_with_warning(self):
        """In development without ADMIN_API_KEY, access is allowed with warning."""
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}, clear=False):
            # Remove ADMIN_API_KEY if present
            env_copy = os.environ.copy()
            env_copy.pop("ADMIN_API_KEY", None)

            with patch.dict(os.environ, env_copy, clear=True):
                import importlib
                import utils.auth as auth_module

                importlib.reload(auth_module)

                mock_request = MagicMock()
                mock_request.headers = {}
                mock_request.client.host = "127.0.0.1"
                mock_request.url.path = "/admin/test"

                with patch.object(auth_module.logger, "warning") as mock_log:
                    # Should not raise
                    await auth_module.verify_admin_key(request=mock_request, x_admin_key=None)

                    # Should log security warning
                    mock_log.assert_called_once()
                    assert "ADMIN_API_KEY not set" in mock_log.call_args[0][0]

    @pytest.mark.asyncio
    async def test_x_forwarded_for_header_used_for_logging(self):
        """Should use X-Forwarded-For header for client IP when behind proxy."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "test-key", "ENVIRONMENT": "development"}):
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            mock_request = MagicMock()
            mock_request.headers = {"X-Forwarded-For": "203.0.113.50, 10.0.0.1"}
            mock_request.client.host = "10.0.0.1"  # Proxy IP
            mock_request.url.path = "/admin/import/progress"

            with patch.object(auth_module.logger, "info") as mock_log:
                await auth_module.verify_admin_key(request=mock_request, x_admin_key="test-key")

                # Should use first IP from X-Forwarded-For (real client)
                log_message = mock_log.call_args[0][0]
                assert "203.0.113.50" in log_message


class TestIsAdmin:
    """Tests for is_admin helper function."""

    def test_is_admin_with_valid_key(self):
        """Should return True for valid admin key."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "valid-key", "ENVIRONMENT": "development"}):
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            assert auth_module.is_admin("valid-key") is True

    def test_is_admin_with_invalid_key(self):
        """Should return False for invalid admin key."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "valid-key", "ENVIRONMENT": "development"}):
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            assert auth_module.is_admin("invalid-key") is False

    def test_is_admin_with_none_key(self):
        """Should return False when key is None."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "valid-key", "ENVIRONMENT": "development"}):
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            assert auth_module.is_admin(None) is False

    def test_is_admin_without_env_key_returns_true(self):
        """Without ADMIN_API_KEY set, should return True (dev mode)."""
        env_copy = os.environ.copy()
        env_copy.pop("ADMIN_API_KEY", None)
        env_copy["ENVIRONMENT"] = "development"

        with patch.dict(os.environ, env_copy, clear=True):
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            assert auth_module.is_admin(None) is True
            assert auth_module.is_admin("any-key") is True


class TestTimingAttackPrevention:
    """Tests to verify constant-time comparison is used."""

    def test_uses_secrets_compare_digest(self):
        """Verify that secrets.compare_digest is used for key comparison."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "test-key", "ENVIRONMENT": "development"}):
            import importlib
            import utils.auth as auth_module

            importlib.reload(auth_module)

            # Verify secrets module is imported and used
            import inspect

            source = inspect.getsource(auth_module.verify_admin_key)
            assert "secrets.compare_digest" in source

            source_is_admin = inspect.getsource(auth_module.is_admin)
            assert "secrets.compare_digest" in source_is_admin


class TestProductionEnforcement:
    """Tests for production security enforcement."""

    def test_production_without_admin_key_raises_error(self):
        """In production, missing ADMIN_API_KEY should raise RuntimeError on import."""
        env_copy = {"ENVIRONMENT": "production"}  # No ADMIN_API_KEY

        with patch.dict(os.environ, env_copy, clear=True):
            import importlib
            import utils.auth as auth_module

            with pytest.raises(RuntimeError) as exc_info:
                importlib.reload(auth_module)

            assert "ADMIN_API_KEY" in str(exc_info.value)
            assert "production" in str(exc_info.value)

    def test_production_with_admin_key_loads_normally(self):
        """In production with ADMIN_API_KEY set, module should load normally."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "ADMIN_API_KEY": "prod-secret-key"}, clear=False):
            import importlib
            import utils.auth as auth_module

            # Should not raise
            importlib.reload(auth_module)

            assert auth_module.ADMIN_API_KEY == "prod-secret-key"
