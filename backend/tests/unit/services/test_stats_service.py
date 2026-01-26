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


class TestNaceFallback:
    """Tests for NACE truncation fallback logic."""

    @pytest.mark.asyncio
    async def test_get_county_stats_truncates_nace(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        service.stats_repo.get_county_stats = AsyncMock(return_value=[])
        service.stats_repo.get_municipality_populations = AsyncMock(return_value=[])

        # Act: Pass 5-digit NACE
        await service.get_county_stats("company_count", nace="62.100")

        # Assert: Repo should receive truncated 2-digit NACE
        # The second arg to get_county_stats is nace
        args, _ = service.stats_repo.get_county_stats.call_args
        assert args[1] == "62"

    @pytest.mark.asyncio
    async def test_get_municipality_stats_truncates_nace(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        service.stats_repo.get_municipality_stats = AsyncMock(return_value=[])
        service.stats_repo.get_municipality_populations = AsyncMock(return_value=[])
        service._ensure_municipality_names_loaded = AsyncMock()

        # Act: Pass 5-digit NACE
        await service.get_municipality_stats("company_count", nace="62.100")

        # Assert: Repo should receive truncated 2-digit NACE
        args, _ = service.stats_repo.get_municipality_stats.call_args
        assert args[1] == "62"


class TestGetGeographyStats:
    """Tests for get_geography_stats method."""

    @pytest.mark.asyncio
    async def test_uses_filtered_stats_when_filters_present(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        StatsService._municipality_names = {"0301": "Oslo"}

        from repositories.company_filter_builder import FilterParams

        filters = FilterParams(naeringskode="62", min_employees=10)

        mock_row = MagicMock()
        mock_row.code = "03"
        mock_row.value = 1000

        mock_pop_row = MagicMock()
        mock_pop_row.municipality_code = "0301"
        mock_pop_row.population = 700000

        service.stats_repo.get_filtered_geography_stats = AsyncMock(return_value=[mock_row])
        service.stats_repo.get_municipality_populations = AsyncMock(return_value=[mock_pop_row])
        service._ensure_municipality_names_loaded = AsyncMock()

        # Act
        result = await service.get_geography_stats("county", "company_count", filters)

        # Assert
        service.stats_repo.get_filtered_geography_stats.assert_called_once()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_falls_back_to_materialized_views_when_no_filters(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)

        from repositories.company_filter_builder import FilterParams

        filters = FilterParams()  # Empty filters

        service.get_county_stats = AsyncMock(return_value=[])

        # Act
        await service.get_geography_stats("county", "company_count", filters)

        # Assert
        service.get_county_stats.assert_called_once()


class TestGetGeographyAverages:
    """Tests for get_geography_averages method."""

    @pytest.mark.asyncio
    async def test_returns_national_and_county_averages(self):
        # Arrange
        mock_db = AsyncMock()
        service = StatsService(mock_db)

        from repositories.company_filter_builder import FilterParams

        filters = FilterParams()  # Empty filters

        mock_result = MagicMock()
        mock_result.scalar.return_value = 100000
        mock_db.execute.return_value = mock_result

        # Act
        result = await service.get_geography_averages("county", "company_count", filters)

        # Assert
        assert result.national_total == 100000
        assert result.national_avg is not None


class TestGetIndustryBenchmark:
    """Tests for get_industry_benchmark method."""

    @pytest.mark.asyncio
    async def test_returns_benchmark_data_with_percentiles(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)

        # Mock industry stats
        mock_industry_stats = MagicMock()
        mock_industry_stats.company_count = 500
        mock_industry_stats.avg_revenue = 5000000
        mock_industry_stats.median_revenue = 3000000
        mock_industry_stats.avg_profit = 500000
        mock_industry_stats.avg_employees = 10
        mock_industry_stats.avg_operating_margin = 8.5

        service.stats_repo.get_industry_stats = AsyncMock(return_value=mock_industry_stats)

        # Mock company financials
        mock_financials = MagicMock()
        mock_financials.salgsinntekter = 10000000  # 2x average
        mock_financials.aarsresultat = 1000000
        mock_financials.driftsresultat = 800000

        service.company_repo.get_company_with_latest_financials = AsyncMock(return_value=(mock_financials, 25))

        # Act
        result = await service.get_industry_benchmark("62", "123456789")

        # Assert
        assert result is not None
        assert result["nace_code"] == "62"
        assert result["company_count"] == 500
        assert result["revenue"]["company_value"] == 10000000
        assert result["revenue"]["percentile"] is not None  # Should have percentile

    @pytest.mark.asyncio
    async def test_returns_none_when_no_industry_data(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        service.stats_repo.get_industry_stats = AsyncMock(return_value=None)
        service.company_repo.get_company_with_latest_financials = AsyncMock(return_value=(None, None))

        # Act
        result = await service.get_industry_benchmark("99", "123456789")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_falls_back_from_subclass_to_division(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)

        # First call (subclass) returns None, second call (division) returns data
        mock_industry_stats = MagicMock()
        mock_industry_stats.company_count = 500
        mock_industry_stats.avg_revenue = 5000000
        mock_industry_stats.median_revenue = 3000000
        mock_industry_stats.avg_profit = 500000
        mock_industry_stats.avg_employees = 10
        mock_industry_stats.avg_operating_margin = 8.5

        service.stats_repo.get_industry_subclass_stats = AsyncMock(return_value=None)
        service.stats_repo.get_industry_stats = AsyncMock(return_value=mock_industry_stats)
        service.company_repo.get_company_with_latest_financials = AsyncMock(return_value=(None, None))

        # Act
        result = await service.get_industry_benchmark("62.010", "123456789")

        # Assert
        assert result is not None
        assert result["nace_code"] == "62"  # Fallback to division


class TestGetMunicipalityPremiumDashboard:
    """Tests for get_municipality_premium_dashboard method."""

    @pytest.mark.asyncio
    async def test_returns_comprehensive_dashboard(self):
        # Arrange
        mock_db = MagicMock()
        service = StatsService(mock_db)
        StatsService._municipality_names = {"0301": "Oslo"}

        # Mock summary
        service.stats_repo.get_municipality_premium_summary = AsyncMock(
            return_value={
                "population": 700000,
                "population_growth_1y": 1.2,
                "company_count": 50000,
                "national_density": 25.5,
            }
        )

        # Mock sectors
        service.stats_repo.get_municipality_sector_distribution = AsyncMock(
            return_value=[{"nace": "G", "name": "Handel", "count": 5000}]
        )

        # Mock rankings
        service.stats_repo.get_municipality_rankings = AsyncMock(return_value={"rank": 1, "total": 15})

        # Mock trend
        service.stats_repo.get_establishment_trend = AsyncMock(return_value=[{"year": 2024, "count": 500}])

        # Mock company lists
        mock_company = MagicMock()
        mock_company.navn = "Test AS"
        service.company_repo.get_all = AsyncMock(return_value=[mock_company])

        # Act
        result = await service.get_municipality_premium_dashboard("0301")

        # Assert
        assert result["code"] == "0301"
        assert result["name"] == "Oslo"
        assert result["population"] == 700000
        assert result["company_count"] == 50000
        assert result["business_density"] > 0
        assert "top_sectors" in result
        assert "top_companies" in result
