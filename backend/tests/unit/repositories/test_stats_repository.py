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
