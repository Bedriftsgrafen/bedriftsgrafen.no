"""
Unit tests for StatsService.

Tests statistics calculations, caching, and aggregation methods.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from services.stats_service import StatsService, PERCENTILE_THRESHOLDS


class TestStatsServiceInit:
    """Tests for StatsService initialization."""

    def test_init_creates_repositories(self):
        # Arrange
        mock_db = MagicMock()

        # Act
        service = StatsService(mock_db)

        # Assert
        assert service.db == mock_db
        assert service.stats_repo is not None
        assert service.company_repo is not None


class TestGetMunicipalityName:
    """Tests for municipality name lookups."""

    def test_get_municipality_name_cached_value(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        StatsService._municipality_names = {"0301": "Oslo", "1103": "Stavanger"}

        # Act
        result = service._get_municipality_name("0301")

        # Assert
        assert result == "Oslo"

    def test_get_municipality_name_fallback(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        StatsService._municipality_names = {"0301": "Oslo"}

        # Act
        result = service._get_municipality_name("9999")

        # Assert
        assert result == "Kommune 9999"


class TestEnsureMunicipalityNamesLoaded:
    """Tests for municipality names cache loading."""

    @pytest.mark.asyncio
    async def test_ensure_municipality_names_loaded_skips_if_cached(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        StatsService._municipality_names = {"0301": "Oslo"}
        service.stats_repo.get_municipality_names = AsyncMock()

        # Act
        await service._ensure_municipality_names_loaded()

        # Assert - should not call repository
        service.stats_repo.get_municipality_names.assert_not_called()

    @pytest.mark.asyncio
    async def test_ensure_municipality_names_loaded_fetches_from_db(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        StatsService._municipality_names = {}  # Clear cache

        mock_row1 = MagicMock()
        mock_row1.code = "0301"
        mock_row1.name = "OSLO"
        mock_row2 = MagicMock()
        mock_row2.code = "1103"
        mock_row2.name = "stavanger"

        service.stats_repo.get_municipality_names = AsyncMock(return_value=[mock_row1, mock_row2])

        # Act
        await service._ensure_municipality_names_loaded()

        # Assert
        assert StatsService._municipality_names["0301"] == "Oslo"  # Title case
        assert StatsService._municipality_names["1103"] == "Stavanger"  # Title case


class TestGetCountyStats:
    """Tests for county statistics aggregation."""

    @pytest.mark.asyncio
    async def test_get_county_stats_returns_geo_stat_responses(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)

        # Mock county stats rows
        mock_county_row = MagicMock()
        mock_county_row.code = "03"
        mock_county_row.value = 50000

        # Mock population rows
        mock_pop_row = MagicMock()
        mock_pop_row.municipality_code = "0301"
        mock_pop_row.population = 700000

        service.stats_repo.get_county_stats = AsyncMock(return_value=[mock_county_row])
        service.stats_repo.get_municipality_populations = AsyncMock(return_value=[mock_pop_row])

        # Act
        result = await service.get_county_stats("company_count")

        # Assert
        assert len(result) == 1
        assert result[0].code == "03"
        assert result[0].value == 50000


class TestGetMunicipalityStats:
    """Tests for municipality statistics aggregation."""

    @pytest.mark.asyncio
    async def test_get_municipality_stats_returns_geo_stat_responses(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        StatsService._municipality_names = {"0301": "Oslo"}

        # Mock municipality stats rows
        mock_muni_row = MagicMock()
        mock_muni_row.code = "0301"
        mock_muni_row.value = 50000

        # Mock population rows
        mock_pop_row = MagicMock()
        mock_pop_row.municipality_code = "0301"
        mock_pop_row.population = 700000

        service.stats_repo.get_municipality_stats = AsyncMock(return_value=[mock_muni_row])
        service.stats_repo.get_municipality_populations = AsyncMock(return_value=[mock_pop_row])

        # Act
        result = await service.get_municipality_stats("company_count")

        # Assert
        assert len(result) >= 1


class TestPercentileEstimation:
    """Tests for percentile estimation logic."""

    def test_percentile_thresholds_ordered_correctly(self):
        """Thresholds should be ordered from highest ratio to lowest."""
        ratios = [t[0] for t in PERCENTILE_THRESHOLDS]
        assert ratios == sorted(ratios, reverse=True)

    def test_percentile_thresholds_percentiles_descending(self):
        """Percentiles should decrease as ratios decrease."""
        percentiles = [t[1] for t in PERCENTILE_THRESHOLDS]
        assert percentiles == sorted(percentiles, reverse=True)


class TestEstimatePercentile:
    """Tests for percentile estimation from ratio.

    Note: _estimate_percentile is an internal method used by get_industry_benchmark.
    These tests verify the percentile thresholds are correctly ordered.
    The actual estimation logic is tested via integration tests.
    """

    def test_percentile_thresholds_have_correct_structure(self):
        # Assert all thresholds have (ratio, percentile) format
        for threshold in PERCENTILE_THRESHOLDS:
            assert len(threshold) == 2
            assert isinstance(threshold[0], (int, float))
            assert isinstance(threshold[1], int)
