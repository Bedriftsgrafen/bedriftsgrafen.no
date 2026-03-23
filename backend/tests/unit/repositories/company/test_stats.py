from unittest.mock import AsyncMock, MagicMock

import pytest

from repositories.company.stats import StatsMixin
from repositories.company_filter_builder import FilterParams


class MockRepository(StatsMixin):
    def __init__(self, db):
        self.db = db

    def _apply_filters_no_join(self, query, filters):
        return query, False

    def _apply_filters(self, query, filters):
        return query, False


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    # Ensure execute returns a mock that has scalars/scalar_one_or_none/etc
    result_mock = MagicMock()
    result_mock.scalar.return_value = 0
    result_mock.fetchone.return_value = None
    session.execute.return_value = result_mock

    # Mock begin_nested specifically as a sync methods returning async CM
    nested_cm = MagicMock()
    nested_cm.__aenter__ = AsyncMock(return_value=session)
    nested_cm.__aexit__ = AsyncMock(return_value=None)

    session.begin_nested = MagicMock(return_value=nested_cm)

    return session


@pytest.fixture
def repo(mock_db_session):
    return MockRepository(mock_db_session)


@pytest.mark.asyncio
async def test_count_companies_empty(repo, mock_db_session):
    filters = FilterParams()
    # Fast path: SELECT COUNT(*) FROM bedrifter
    mock_db_session.execute.return_value.scalar.return_value = 100

    count = await repo.count_companies(filters)

    assert count == 100
    # Verify exact SQL text check would make it fragile, but we can check calls
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_count_companies_org_form_opt(repo, mock_db_session):
    filters = FilterParams(organisasjonsform=["AS"])
    # Fast path: SELECT COALESCE(SUM(count), 0) FROM orgform_counts
    mock_db_session.execute.return_value.scalar.return_value = 50

    count = await repo.count_companies(filters)

    assert count == 50
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_count_companies_full_query(repo, mock_db_session):
    filters = FilterParams(name="Test")  # Forces non-optimized path
    mock_db_session.execute.return_value.scalar.return_value = 5

    count = await repo.count_companies(filters)

    assert count == 5


@pytest.mark.asyncio
async def test_get_aggregate_stats_materialized_view(repo, mock_db_session):
    filters = FilterParams()

    # Mock row for SELECT * FROM company_totals
    # Schema expects: id, total_count, total_revenue, total_profit, total_employees, etc.
    data = {
        "id": 1,
        "total_count": 100,
        "total_revenue": 1000.0,
        "total_profit": 100.0,
        "total_employees": 50,
        "geocoded_count": 90,
        "new_companies_30d": 10,
        "total_roles": 500,
    }
    mock_row_totals = MagicMock()
    mock_row_totals._mapping = data
    mock_row_totals._asdict.return_value = data

    # Mock rows for orgform breakdown
    mock_rows_breakdown = [
        MagicMock(_mapping={"kode": "AS", "count": 50}),
        MagicMock(_mapping={"kode": "ENK", "count": 50}),
    ]

    # Side effects for execute
    mock_result_totals = MagicMock()
    mock_result_totals.fetchone.return_value = mock_row_totals

    mock_result_breakdown = MagicMock()
    mock_result_breakdown.fetchall.return_value = mock_rows_breakdown

    # Using AsyncMock side_effect is tricky for execute if it's called multiple times.
    mock_db_session.execute.side_effect = [mock_result_totals, mock_result_breakdown]

    stats = await repo.get_aggregate_stats(filters)

    assert stats["total_count"] == 100
    assert stats["total_revenue"] == 1000.0
    assert len(stats["by_organisasjonsform"]) == 2


@pytest.mark.asyncio
async def test_get_aggregate_stats_fallback(repo, mock_db_session):
    filters = FilterParams(name="Filter")

    # Mock total stats row
    mock_row_stats = (10, 500.0, 50.0, 20)

    # Mock breakdown
    mock_rows_breakdown = [("AS", 10)]

    mock_result_stats = MagicMock()
    mock_result_stats.fetchone.return_value = mock_row_stats

    mock_result_breakdown = MagicMock()
    mock_result_breakdown.fetchall.return_value = mock_rows_breakdown

    mock_db_session.execute.side_effect = [mock_result_stats, mock_result_breakdown]

    stats = await repo.get_aggregate_stats(filters)

    assert stats["total_count"] == 10
    assert stats["total_revenue"] == 500.0


@pytest.mark.asyncio
async def test_count_simple(repo, mock_db_session):
    mock_db_session.execute.return_value.scalar.return_value = 99
    assert await repo.count() == 99


@pytest.mark.asyncio
async def test_get_total_employees(repo, mock_db_session):
    # Try pre-computed first
    mock_db_session.execute.return_value.scalar.return_value = 1000
    assert await repo.get_total_employees() == 1000


@pytest.mark.asyncio
async def test_get_total_employees_fallback(repo, mock_db_session):
    # Simulate first call failing, second succeeding
    mock_db_session.execute.side_effect = [Exception("Table not found"), MagicMock(scalar=MagicMock(return_value=1000))]
    assert await repo.get_total_employees() == 1000


@pytest.mark.asyncio
async def test_alert_methods(repo, mock_db_session):
    # Simple coverage for get_new_companies_ytd and get_bankruptcies_count
    mock_db_session.execute.return_value.scalar.return_value = 10
    assert await repo.get_new_companies_ytd() == 10
    assert await repo.get_bankruptcies_count() == 10


@pytest.mark.asyncio
async def test_count_companies_with_financial_sort(repo, mock_db_session):
    """Test count with financial sort field triggers financial join."""
    filters = FilterParams()
    mock_db_session.execute.return_value.scalar.return_value = 25

    count = await repo.count_companies(filters, sort_by="revenue")

    assert count == 25


@pytest.mark.asyncio
async def test_count_companies_with_financial_filters(repo, mock_db_session):
    """Test count with financial filters triggers financial join."""
    filters = FilterParams(min_revenue=1000)
    mock_db_session.execute.return_value.scalar.return_value = 15

    count = await repo.count_companies(filters)

    assert count == 15


@pytest.mark.asyncio
async def test_count_companies_org_form_error_fallback(repo, mock_db_session):
    """Test org form optimization failure falls back to regular query."""
    filters = FilterParams(organisasjonsform=["AS"])

    # First call fails (org form optimization), second succeeds
    mock_result1 = MagicMock()
    mock_result1.scalar.side_effect = Exception("Table not found")

    mock_result2 = MagicMock()
    mock_result2.scalar.return_value = 30

    mock_db_session.execute.side_effect = [mock_result1, mock_result2]

    count = await repo.count_companies(filters)

    assert count == 30


@pytest.mark.asyncio
async def test_get_aggregate_stats_with_financial_sort(repo, mock_db_session):
    """Test aggregate stats with financial sort uses INNER JOIN."""
    filters = FilterParams()

    mock_row_stats = (50, 10000.0, 1000.0, 100)
    mock_rows_breakdown = [("AS", 50)]

    mock_result_stats = MagicMock()
    mock_result_stats.fetchone.return_value = mock_row_stats

    mock_result_breakdown = MagicMock()
    mock_result_breakdown.fetchall.return_value = mock_rows_breakdown

    mock_db_session.execute.side_effect = [mock_result_stats, mock_result_breakdown]

    stats = await repo.get_aggregate_stats(filters, sort_by="revenue")

    assert stats["total_count"] == 50
    assert stats["total_revenue"] == 10000.0


@pytest.mark.asyncio
async def test_get_aggregate_stats_exception(repo, mock_db_session):
    """Test aggregate stats returns defaults on error."""
    filters = FilterParams(name="test")

    mock_db_session.execute.side_effect = Exception("DB error")

    stats = await repo.get_aggregate_stats(filters)

    assert stats["total_count"] == 0
    assert stats["total_revenue"] == 0.0
    assert stats["by_organisasjonsform"] == []


@pytest.mark.asyncio
async def test_count_fast_estimate(repo, mock_db_session):
    """Test fast count uses pg_class estimate."""
    mock_db_session.execute.return_value.scalar.return_value = 1000000

    count = await repo.count(fast=True)

    assert count == 1000000


@pytest.mark.asyncio
async def test_count_fast_estimate_fallback(repo, mock_db_session):
    """Test fast count falls back when estimate fails."""
    mock_result_estimate = MagicMock()
    mock_result_estimate.scalar.side_effect = Exception("pg_class error")

    mock_result_actual = MagicMock()
    mock_result_actual.scalar.return_value = 500000

    mock_db_session.execute.side_effect = [mock_result_estimate, mock_result_actual]

    count = await repo.count(fast=True)

    assert count == 500000


@pytest.mark.asyncio
async def test_count_fast_estimate_fallback_trigger(repo, mock_db_session):
    """Test fast count falls back when view returns None."""
    mock_result_view = MagicMock()
    mock_result_view.scalar.return_value = None

    mock_result_estimate = MagicMock()
    mock_result_estimate.scalar.return_value = 100

    mock_db_session.execute.side_effect = [mock_result_view, mock_result_estimate]

    count = await repo.count(fast=True)

    assert count == 100


@pytest.mark.asyncio
async def test_get_new_companies_ytd_fallback(repo, mock_db_session):
    """Test new companies YTD falls back to query on error."""
    mock_result1 = MagicMock()
    mock_result1.scalar.side_effect = Exception("Table not found")

    mock_result2 = MagicMock()
    mock_result2.scalar.return_value = 500

    mock_db_session.execute.side_effect = [mock_result1, mock_result2]

    count = await repo.get_new_companies_ytd()

    assert count == 500


@pytest.mark.asyncio
async def test_get_bankruptcies_count_fallback(repo, mock_db_session):
    """Test bankruptcies count falls back on error."""
    mock_result1 = MagicMock()
    mock_result1.scalar.side_effect = Exception("Table not found")

    mock_result2 = MagicMock()
    mock_result2.scalar.return_value = 50

    mock_db_session.execute.side_effect = [mock_result1, mock_result2]

    count = await repo.get_bankruptcies_count()

    assert count == 50


@pytest.mark.asyncio
async def test_get_geocoded_count(repo, mock_db_session):
    """Test geocoded count."""
    mock_db_session.execute.return_value.scalar.return_value = 800000

    count = await repo.get_geocoded_count()

    assert count == 800000


@pytest.mark.asyncio
async def test_get_geocoded_count_error(repo, mock_db_session):
    """Test geocoded count returns 0 on error."""
    mock_db_session.execute.side_effect = Exception("DB error")

    count = await repo.get_geocoded_count()

    assert count == 0


@pytest.mark.asyncio
async def test_get_new_companies_30d(repo, mock_db_session):
    """Test new companies in last 30 days."""
    mock_db_session.execute.return_value.scalar.return_value = 1500

    count = await repo.get_new_companies_30d()

    assert count == 1500


@pytest.mark.asyncio
async def test_get_new_companies_30d_error(repo, mock_db_session):
    """Test new companies 30d returns 0 on error."""
    mock_db_session.execute.side_effect = Exception("DB error")

    count = await repo.get_new_companies_30d()

    assert count == 0


@pytest.mark.asyncio
async def test_get_aggregate_stats_materialized_view_error(repo, mock_db_session):
    """Test materialized view error falls back to regular query."""
    filters = FilterParams()

    # First call (MV) fails
    mock_result_stats = MagicMock()
    mock_result_stats.fetchone.return_value = (10, 500.0, 50.0, 20)

    # Side effect: Exception for first call, success for fallback queries
    mock_db_session.execute.side_effect = [
        Exception("MV not available"),
        mock_result_stats,
        MagicMock(fetchall=MagicMock(return_value=[("AS", 10)])),
    ]

    stats = await repo.get_aggregate_stats(filters)

    assert stats["total_count"] == 10
