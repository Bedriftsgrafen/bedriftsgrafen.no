import pytest
from unittest.mock import MagicMock, AsyncMock
from repositories.stats_repository import StatsRepository
from repositories.company_filter_builder import FilterParams
import models


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    # Ensure execute returns a mock that has scalars/scalar_one_or_none/etc
    result_mock = MagicMock()
    session.execute.return_value = result_mock
    return session


@pytest.fixture
def repo(mock_db_session):
    return StatsRepository(mock_db_session)


@pytest.mark.asyncio
async def test_get_industry_stats(repo, mock_db_session):
    # Setup mock return
    mock_stats = models.IndustryStats()
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_stats]

    result = await repo.get_industry_stats("01")

    assert result == mock_stats
    # Verify execute was called with correct select
    # Checking exact query structure is hard with SQLAlchemy objects,
    # but we can verify it was called.
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_get_industry_subclass_stats(repo, mock_db_session):
    mock_stats = models.IndustrySubclassStats()
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_stats

    result = await repo.get_industry_subclass_stats("01.110")

    assert result == mock_stats
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_get_county_stats(repo, mock_db_session):
    mock_rows = [MagicMock(), MagicMock()]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    # Passing a dummy column for metric_col
    result = await repo.get_county_stats(models.CountyStats.company_count, nace="01")

    assert result == mock_rows
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_get_municipality_stats(repo, mock_db_session):
    mock_rows = [MagicMock()]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_municipality_stats(models.MunicipalityStats.company_count, nace="01", county_code="30")

    assert result == mock_rows
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_get_latest_population_year(repo, mock_db_session):
    mock_db_session.execute.return_value.scalar.return_value = 2023

    year = await repo.get_latest_population_year()
    assert year == 2023
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_get_municipality_populations(repo, mock_db_session):
    # Case 1: no year
    mock_db_session.execute.return_value.scalar.return_value = None  # No latest year
    result = await repo.get_municipality_populations()  # Should return empty list
    assert result == []

    # Case 2: specific year
    mock_pop = models.MunicipalityPopulation()
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_pop]

    result = await repo.get_municipality_populations(year=2023)
    assert result == [mock_pop]


@pytest.mark.asyncio
async def test_get_municipality_names(repo, mock_db_session):
    mock_rows = [MagicMock()]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_municipality_names()
    assert result == mock_rows


@pytest.mark.asyncio
async def test_get_industry_stats_by_municipality(repo, mock_db_session):
    # Case 1: No data or low company count
    mock_db_session.execute.return_value.one_or_none.return_value = None
    result = await repo.get_industry_stats_by_municipality("01.110", "3001")
    assert result is None

    # Case 2: Success
    mock_row = MagicMock()
    mock_row.company_count = 10
    mock_row.avg_revenue = 1000
    mock_row.avg_profit = 100

    mock_db_session.execute.return_value.one_or_none.return_value = mock_row

    result = await repo.get_industry_stats_by_municipality("01.110", "3001")

    assert result is not None
    assert result.company_count == 10
    assert result.avg_revenue == 1000


@pytest.mark.asyncio
async def test_get_filtered_geography_stats(repo, mock_db_session):
    # Setup mock return
    mock_rows = [MagicMock()]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    filters = FilterParams(organisasjonsform=["AS"])

    # Test county level
    result = await repo.get_filtered_geography_stats(level="county", metric="company_count", filters=filters)
    assert result == mock_rows
    assert mock_db_session.execute.called

    # Test municipality level
    result = await repo.get_filtered_geography_stats(level="municipality", metric="total_employees", filters=filters)
    assert result == mock_rows
    assert mock_db_session.execute.called


# =============================================================================
# Tests for new refactored repository methods (stats.py, trends.py support)
# =============================================================================


@pytest.mark.asyncio
async def test_get_industry_stats_list_default_sort(repo, mock_db_session):
    """Test get_industry_stats_list with default sorting."""
    mock_stats = [models.IndustryStats(nace_division="01"), models.IndustryStats(nace_division="02")]
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = mock_stats

    result = await repo.get_industry_stats_list(sort_by="company_count", sort_order="desc", limit=50)

    assert len(result) == 2
    assert result[0].nace_division == "01"
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_get_industry_stats_list_ascending_sort(repo, mock_db_session):
    """Test get_industry_stats_list with ascending sort order."""
    mock_stats = [models.IndustryStats(nace_division="99")]
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = mock_stats

    result = await repo.get_industry_stats_list(sort_by="total_employees", sort_order="asc", limit=10)

    assert len(result) == 1
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_get_industry_stats_list_empty_result(repo, mock_db_session):
    """Test get_industry_stats_list returns empty list when no data."""
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = []

    result = await repo.get_industry_stats_list(sort_by="avg_revenue", sort_order="desc", limit=100)

    assert result == []
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_get_industry_stats_list_all_sort_fields(repo, mock_db_session):
    """Test all valid sort fields are accepted."""
    mock_stats = [models.IndustryStats()]
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = mock_stats

    sort_fields = [
        "company_count",
        "total_revenue",
        "avg_revenue",
        "total_employees",
        "bankrupt_count",
        "new_last_year",
        "bankruptcies_last_year",
        "avg_profit",
        "avg_operating_margin",
    ]

    for field in sort_fields:
        result = await repo.get_industry_stats_list(sort_by=field, sort_order="desc", limit=10)
        assert result is not None


@pytest.mark.asyncio
async def test_get_industry_stat_by_division_found(repo, mock_db_session):
    """Test get_industry_stat_by_division when division exists."""
    mock_stat = models.IndustryStats(nace_division="01", company_count=500)
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_stat

    result = await repo.get_industry_stat_by_division("01")

    assert result is not None
    assert result.nace_division == "01"
    assert result.company_count == 500


@pytest.mark.asyncio
async def test_get_industry_stat_by_division_not_found(repo, mock_db_session):
    """Test get_industry_stat_by_division when division doesn't exist."""
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = None

    result = await repo.get_industry_stat_by_division("99")

    assert result is None


@pytest.mark.asyncio
async def test_get_timeline_trends_bankruptcies(repo, mock_db_session):
    """Test get_timeline_trends for bankruptcies metric."""
    mock_row = MagicMock()
    mock_row.month = "2024-01"
    mock_row.cnt = 25
    mock_db_session.execute.return_value.all.return_value = [mock_row]

    result = await repo.get_timeline_trends(metric="bankruptcies", months=12)

    assert len(result) == 1
    assert result[0]["month"] == "2024-01"
    assert result[0]["count"] == 25


@pytest.mark.asyncio
async def test_get_timeline_trends_new_companies(repo, mock_db_session):
    """Test get_timeline_trends for new_companies metric."""
    mock_rows = [
        MagicMock(month="2024-01", cnt=100),
        MagicMock(month="2024-02", cnt=150),
    ]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_timeline_trends(metric="new_companies", months=6)

    assert len(result) == 2
    assert result[0]["month"] == "2024-01"
    assert result[1]["count"] == 150


@pytest.mark.asyncio
async def test_get_timeline_trends_empty_result(repo, mock_db_session):
    """Test get_timeline_trends returns empty list when no data."""
    mock_db_session.execute.return_value.all.return_value = []

    result = await repo.get_timeline_trends(metric="bankruptcies", months=1)

    assert result == []


@pytest.mark.asyncio
async def test_get_timeline_trends_months_safety(repo, mock_db_session):
    """Test that months parameter is safely cast to int."""
    mock_db_session.execute.return_value.all.return_value = []

    # Even if somehow a float gets passed, it should be safely handled
    result = await repo.get_timeline_trends(metric="new_companies", months=12)

    assert result == []
    assert mock_db_session.execute.called


# =============================================================================
# Phase 2.1: Expanded coverage for municipality/county dashboard methods
# =============================================================================


@pytest.mark.asyncio
async def test_get_municipality_premium_summary(repo, mock_db_session):
    """Test municipality dashboard summary aggregation."""
    # Mock population data (2 years for growth calc)
    mock_pop_current = MagicMock()
    mock_pop_current.population = 50000
    mock_pop_current.year = 2024
    mock_pop_previous = MagicMock()
    mock_pop_previous.population = 48000  # 4.17% growth

    mock_stats_row = MagicMock()
    mock_stats_row.company_count = 1000
    mock_stats_row.total_employees = 15000
    mock_stats_row.new_last_year = 120

    # Setup mock chain for multiple queries
    call_count = [0]

    def mock_execute_side_effect(*args, **kwargs):
        call_count[0] += 1
        result = MagicMock()
        if call_count[0] == 1:  # Population query
            result.scalars.return_value.all.return_value = [mock_pop_current, mock_pop_previous]
        elif call_count[0] == 2:  # Stats query
            result.one_or_none.return_value = mock_stats_row
        elif call_count[0] == 3:  # National company count
            result.scalar.return_value = 500000
        elif call_count[0] == 4:  # National population
            result.scalar.return_value = 5500000
        return result

    mock_db_session.execute.side_effect = mock_execute_side_effect

    result = await repo.get_municipality_premium_summary("3001")

    assert result["population"] == 50000
    assert result["company_count"] == 1000
    assert result["total_employees"] == 15000
    assert result["new_last_year"] == 120
    assert result["year"] == 2024
    # Population growth: (50000 - 48000) / 48000 * 100 ≈ 4.17%
    assert result["population_growth_1y"] is not None
    assert abs(result["population_growth_1y"] - 4.17) < 0.1


@pytest.mark.asyncio
async def test_get_municipality_premium_summary_no_data(repo, mock_db_session):
    """Test municipality summary when no population data exists."""
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = []

    result = await repo.get_municipality_premium_summary("9999")

    assert result["population"] == 0
    assert result["population_growth_1y"] is None


@pytest.mark.asyncio
async def test_get_municipality_sector_distribution(repo, mock_db_session):
    """Test industry distribution for a municipality."""
    mock_rows = [
        MagicMock(nace_division="62", company_count=50, total_employees=300),
        MagicMock(nace_division="47", company_count=30, total_employees=150),
    ]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_municipality_sector_distribution("3001", limit=10)

    assert len(result) == 2
    assert result[0]["nace_division"] == "62"
    assert result[0]["company_count"] == 50


@pytest.mark.asyncio
async def test_get_municipality_combined_rankings_found(repo, mock_db_session):
    """Test municipality ranking returns density, revenue, population rankings."""
    # Mock latest year
    mock_db_session.execute.return_value.scalar.return_value = 2024

    # Mock ranking results with combined structure
    mock_rank = MagicMock(
        municipality_code="3001",
        rank_density=3,
        rank_revenue=2,
        rank_population=1,
        total=10,
    )

    call_count = [0]

    def mock_execute_side_effect(*args, **kwargs):
        call_count[0] += 1
        result = MagicMock()
        if call_count[0] == 1:  # Year query
            result.scalar.return_value = 2024
        else:  # Ranking query
            result.all.return_value = [mock_rank]
        return result

    mock_db_session.execute.side_effect = mock_execute_side_effect

    result = await repo.get_municipality_combined_rankings("3001")

    assert result is not None
    assert result["density"]["rank"] == 3
    assert result["revenue"]["rank"] == 2
    assert result["population"]["rank"] == 1
    assert result["density"]["out_of"] == 10


@pytest.mark.asyncio
async def test_get_municipality_combined_rankings_not_found(repo, mock_db_session):
    """Test municipality ranking when municipality not in results."""
    mock_db_session.execute.return_value.scalar.return_value = 2024
    mock_db_session.execute.return_value.all.return_value = []

    result = await repo.get_municipality_combined_rankings("9999")

    assert result is None


@pytest.mark.asyncio
async def test_get_establishment_trend(repo, mock_db_session):
    """Test monthly registration trend for municipality."""
    from datetime import datetime

    mock_rows = [
        MagicMock(month=datetime(2024, 1, 1), count=15),
        MagicMock(month=datetime(2024, 2, 1), count=22),
        MagicMock(month=datetime(2024, 3, 1), count=18),
    ]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_establishment_trend("3001", months=12)

    assert len(result) == 3
    assert result[0]["label"] == "Jan 24"
    assert result[0]["value"] == 15
    assert result[1]["label"] == "Feb 24"


@pytest.mark.asyncio
async def test_get_establishment_trend_empty(repo, mock_db_session):
    """Test establishment trend with no data."""
    mock_db_session.execute.return_value.all.return_value = []

    result = await repo.get_establishment_trend("9999", months=6)

    assert result == []


@pytest.mark.asyncio
async def test_get_county_rankings_density(repo, mock_db_session):
    """Test national county ranking by business density."""
    # Mock year and ranking data
    call_count = [0]

    mock_ranks = [
        MagicMock(county_code="03", rank=1, total=11),  # Oslo
        MagicMock(county_code="30", rank=2, total=11),  # Viken
        MagicMock(county_code="11", rank=5, total=11),  # Rogaland
    ]

    def mock_execute_side_effect(*args, **kwargs):
        call_count[0] += 1
        result = MagicMock()
        if call_count[0] == 1:  # Year query
            result.scalar.return_value = 2024
        else:
            result.all.return_value = mock_ranks
        return result

    mock_db_session.execute.side_effect = mock_execute_side_effect

    result = await repo.get_county_rankings("11", metric="density")

    assert result is not None
    assert result["rank"] == 5
    assert result["out_of"] == 11


@pytest.mark.asyncio
async def test_get_county_rankings_revenue(repo, mock_db_session):
    """Test national county ranking by total revenue."""
    mock_db_session.execute.return_value.scalar.return_value = 2024
    mock_ranks = [
        MagicMock(county_code="03", rank=1, total=11),
    ]
    mock_db_session.execute.return_value.all.return_value = mock_ranks

    result = await repo.get_county_rankings("03", metric="revenue")

    assert result["rank"] == 1


@pytest.mark.asyncio
async def test_get_county_establishment_trend(repo, mock_db_session):
    """Test monthly establishment trend for county."""
    from datetime import datetime

    mock_rows = [
        MagicMock(month=datetime(2024, 1, 1), count=150),
        MagicMock(month=datetime(2024, 2, 1), count=180),
    ]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_county_establishment_trend("03", months=12)

    assert len(result) == 2
    assert result[0]["value"] == 150


@pytest.mark.asyncio
async def test_get_county_municipalities(repo, mock_db_session):
    """Test fetching all municipalities in a county with stats."""
    call_count = [0]

    # Mock row that matches the SQL query structure (code, name, population, company_count)
    mock_muni_row = MagicMock()
    mock_muni_row.code = "0301"
    mock_muni_row.name = "Oslo"
    mock_muni_row.population = 700000
    mock_muni_row.company_count = 50000

    def mock_execute_side_effect(*args, **kwargs):
        call_count[0] += 1
        result = MagicMock()
        if call_count[0] == 1:  # Year query
            result.scalar.return_value = 2024
        else:
            result.all.return_value = [mock_muni_row]
        return result

    mock_db_session.execute.side_effect = mock_execute_side_effect

    result = await repo.get_county_municipalities("03")

    assert len(result) == 1
    assert result[0]["code"] == "0301"
    assert result[0]["name"] == "Oslo"
    assert result[0]["population"] == 700000


@pytest.mark.asyncio
async def test_get_all_municipality_codes(repo, mock_db_session):
    """Test fetching all municipality codes."""
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = ["0301", "1101", "4601"]

    result = await repo.get_all_municipality_codes()

    assert len(result) == 3
    assert "0301" in result


# =============================================================================
# Additional coverage tests for uncovered lines
# =============================================================================


@pytest.mark.asyncio
async def test_get_industry_stats_section_aggregation(repo, mock_db_session):
    """Test industry stats aggregates multiple divisions for NACE section."""
    # Create multiple mock stats for different divisions in section "G"
    mock_stat1 = models.IndustryStats(
        nace_division="45",
        company_count=100,
        total_employees=500,
        total_revenue=10000000.0,
        total_profit=1000000.0,
        avg_operating_margin=10.0,
        new_last_year=10,
        bankrupt_count=5,
        bankruptcies_last_year=2,
        profitable_count=80,
    )
    mock_stat2 = models.IndustryStats(
        nace_division="46",
        company_count=200,
        total_employees=1000,
        total_revenue=20000000.0,
        total_profit=2000000.0,
        avg_operating_margin=8.0,
        new_last_year=20,
        bankrupt_count=10,
        bankruptcies_last_year=3,
        profitable_count=150,
    )
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_stat1, mock_stat2]

    result = await repo.get_industry_stats("G")

    assert result is not None
    assert result.company_count == 300  # 100 + 200
    assert result.total_employees == 1500  # 500 + 1000
    assert result.new_last_year == 30  # 10 + 20
    assert result.bankrupt_count == 15  # 5 + 10


@pytest.mark.asyncio
async def test_get_industry_stats_section_zero_revenue(repo, mock_db_session):
    """Test industry stats section aggregation with zero revenue."""
    mock_stat1 = models.IndustryStats(
        nace_division="45",
        company_count=100,
        total_revenue=0.0,
        avg_operating_margin=0.0,
    )
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_stat1, mock_stat1]

    result = await repo.get_industry_stats("G")

    assert result is not None
    assert result.avg_operating_margin == 0.0


@pytest.mark.asyncio
async def test_get_industry_stats_not_found(repo, mock_db_session):
    """Test industry stats returns None when not found."""
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = []

    result = await repo.get_industry_stats("99")

    assert result is None


@pytest.mark.asyncio
async def test_get_county_stats_with_section(repo, mock_db_session):
    """Test county stats with NACE section letter."""
    mock_rows = [MagicMock(code="03", value=1000)]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_county_stats(models.CountyStats.company_count, nace="G")

    assert result == mock_rows


@pytest.mark.asyncio
async def test_get_municipality_stats_with_section(repo, mock_db_session):
    """Test municipality stats with NACE section letter."""
    mock_rows = [MagicMock(code="0301", value=500)]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_municipality_stats(models.MunicipalityStats.company_count, nace="G")

    assert result == mock_rows


@pytest.mark.asyncio
async def test_get_industry_stats_by_municipality_section(repo, mock_db_session):
    """Test industry stats by municipality with NACE section."""
    mock_row = MagicMock()
    mock_row.company_count = 50
    mock_row.avg_revenue = 500000
    mock_row.avg_profit = 50000
    mock_row.avg_employees = 5
    mock_row.avg_operating_margin = 8.0
    mock_row.median_revenue = 400000
    mock_db_session.execute.return_value.one_or_none.return_value = mock_row

    result = await repo.get_industry_stats_by_municipality("G", "0301")

    assert result is not None
    assert result.company_count == 50


@pytest.mark.asyncio
async def test_get_industry_stats_by_municipality_low_count(repo, mock_db_session):
    """Test industry stats returns None when company count < 5."""
    mock_row = MagicMock()
    mock_row.company_count = 3  # Below threshold
    mock_db_session.execute.return_value.one_or_none.return_value = mock_row

    result = await repo.get_industry_stats_by_municipality("62", "0301")

    assert result is None


@pytest.mark.asyncio
async def test_get_filtered_geography_stats_new_last_year(repo, mock_db_session):
    """Test filtered geography stats with new_last_year metric."""
    mock_rows = [MagicMock(code="03", value=100)]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    filters = FilterParams()
    result = await repo.get_filtered_geography_stats(level="county", metric="new_last_year", filters=filters)

    assert result == mock_rows


@pytest.mark.asyncio
async def test_get_filtered_geography_stats_bankrupt_count(repo, mock_db_session):
    """Test filtered geography stats with bankrupt_count metric."""
    mock_rows = [MagicMock(code="03", value=50)]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    filters = FilterParams()
    result = await repo.get_filtered_geography_stats(level="municipality", metric="bankrupt_count", filters=filters)

    assert result == mock_rows


@pytest.mark.asyncio
async def test_get_county_premium_summary(repo, mock_db_session):
    """Test county dashboard summary aggregation."""
    call_count = [0]

    def mock_execute_side_effect(*args, **kwargs):
        call_count[0] += 1
        result = MagicMock()
        if call_count[0] == 1:  # Latest year
            result.scalar.return_value = 2024
        elif call_count[0] == 2:  # Population query
            row = MagicMock()
            row.population = 700000
            row.municipality_count = 15
            result.one_or_none.return_value = row
        elif call_count[0] == 3:  # Previous year population
            result.scalar.return_value = 690000
        elif call_count[0] == 4:  # Stats query
            row = MagicMock()
            row.company_count = 50000
            row.total_employees = 300000
            row.new_last_year = 5000
            row.total_revenue = 500000000000.0
            result.one_or_none.return_value = row
        elif call_count[0] == 5:  # National company count
            result.scalar.return_value = 600000
        elif call_count[0] == 6:  # National population
            result.scalar.return_value = 5500000
        return result

    mock_db_session.execute.side_effect = mock_execute_side_effect

    result = await repo.get_county_premium_summary("03")

    assert result["population"] == 700000
    assert result["company_count"] == 50000
    assert result["municipality_count"] == 15
    assert result["population_growth_1y"] is not None


@pytest.mark.asyncio
async def test_get_county_sector_distribution(repo, mock_db_session):
    """Test county industry distribution."""
    mock_rows = [
        MagicMock(nace_division="62", company_count=5000, total_employees=30000),
        MagicMock(nace_division="47", company_count=3000, total_employees=20000),
    ]
    mock_db_session.execute.return_value.all.return_value = mock_rows

    result = await repo.get_county_sector_distribution("03", limit=10)

    assert len(result) == 2
    assert result[0]["nace_division"] == "62"
    assert result[0]["company_count"] == 5000


@pytest.mark.asyncio
async def test_get_all_county_summaries(repo, mock_db_session):
    """Test all county summaries for index page."""
    call_count = [0]

    def mock_execute_side_effect(*args, **kwargs):
        call_count[0] += 1
        result = MagicMock()
        if call_count[0] == 1:  # Latest year
            result.scalar.return_value = 2024
        elif call_count[0] == 2:  # Stats query
            row = MagicMock()
            row.code = "03"
            row.company_count = 50000
            row.municipality_count = 1
            result.all.return_value = [row]
        elif call_count[0] == 3:  # Population query
            row = MagicMock()
            row.code = "03"
            row.population = 700000
            result.all.return_value = [row]
        return result

    mock_db_session.execute.side_effect = mock_execute_side_effect

    result = await repo.get_all_county_summaries()

    assert len(result) == 1
    assert result[0]["code"] == "03"
    assert result[0]["company_count"] == 50000


@pytest.mark.asyncio
async def test_get_municipality_codes_with_updates(repo, mock_db_session):
    """Test fetching municipality codes with update timestamps."""
    from datetime import datetime

    mock_rows = [
        MagicMock(municipality_code="0301", latest_update=datetime(2024, 1, 15)),
        MagicMock(municipality_code="1101", latest_update=None),
    ]
    mock_db_session.execute.return_value.__iter__ = lambda self: iter(mock_rows)

    result = await repo.get_municipality_codes_with_updates()

    assert len(result) == 2
    assert result[0][0] == "0301"


@pytest.mark.asyncio
async def test_get_municipality_populations_with_year(repo, mock_db_session):
    """Test municipality populations with specific year."""
    mock_pop = models.MunicipalityPopulation()
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_pop]

    result = await repo.get_municipality_populations(year=2023)

    assert result == [mock_pop]


@pytest.mark.asyncio
async def test_get_municipality_populations_auto_year(repo, mock_db_session):
    """Test municipality populations auto-detects latest year."""
    call_count = [0]

    def mock_execute_side_effect(*args, **kwargs):
        call_count[0] += 1
        result = MagicMock()
        if call_count[0] == 1:  # get_latest_population_year
            result.scalar.return_value = 2024
        else:  # actual population query
            mock_pop = models.MunicipalityPopulation()
            result.scalars.return_value.all.return_value = [mock_pop]
        return result

    mock_db_session.execute.side_effect = mock_execute_side_effect

    result = await repo.get_municipality_populations()

    assert len(result) == 1
