import pytest
from unittest.mock import MagicMock, AsyncMock, ANY
from repositories.system_repository import SystemRepository

@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    return session

@pytest.fixture
def repo(mock_db_session):
    return SystemRepository(mock_db_session)

@pytest.mark.asyncio
async def test_ensure_state_table(repo, mock_db_session):
    await repo.ensure_state_table()
    # Verify execute called with CREATE TABLE SQL
    assert mock_db_session.execute.called
    assert "CREATE TABLE IF NOT EXISTS system_state" in str(mock_db_session.execute.call_args[0][0])
    assert mock_db_session.commit.called

@pytest.mark.asyncio
async def test_get_state_found(repo, mock_db_session):
    # Mock result fetchone
    mock_result = MagicMock()
    mock_result.fetchone.return_value = ("some_value",)
    mock_db_session.execute.return_value = mock_result
    
    value = await repo.get_state("my_key")
    
    assert value == "some_value"
    # Verify parameter binding
    # SQLAlchemy execute(statement, params) - params is positional (args[1]) or kwarg
    args, kwargs = mock_db_session.execute.call_args
    assert {"key": "my_key"} in args or kwargs.get("params") == {"key": "my_key"} or (len(args) > 1 and args[1] == {"key": "my_key"})

@pytest.mark.asyncio
async def test_get_state_not_found(repo, mock_db_session):
    mock_result = MagicMock()
    mock_result.fetchone.return_value = None
    mock_db_session.execute.return_value = mock_result
    
    value = await repo.get_state("missing_key")
    assert value is None

@pytest.mark.asyncio
async def test_set_state(repo, mock_db_session):
    await repo.set_state("key1", "val1")
    
    assert mock_db_session.execute.called
    # Check SQL contains upsert logic
    sql = str(mock_db_session.execute.call_args[0][0])
    assert "INSERT INTO system_state" in sql
    assert "ON CONFLICT (key) DO UPDATE" in sql
    assert mock_db_session.commit.called
