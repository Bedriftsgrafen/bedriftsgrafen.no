import pytest
from unittest.mock import MagicMock, AsyncMock, call
from sqlalchemy import select, func
from repositories.stats_repository import StatsRepository
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
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_stats
    
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
    
    result = await repo.get_municipality_stats(
        models.MunicipalityStats.company_count, 
        nace="01", 
        county_code="30"
    )
    
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
    mock_db_session.execute.return_value.scalar.return_value = None # No latest year
    result = await repo.get_municipality_populations() # Should return empty list
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
