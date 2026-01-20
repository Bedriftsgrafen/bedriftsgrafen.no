import pytest
from unittest.mock import MagicMock, AsyncMock
from repositories.company.lookups import LookupsMixin
from repositories.company_filter_builder import FilterParams
from sqlalchemy import Select


class MockRepository(LookupsMixin):
    def __init__(self, db):
        self.db = db


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    result_mock = MagicMock()
    result_mock.all.return_value = []
    session.execute.return_value = result_mock
    session.scalar.return_value = 0
    return session


@pytest.fixture
def repo(mock_db_session):
    return MockRepository(mock_db_session)


@pytest.mark.asyncio
async def test_get_map_markers_basic(repo, mock_db_session):
    filters = FilterParams(naeringskode="62")

    await repo.get_map_markers(filters=filters)

    # Verify execute was called with a Select object
    assert mock_db_session.execute.called
    args, kwargs = mock_db_session.execute.call_args
    query = args[0]
    assert isinstance(query, Select)

    # Verify scalar (for count) was called
    assert mock_db_session.scalar.called


@pytest.mark.asyncio
async def test_get_map_markers_with_bankruptcy(repo, mock_db_session):
    filters = FilterParams(is_bankrupt=True)

    await repo.get_map_markers(filters=filters)

    assert mock_db_session.execute.called
    args, _ = mock_db_session.execute.call_args
    query = str(args[0])
    # Should contain bankruptcy check (either konkurs = true or org_form = KBO)
    assert "konkurs" in query or "KBO" in query


@pytest.mark.asyncio
async def test_get_map_markers_with_revenue(repo, mock_db_session):
    filters = FilterParams(min_revenue=100.0)

    await repo.get_map_markers(filters=filters)

    assert mock_db_session.execute.called
    args, _ = mock_db_session.execute.call_args
    query = str(args[0])
    # Should contain join with latest_financials
    assert "latest_financials" in query
    assert "salgsinntekter" in query
