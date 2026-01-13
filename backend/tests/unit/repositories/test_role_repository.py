import pytest
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime, timedelta
from repositories.role_repository import RoleRepository
import models


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    # Default to scalar returning None unless configured otherwise
    section_mock = MagicMock()
    section_mock.scalar_one_or_none.return_value = None
    section_mock.scalars.return_value.all.return_value = []
    session.execute.return_value = section_mock
    return session


@pytest.fixture
def repo(mock_db_session):
    return RoleRepository(mock_db_session)


@pytest.mark.asyncio
async def test_get_by_orgnr(repo, mock_db_session):
    # Mock roles
    mock_role = MagicMock(spec=models.Role)
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_role]

    result = await repo.get_by_orgnr("123")

    assert len(result) == 1
    assert result[0] == mock_role
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_is_cache_valid(repo, mock_db_session):
    # Case 1: No last updated (invalid)
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = None
    assert await repo.is_cache_valid("123") is False

    # Case 2: Fresh cache (< 7 days)
    fresh = datetime.now() - timedelta(days=1)
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = fresh
    assert await repo.is_cache_valid("123") is True

    # Case 3: Stale cache (> 7 days)
    stale = datetime.now() - timedelta(days=8)
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = stale
    assert await repo.is_cache_valid("123") is False


@pytest.mark.asyncio
async def test_create_batch(repo, mock_db_session):
    roles = [models.Role(), models.Role()]

    count = await repo.create_batch(roles)

    assert count == 2
    assert mock_db_session.add_all.called
    assert mock_db_session.commit.called


@pytest.mark.asyncio
async def test_delete_by_orgnr(repo, mock_db_session):
    # Mock rowcount
    mock_result = MagicMock()
    mock_result.rowcount = 5
    mock_db_session.execute.return_value = mock_result

    deleted = await repo.delete_by_orgnr("123")

    assert deleted == 5
    assert mock_db_session.execute.called
    assert mock_db_session.commit.called
