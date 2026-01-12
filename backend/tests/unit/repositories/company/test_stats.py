import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy import text
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
    filters = FilterParams(name="Test") # Forces non-optimized path
    mock_db_session.execute.return_value.scalar.return_value = 5
    
    count = await repo.count_companies(filters)
    
    assert count == 5

@pytest.mark.asyncio
async def test_get_aggregate_stats_materialized_view(repo, mock_db_session):
    filters = FilterParams()
    
    # Mock row for SELECT * FROM company_totals
    mock_row_totals = (100, 1000.0, 100.0, 50)
    # Mock rows for orgform breakdown
    mock_rows_breakdown = [("AS", 50), ("ENK", 50)]
    
    # Side effects for execute
    mock_result_totals = MagicMock()
    mock_result_totals.fetchone.return_value = mock_row_totals
    
    mock_result_breakdown = MagicMock()
    mock_result_breakdown.fetchall.return_value = mock_rows_breakdown
    
    # Using AsyncMock side_effect is tricky for execute if it's called multiple times.
    # Logic: 1. totals, 2. breakdown
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
