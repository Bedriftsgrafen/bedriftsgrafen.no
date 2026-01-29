import pytest
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.sql.elements import TextClause
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
    assert mock_db_session.execute.call_count == 2
    assert mock_db_session.commit.called


@pytest.mark.asyncio
async def test_create_or_update_acquires_advisory_lock(repo, mock_db_session):
    company_data = {"organisasjonsnummer": "123456789", "navn": "Test AS"}

    await repo.create_or_update(company_data, autocommit=False)

    first_stmt = mock_db_session.execute.call_args_list[0].args[0]
    assert isinstance(first_stmt, TextClause)
    assert "pg_advisory_xact_lock" in first_stmt.text


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

    advisory_result = MagicMock()
    success_result = MagicMock()
    success_result.scalar_one.return_value = MagicMock(spec=models.Company)

    mock_db_session.execute.side_effect = [advisory_result, deadlock_error, advisory_result, success_result]

    company_data = {"organisasjonsnummer": "123456789", "navn": "Test AS"}

    result = await repo.create_or_update(company_data, autocommit=False)

    assert result is not None
    assert mock_db_session.execute.call_count == 4
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


@pytest.mark.asyncio
async def test_update_last_polled_roles(repo, mock_db_session):
    await repo.update_last_polled_roles("123")

    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_update_coordinates_error(repo, mock_db_session):
    """Test update_coordinates handles errors correctly."""
    from exceptions import DatabaseException

    mock_db_session.execute.side_effect = Exception("DB error")

    with pytest.raises(DatabaseException):
        await repo.update_coordinates("123", 59.9, 10.7)

    mock_db_session.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_parse_company_fields_complete(repo):
    """Test _parse_company_fields with complete data."""
    company_data = {
        "navn": "Test AS",
        "stiftelsesdato": "2020-01-15",
        "organisasjonsform": {"kode": "AS"},
        "naeringskode1": {"kode": "62.010"},
        "antallAnsatte": 10,
        "konkurs": False,
        "konkursdato": "2023-06-01",
        "underAvvikling": False,
        "underTvangsavvikling": False,
        "registrertIMvaregisteret": True,
        "registrertIFrivillighetsregisteret": False,
        "registrertIStiftelsesregisteret": False,
        "registrertIPartiregisteret": False,
        "registrertIForetaksregisteret": "Ja",
        "vedtektsfestetFormaal": ["Purpose 1", "Purpose 2"],
        "hjemmeside": "https://test.no",
        "registreringsdatoEnhetsregisteret": "2020-01-20",
        "registreringsdatoForetaksregisteret": "2020-01-25",
    }

    result = repo._parse_company_fields(company_data)

    assert result["navn"] == "Test AS"
    assert result["organisasjonsform"] == "AS"
    assert result["naeringskode"] == "62.010"
    assert result["stiftelsesdato"].year == 2020
    assert result["konkursdato"].year == 2023
    assert result["registrert_i_mvaregisteret"] is True
    assert result["registrert_i_foretaksregisteret"] is True
    assert "Purpose 1" in result["vedtektsfestet_formaal"]


@pytest.mark.asyncio
async def test_parse_company_fields_invalid_dates(repo):
    """Test _parse_company_fields handles invalid dates."""
    company_data = {
        "navn": "Test AS",
        "stiftelsesdato": "invalid-date",
        "konkursdato": "also-invalid",
        "registreringsdatoEnhetsregisteret": "bad-date",
    }

    result = repo._parse_company_fields(company_data)

    assert result["stiftelsesdato"] is None
    assert result["konkursdato"] is None


@pytest.mark.asyncio
async def test_parse_company_fields_empty_org_form(repo):
    """Test _parse_company_fields handles empty org form."""
    company_data = {
        "navn": "Test AS",
        "organisasjonsform": {"kode": ""},
    }

    result = repo._parse_company_fields(company_data)

    assert result["organisasjonsform"] is None


@pytest.mark.asyncio
async def test_parse_company_fields_string_formaal(repo):
    """Test _parse_company_fields handles string vedtektsfestetFormaal."""
    company_data = {
        "navn": "Test AS",
        "vedtektsfestetFormaal": "Single purpose string",
    }

    result = repo._parse_company_fields(company_data)

    assert result["vedtektsfestet_formaal"] == "Single purpose string"


@pytest.mark.asyncio
async def test_parse_company_fields_foretaksreg_bool(repo):
    """Test _parse_company_fields handles bool registrertIForetaksregisteret."""
    company_data = {
        "navn": "Test AS",
        "registrertIForetaksregisteret": True,
    }

    result = repo._parse_company_fields(company_data)

    assert result["registrert_i_foretaksregisteret"] is True


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
