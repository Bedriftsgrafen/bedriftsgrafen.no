"""
Unit tests for SEOService.
Tests company OG data fetching, SVG generation, and sitemap caching.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.seo_service import SEOService


class TestSEOServiceOG:
    """Tests for OG image generation functionality."""

    @pytest.mark.asyncio
    async def test_get_company_og_data_returns_formatted_data(self):
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)

        # Mock DB response row
        mock_row = MagicMock()
        mock_row.navn = "TESTBEDRIFT AS"
        mock_row.naeringskode = "62.010"
        mock_row.antall_ansatte = 10
        mock_row.salgsinntekter = 5000000.0
        mock_row.aarsresultat = 500000.0

        mock_result = MagicMock()
        mock_result.first.return_value = mock_row
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await service.get_company_og_data("123456789")

        # Assert
        assert result is not None
        assert result["navn"] == "TESTBEDRIFT AS"
        assert result["orgnr"] == "123456789"
        assert "Tjenester tilknyttet informasjonsteknologi" in result["nace_name"]
        assert result["revenue"] == 5000000.0
        assert result["profit"] == 500000.0
        assert result["employees"] == 10

    @pytest.mark.asyncio
    async def test_get_company_og_data_not_found(self):
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)

        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await service.get_company_og_data("999999999")

        # Assert
        assert result is None

    def test_generate_company_og_svg_contains_data(self):
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "navn": "TESTBEDRIFT AS",
            "orgnr": "123456789",
            "nace_name": "Programmeringstjenester",
            "revenue": 5000000.0,
            "profit": 500000.0,
            "employees": 10,
        }

        # Act
        svg = service.generate_company_og_svg(data)

        # Assert
        assert "<svg" in svg
        assert "TESTBEDRIFT AS" in svg
        assert "123456789" in svg
        assert "Programmeringstjenester" in svg
        assert "5,0M" in svg  # Formatted revenue
        assert "500K" in svg  # Formatted profit
        assert "10" in svg  # Employees

    def test_generate_municipality_og_svg_contains_data(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "name": "Oslo",
            "population": 700000,
            "population_growth_1y": 1.5,
            "company_count": 50000,
        }

        svg = service.generate_municipality_og_svg(data)

        assert "<svg" in svg
        assert "Oslo" in svg
        assert "INNBYGGERE" in svg
        assert "VIRKSOMHETER" in svg
        assert "+1.5%" in svg

    def test_generate_municipality_og_svg_null_growth(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "name": "Ny Kommune",
            "population": 5000,
            "population_growth_1y": None,
            "company_count": 100,
        }

        svg = service.generate_municipality_og_svg(data)

        assert "<svg" in svg
        assert "—" in svg  # Growth falls back to em-dash

    def test_generate_county_og_svg_contains_data(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "name": "Vestland",
            "population": 634463,
            "company_count": 42000,
            "top_sectors": [{"nace_name": "Havbruk"}, {"nace_name": "Handel"}],
        }

        svg = service.generate_county_og_svg(data)

        assert "<svg" in svg
        assert "Vestland" in svg
        assert "Fylkesrapport" in svg
        assert "Havbruk" in svg

    def test_generate_county_og_svg_empty_sectors(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "name": "Testfylke",
            "population": 10000,
            "company_count": 1000,
            "top_sectors": [],
        }

        svg = service.generate_county_og_svg(data)

        assert "<svg" in svg
        assert "—" in svg  # Sector falls back to em-dash

    def test_generate_county_og_svg_null_population(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "name": "Testfylke",
            "population": None,
            "company_count": 1000,
            "top_sectors": [],
        }

        svg = service.generate_county_og_svg(data)

        assert "<svg" in svg
        assert "—" in svg  # Population falls back to em-dash

    def test_generate_county_og_svg_escapes_xss(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "name": "<script>alert(1)</script>",
            "population": 1000,
            "company_count": 100,
            "top_sectors": [{"nace_name": "<img src=x>"}],
        }

        svg = service.generate_county_og_svg(data)

        assert "<script>" not in svg
        assert "&lt;script&gt;" in svg

    def test_generate_industry_og_svg_contains_data(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "nace_division": "62",
            "nace_name": "Programmeringstjenester",
            "company_count": 15000,
            "total_employees": 80000,
            "avg_revenue": 3500000.0,
        }

        svg = service.generate_industry_og_svg(data)

        assert "<svg" in svg
        assert "Programmeringstjenester" in svg
        assert "Bransjeoversikt" in svg
        assert "3,5M" in svg  # Formatted avg_revenue

    def test_generate_industry_og_svg_null_nace_name(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "nace_division": "99",
            "nace_name": None,
            "company_count": 100,
            "total_employees": None,
            "avg_revenue": None,
        }

        svg = service.generate_industry_og_svg(data)

        assert "<svg" in svg
        assert "NACE 99" in svg

    def test_generate_industry_og_svg_escapes_xss(self):
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "nace_division": "62",
            "nace_name": "<script>alert(1)</script>",
            "company_count": 100,
            "total_employees": 500,
            "avg_revenue": 1000000.0,
        }

        svg = service.generate_industry_og_svg(data)

        assert "<script>" not in svg
        assert "&lt;script&gt;" in svg


class TestSEOServiceCache:
    """Tests for sitemap caching functionality."""

    @pytest.fixture(autouse=True)
    def reset_cache(self):
        """Reset class-level cache before each test."""
        SEOService._sitemap_cache = {
            "total_companies": 0,
            "total_people": 0,
            "municipalities": [],
            "company_anchors": [],
            "person_anchors": [],
            "expiry": None,
            "populated": False,
            "is_warming": False,
        }
        SEOService._cache_lock = None
        yield

    def test_is_cache_valid_when_expired(self):
        """Cache should be invalid when expired."""

        SEOService._sitemap_cache["expiry"] = datetime.now(UTC) - timedelta(hours=1)
        assert SEOService.is_cache_valid() is False

    def test_is_cache_valid_when_not_set(self):
        """Cache should be invalid when expiry is None."""
        SEOService._sitemap_cache["expiry"] = None
        assert SEOService.is_cache_valid() is False

    def test_is_cache_valid_when_fresh(self):
        """Cache should be valid when expiry is in the future."""

        SEOService._sitemap_cache["expiry"] = datetime.now(UTC) + timedelta(hours=1)
        assert SEOService.is_cache_valid() is True

    @pytest.mark.asyncio
    async def test_get_sitemap_data_returns_cached_when_valid(self):
        """Should return cached data without DB call when cache is valid."""
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)

        # Pre-populate cache

        SEOService._sitemap_cache = {
            "total_companies": 1000,
            "total_people": 500,
            "municipalities": [("0301", "2024-01-01")],
            "company_anchors": ["123456789"],
            "person_anchors": [("Test Person", "1990-01-01")],
            "expiry": datetime.now(UTC) + timedelta(hours=1),
            "populated": True,
            "is_warming": False,
        }

        # Act
        result = await service.get_sitemap_data()

        # Assert - no DB calls should be made
        mock_db.execute.assert_not_called()
        assert result["total_companies"] == 1000

    @pytest.mark.asyncio
    async def test_get_sitemap_data_refreshes_when_expired(self):
        """Should refresh cache when expired."""
        # Arrange
        mock_db = MagicMock()

        # Mock count query
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 2000
        mock_db.execute = AsyncMock(return_value=mock_count_result)

        service = SEOService(mock_db)

        # Mock repositories
        service.role_repo.count_commercial_people = AsyncMock(return_value=1000)
        service.stats_repo.get_municipality_codes_with_updates = AsyncMock(return_value=[])
        service.company_repo.get_sitemap_anchors_optimized = AsyncMock(return_value=[])
        service.role_repo.get_person_sitemap_anchors_optimized = AsyncMock(return_value=[])

        # Act
        result = await service.get_sitemap_data()

        # Assert
        assert result["total_companies"] == 2000
        assert result["total_people"] == 1000

    @pytest.mark.asyncio
    async def test_get_sitemap_data_serves_stale_when_locked(self):
        """Should serve stale data when another refresh is in progress."""
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)

        # Pre-populate stale cache

        SEOService._sitemap_cache = {
            "total_companies": 1000,
            "total_people": 500,
            "municipalities": [],
            "company_anchors": [],
            "person_anchors": [],
            "expiry": datetime.now(UTC) - timedelta(hours=1),  # Expired
            "populated": True,
            "is_warming": False,
        }

        # Acquire lock to simulate another refresh in progress
        lock = SEOService._get_lock()
        await lock.acquire()

        try:
            # Act - should return stale data immediately
            result = await service.get_sitemap_data()

            # Assert
            assert result["total_companies"] == 1000  # Stale data
            mock_db.execute.assert_not_called()  # No DB call
        finally:
            lock.release()

    @pytest.mark.asyncio
    async def test_get_sitemap_data_handles_timeout(self):
        """Should handle timeout gracefully and use stale data."""
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)

        # Pre-populate cache

        SEOService._sitemap_cache = {
            "total_companies": 1000,
            "total_people": 500,
            "municipalities": [],
            "company_anchors": [],
            "person_anchors": [],
            "expiry": datetime.now(UTC) - timedelta(hours=1),  # Expired
            "populated": True,
            "is_warming": False,
        }

        # Mock slow DB call that will timeout
        async def slow_query(*args, **kwargs):
            await asyncio.sleep(200)  # Much longer than timeout

        mock_db.execute = slow_query
        mock_db.rollback = AsyncMock()

        # Act - patch timeout to be very short
        with patch("services.seo_service.CACHE_REFRESH_TIMEOUT", 0.01):
            result = await service.get_sitemap_data()

        # Assert - should still have data (stale)
        assert result["total_companies"] == 1000

    @pytest.mark.asyncio
    async def test_cache_lock_prevents_thundering_herd(self):
        """Multiple concurrent requests should only trigger one refresh."""
        # Arrange
        mock_db = MagicMock()
        refresh_count = 0

        async def mock_execute(*args, **kwargs):
            nonlocal refresh_count
            refresh_count += 1
            await asyncio.sleep(0.1)  # Simulate slow query
            mock_result = MagicMock()
            mock_result.scalar.return_value = 1000
            return mock_result

        mock_db.execute = mock_execute

        # Create multiple services
        services = [SEOService(mock_db) for _ in range(5)]

        # Mock repositories for all services
        for svc in services:
            svc.role_repo.count_commercial_people = AsyncMock(return_value=500)
            svc.stats_repo.get_municipality_codes_with_updates = AsyncMock(return_value=[])
            svc.company_repo.get_sitemap_anchors_optimized = AsyncMock(return_value=[])
            svc.role_repo.get_person_sitemap_anchors_optimized = AsyncMock(return_value=[])

        # Act - fire all requests concurrently
        results = await asyncio.gather(*[svc.get_sitemap_data() for svc in services])

        # Assert - all should get data, but only one refresh should happen
        for result in results:
            assert result["total_companies"] is not None
        # Due to lock, only 1-2 refreshes should occur (not 5)
        assert refresh_count <= 2
