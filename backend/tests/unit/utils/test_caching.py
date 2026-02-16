"""
Unit tests for HTTP caching utilities.

Tests the consolidated set_http_cache_headers function.
Follows AAA pattern (Arrange - Act - Assert).
"""

from unittest.mock import MagicMock

from utils.caching import set_http_cache_headers


class TestSetHttpCacheHeaders:
    """Tests for set_http_cache_headers function."""

    def test_sets_cache_control_header(self):
        """Should set Cache-Control header with TTL and stale-while-revalidate."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_http_cache_headers(response, etag="test-etag", ttl_seconds=1800, stale_seconds=3600)

        # Assert
        assert "Cache-Control" in response.headers
        assert "max-age=1800" in response.headers["Cache-Control"]
        assert "stale-while-revalidate=3600" in response.headers["Cache-Control"]

    def test_sets_etag_header(self):
        """Should set ETag header with provided value."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_http_cache_headers(response, etag="myquery-20-15")

        # Assert
        assert "ETag" in response.headers
        assert "myquery-20-15" in response.headers["ETag"]

    def test_custom_ttl_values(self):
        """Should use custom TTL and stale values."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_http_cache_headers(response, etag="test", ttl_seconds=60, stale_seconds=120)

        # Assert
        assert "max-age=60" in response.headers["Cache-Control"]
        assert "stale-while-revalidate=120" in response.headers["Cache-Control"]

    def test_handles_none_response_gracefully(self):
        """Should not crash on None response."""
        # Act & Assert - should not raise
        set_http_cache_headers(None, etag="test")  # type: ignore[arg-type]

    def test_default_ttl_values(self):
        """Should use default TTL (1h) and stale (24h) when not specified."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_http_cache_headers(response, etag="some-etag")

        # Assert
        assert "max-age=3600" in response.headers["Cache-Control"]
        assert "stale-while-revalidate=86400" in response.headers["Cache-Control"]

    def test_etag_wrapped_in_quotes(self):
        """ETag should be wrapped in double quotes per RFC 7232."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_http_cache_headers(response, etag="abc-123")

        # Assert
        assert response.headers["ETag"] == '"abc-123"'

    def test_subunit_search_use_case(self):
        """Should work for subunit search caching (30 min TTL, 1h stale)."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_http_cache_headers(response, etag="rema-50-20", ttl_seconds=1800, stale_seconds=3600)

        # Assert
        assert "max-age=1800" in response.headers["Cache-Control"]
        assert "stale-while-revalidate=3600" in response.headers["Cache-Control"]
        assert "rema-50-20" in response.headers["ETag"]

    def test_subunit_detail_use_case(self):
        """Should work for subunit detail caching (1h TTL, 24h stale)."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_http_cache_headers(response, etag="987654321-subunits-25", ttl_seconds=3600, stale_seconds=86400)

        # Assert
        assert "max-age=3600" in response.headers["Cache-Control"]
        assert "987654321-subunits-25" in response.headers["ETag"]
