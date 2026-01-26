"""
Unit tests for HTTP caching utilities.

Tests cache header functions for subunit endpoints.
Follows AAA pattern (Arrange - Act - Assert).
"""

from unittest.mock import MagicMock

from utils.caching import set_subunit_search_cache, set_subunit_detail_cache


class TestSetSubunitSearchCache:
    """Tests for set_subunit_search_cache function."""

    def test_sets_cache_control_header(self):
        """Should set Cache-Control header with TTL and stale-while-revalidate."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_subunit_search_cache(response, "test", 10, 5)

        # Assert
        assert "Cache-Control" in response.headers
        assert "max-age=1800" in response.headers["Cache-Control"]
        assert "stale-while-revalidate=3600" in response.headers["Cache-Control"]

    def test_sets_etag_header(self):
        """Should set ETag header with query, limit, and count."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_subunit_search_cache(response, "myquery", 20, 15)

        # Assert
        assert "ETag" in response.headers
        assert "myquery-20-15" in response.headers["ETag"]

    def test_custom_ttl_values(self):
        """Should use custom TTL and stale values."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_subunit_search_cache(response, "test", 10, 5, ttl_seconds=60, stale_seconds=120)

        # Assert
        assert "max-age=60" in response.headers["Cache-Control"]
        assert "stale-while-revalidate=120" in response.headers["Cache-Control"]

    def test_handles_none_response_gracefully(self):
        """Should not crash on None response."""
        # Act & Assert - should not raise
        set_subunit_search_cache(None, "test", 10, 5)

    def test_empty_query_string(self):
        """Should handle empty query string."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_subunit_search_cache(response, "", 10, 0)

        # Assert
        assert "ETag" in response.headers
        assert '"-10-0"' in response.headers["ETag"]


class TestSetSubunitDetailCache:
    """Tests for set_subunit_detail_cache function."""

    def test_sets_cache_control_header(self):
        """Should set Cache-Control with longer TTL for details."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_subunit_detail_cache(response, "123456789", 10)

        # Assert
        assert "Cache-Control" in response.headers
        assert "max-age=3600" in response.headers["Cache-Control"]  # 1 hour default
        assert "stale-while-revalidate=86400" in response.headers["Cache-Control"]  # 24 hours

    def test_sets_etag_with_orgnr_and_count(self):
        """Should set ETag with orgnr and subunit count."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_subunit_detail_cache(response, "987654321", 25)

        # Assert
        assert "ETag" in response.headers
        assert "987654321-subunits-25" in response.headers["ETag"]

    def test_custom_ttl_values(self):
        """Should use custom TTL and stale values."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_subunit_detail_cache(response, "123456789", 10, ttl_seconds=7200, stale_seconds=172800)

        # Assert
        assert "max-age=7200" in response.headers["Cache-Control"]
        assert "stale-while-revalidate=172800" in response.headers["Cache-Control"]

    def test_handles_none_response_gracefully(self):
        """Should not crash on None response."""
        # Act & Assert - should not raise
        set_subunit_detail_cache(None, "123456789", 10)

    def test_zero_subunit_count(self):
        """Should handle zero subunit count."""
        # Arrange
        response = MagicMock()
        response.headers = {}

        # Act
        set_subunit_detail_cache(response, "123456789", 0)

        # Assert
        assert "123456789-subunits-0" in response.headers["ETag"]
