"""Tests for path traversal security in admin import endpoints.

Tests cover:
- Path traversal attack prevention
- Symlink attack prevention
- Directory whitelist enforcement
- File existence validation
"""

import os
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from limiter import limiter
from main import app
from routers.admin_import import ALLOWED_IMPORT_DIR, verify_admin_key

# Disable rate limiting for tests
limiter.enabled = False


# Override dependency to bypass admin check
async def mock_verify_admin_key():
    pass


app.dependency_overrides[verify_admin_key] = mock_verify_admin_key

client = TestClient(app)


class TestPathTraversalPrevention:
    """Tests for path traversal attack prevention."""

    def test_rejects_path_with_directory_components(self):
        """Should reject file paths containing directory separators."""
        response = client.post(
            "/admin/import/queue/populate",
            json={"from_file": "../etc/passwd"},
        )
        assert response.status_code == 400
        assert "filename only" in response.json()["detail"].lower()

    def test_rejects_absolute_path(self):
        """Should reject absolute file paths."""
        response = client.post(
            "/admin/import/queue/populate",
            json={"from_file": "/etc/passwd"},
        )
        assert response.status_code == 400
        assert "filename only" in response.json()["detail"].lower()

    def test_rejects_dot_dot_slash_attack(self):
        """Should reject classic ../ path traversal."""
        response = client.post(
            "/admin/import/queue/populate",
            json={"from_file": "../../secret.json"},
        )
        assert response.status_code == 400

    def test_rejects_hidden_traversal_with_encoding(self):
        """Should reject paths with hidden directory components."""
        # Path like "subdir/file.json" has a directory component
        response = client.post(
            "/admin/import/queue/populate",
            json={"from_file": "subdir/file.json"},
        )
        assert response.status_code == 400

    def test_rejects_windows_style_path(self):
        """Should reject Windows-style paths with backslashes."""
        # On Linux, Path("..\\..\\config").name returns "..\\..\\config" (no backslash parsing)
        # But the actual security check still passes because this weird filename wouldn't exist
        # This test verifies the endpoint handles such inputs gracefully
        response = client.post(
            "/admin/import/queue/populate",
            json={"from_file": "..\\..\\windows\\system32\\config"},
        )
        # Will return 404 (file not found) since the "filename" doesn't exist
        # On Linux, backslashes are valid in filenames, so Path.name doesn't split on them
        assert response.status_code in (400, 404)  # Either rejected or not found


class TestFileValidation:
    """Tests for file existence and type validation."""

    def test_returns_404_for_nonexistent_file(self):
        """Should return 404 if file doesn't exist in allowed directory."""
        with patch("routers.admin_import.ALLOWED_IMPORT_DIR", Path("/tmp/test_import_dir")):
            # Create temp directory
            os.makedirs("/tmp/test_import_dir", exist_ok=True)

            response = client.post(
                "/admin/import/queue/populate",
                json={"from_file": "nonexistent.json"},
            )
            # The resolved path won't be a file
            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

    @patch("routers.admin_import.BulkImportService")
    def test_accepts_valid_file_in_allowed_directory(self, mock_service_class):
        """Should accept a valid file in the allowed import directory."""
        mock_service = AsyncMock()
        mock_service_class.return_value = mock_service
        mock_service.populate_from_file.return_value = {"added": 5}

        # Create a temp directory and file for testing
        import tempfile

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create test file
            test_file = Path(tmpdir) / "valid_import.json"
            test_file.write_text('{"companies": []}')

            # Patch ALLOWED_IMPORT_DIR to our temp directory
            with patch("routers.admin_import.ALLOWED_IMPORT_DIR", Path(tmpdir).resolve()):
                response = client.post(
                    "/admin/import/queue/populate",
                    json={"from_file": "valid_import.json"},
                )

                assert response.status_code == 200
                # Verify service was called with full resolved path
                mock_service.populate_from_file.assert_called_once()
                called_path = mock_service.populate_from_file.call_args[0][0]
                assert called_path == str(Path(tmpdir) / "valid_import.json")


class TestSymlinkPrevention:
    """Tests for symlink attack prevention."""

    def test_rejects_symlink_files(self):
        """Should reject symlinks that could point outside allowed directory."""
        import tempfile

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a symlink to /etc/passwd
            symlink_path = Path(tmpdir) / "evil_symlink.json"

            try:
                symlink_path.symlink_to("/etc/passwd")
            except OSError:
                pytest.skip("Cannot create symlinks (permission denied)")

            with patch("routers.admin_import.ALLOWED_IMPORT_DIR", Path(tmpdir).resolve()):
                response = client.post(
                    "/admin/import/queue/populate",
                    json={"from_file": "evil_symlink.json"},
                )

                # Should be rejected - either as symlink (400) or path escape (400)
                assert response.status_code == 400
                # The symlink resolves to /etc/passwd, which is outside allowed dir
                # So it's caught by the "path escape" check, not the symlink check
                detail = response.json()["detail"].lower()
                assert "invalid" in detail or "symlink" in detail


class TestSecurityLogging:
    """Tests for security event logging."""

    def test_logs_path_traversal_attempts(self):
        """Should log security warnings for path traversal attempts."""
        with patch("routers.admin_import.logger") as mock_logger:
            response = client.post(
                "/admin/import/queue/populate",
                json={"from_file": "../../../etc/passwd"},
            )

            assert response.status_code == 400

            # Verify security warning was logged
            mock_logger.warning.assert_called()
            log_message = mock_logger.warning.call_args[0][0]
            assert "SECURITY" in log_message
            assert "Path traversal" in log_message


class TestInputValidation:
    """Tests for Pydantic model validation."""

    def test_from_file_max_length_enforced(self):
        """Should enforce max_length on from_file field."""
        # Create a filename longer than 255 characters
        long_filename = "a" * 300 + ".json"

        response = client.post(
            "/admin/import/queue/populate",
            json={"from_file": long_filename},
        )

        # Pydantic should reject before reaching our security code
        assert response.status_code == 422  # Validation error

    def test_batch_name_pattern_enforced(self):
        """Should enforce alphanumeric pattern on batch_name."""
        response = client.post(
            "/admin/import/bulk/start",
            json={"batch_name": "invalid!@#name"},
        )

        assert response.status_code == 422  # Validation error

    def test_priority_range_enforced(self):
        """Should enforce priority range (0-100)."""
        response = client.post(
            "/admin/import/queue/populate",
            json={"orgnr_list": ["123456789"], "priority": 999},
        )

        assert response.status_code == 422  # Validation error

    def test_limit_max_enforced(self):
        """Should enforce max limit on updates endpoint."""
        response = client.post(
            "/admin/import/updates",
            json={"limit": 999999},  # Over 10000 limit
        )

        assert response.status_code == 422  # Validation error


class TestAllowedImportDir:
    """Tests for ALLOWED_IMPORT_DIR configuration."""

    def test_allowed_import_dir_is_resolved(self):
        """ALLOWED_IMPORT_DIR should be an absolute resolved path."""
        assert ALLOWED_IMPORT_DIR.is_absolute()
        # Resolve should not change an already-resolved path
        assert ALLOWED_IMPORT_DIR.resolve() == ALLOWED_IMPORT_DIR

    def test_uses_environment_variable(self):
        """Should use IMPORT_DATA_DIR environment variable if set."""
        with patch.dict(os.environ, {"IMPORT_DATA_DIR": "/custom/import/path"}):
            # Re-import to pick up new env
            import importlib

            admin_import_module = importlib.import_module("routers.admin_import")
            importlib.reload(admin_import_module)

            assert str(admin_import_module.ALLOWED_IMPORT_DIR) == "/custom/import/path"

    def test_defaults_to_app_data(self):
        """Should default to /app/data if IMPORT_DATA_DIR not set."""
        env_copy = os.environ.copy()
        env_copy.pop("IMPORT_DATA_DIR", None)

        with patch.dict(os.environ, env_copy, clear=True):
            import importlib

            admin_import_module = importlib.import_module("routers.admin_import")
            importlib.reload(admin_import_module)

            assert str(admin_import_module.ALLOWED_IMPORT_DIR) == "/app/data"
