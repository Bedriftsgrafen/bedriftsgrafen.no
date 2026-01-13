import pytest
from unittest.mock import AsyncMock, MagicMock
from repositories.company.queries import QueryMixin
from repositories.company_filter_builder import FilterParams
import models


# Helper class that uses the mixin
class MockRepository(QueryMixin):
    def __init__(self, db):
        self.db = db


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    session.execute.return_value = MagicMock()
    return session


@pytest.fixture
def repo(mock_db_session):
    return MockRepository(mock_db_session)


@pytest.mark.asyncio
async def test_get_all_simple(repo, mock_db_session):
    filters = FilterParams()

    # Mock return for _get_all_optimized
    # Phase 1: Orgnrs
    mock_db_session.execute.return_value.fetchall.return_value = [("123",)]

    # Phase 2: Companies
    mock_company = MagicMock(spec=models.Company)
    mock_company.orgnr = "123"

    mock_result_companies = MagicMock()
    mock_result_companies.unique.return_value.scalars.return_value.all.return_value = [mock_company]

    # Phase 3: Financials
    mock_result_fin = MagicMock()
    mock_result_fin.all.return_value = []  # No financial data for simple case

    # Mock database execute sequence
    # 1. Select Orgnrs
    # 2. Select Companies
    # 3. Select Financials
    mock_db_session.execute.side_effect = [
        MagicMock(fetchall=MagicMock(return_value=[("123",)])),
        mock_result_companies,
        mock_result_fin,
    ]

    result = await repo.get_all(filters, limit=10)

    assert len(result) == 1
    # CompanyWithFinancials copies attributes, does not hold a .company object
    assert result[0].orgnr == "123"
    assert mock_db_session.execute.call_count == 3


@pytest.mark.asyncio
async def test_get_all_with_financial_filter(repo, mock_db_session):
    filters = FilterParams(min_revenue=1000)

    # Should call _get_all_with_financial_join
    mock_row = MagicMock()
    mock_row.__getitem__.side_effect = lambda idx: [MagicMock(), 1000, 100, 100, 10][idx]

    # Mock result needs to be iterable yielding rows
    mock_result = MagicMock()
    mock_result.all.return_value = [mock_row]
    mock_db_session.execute.return_value = mock_result

    result = await repo.get_all(filters)

    assert len(result) == 1
    assert result[0].latest_revenue == 1000


@pytest.mark.asyncio
async def test_stream_all(repo, mock_db_session):
    filters = FilterParams()

    # Mock stream result
    mock_row = (MagicMock(), 100, 10, 10, 10)

    # Async iterator mock
    async def async_gen():
        yield mock_row

    mock_stream = MagicMock()
    mock_stream.__aiter__.side_effect = lambda: async_gen()

    mock_db_session.stream.return_value = mock_stream

    count = 0
    async for item in repo.stream_all(filters):
        count += 1
        assert item.latest_revenue == 100

    assert count == 1
