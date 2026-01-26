import pytest
from unittest.mock import MagicMock, AsyncMock
from repositories.company.crud import CrudMixin
import models
from sqlalchemy.exc import DBAPIError


class MockRepository(CrudMixin):
    def __init__(self, db):
        self.db = db


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    session.execute.return_value = MagicMock()
    # Mock returning object
    session.execute.return_value.scalar_one.return_value = MagicMock(spec=models.Company)
    return session


@pytest.fixture
def repo(mock_db_session):
    return MockRepository(mock_db_session)


@pytest.mark.asyncio
async def test_create_or_update_success(repo, mock_db_session):
    company_data = {"organisasjonsnummer": "123456789", "navn": "Test AS", "postadresse": {}, "forretningsadresse": {}}

    result = await repo.create_or_update(company_data, autocommit=True)

    assert result is not None
    assert mock_db_session.execute.called
    assert mock_db_session.commit.called


@pytest.mark.asyncio
async def test_create_or_update_db_error(repo, mock_db_session):
    mock_db_session.execute.side_effect = Exception("DB Error")
    company_data = {"organisasjonsnummer": "123"}

    # Should raise exception wrapped in DatabaseException
    # Note: exception handling in crud.py wraps it
    from exceptions import DatabaseException

    with pytest.raises(DatabaseException):
        await repo.create_or_update(company_data, autocommit=True)

    assert mock_db_session.rollback.called


@pytest.mark.asyncio
async def test_create_or_update_retries_deadlock(repo, mock_db_session):
    class FakeOrig:
        sqlstate = "40P01"

    deadlock_error = DBAPIError("stmt", {}, FakeOrig(), False)

    success_result = MagicMock()
    success_result.scalar_one.return_value = MagicMock(spec=models.Company)

    mock_db_session.execute.side_effect = [deadlock_error, success_result]

    company_data = {"organisasjonsnummer": "123456789", "navn": "Test AS"}

    result = await repo.create_or_update(company_data, autocommit=False)

    assert result is not None
    assert mock_db_session.execute.call_count == 2
    assert mock_db_session.rollback.called


@pytest.mark.asyncio
async def test_update_coordinates(repo, mock_db_session):
    await repo.update_coordinates("123", 59.9, 10.7)

    # Verify execute called with update statement
    assert mock_db_session.execute.called
    assert mock_db_session.commit.called


@pytest.mark.asyncio
async def test_update_last_polled_regnskap(repo, mock_db_session):
    await repo.update_last_polled_regnskap("123")

    assert mock_db_session.execute.called
    # No auto commit in this method
    assert not mock_db_session.commit.called


def test_parse_company_fields(repo):
    # Test normalization logic
    data = {
        "navn": "Test",
        "stiftelsesdato": "2023-01-01",
        "konkursdato": "invalid-date",  # Check gracefulness
        "organisasjonsform": {"kode": "AS"},
    }

    fields = repo._parse_company_fields(data)

    assert fields["navn"] == "Test"
    assert str(fields["stiftelsesdato"]) == "2023-01-01"
    assert fields["konkursdato"] is None
    assert fields["organisasjonsform"] == "AS"
