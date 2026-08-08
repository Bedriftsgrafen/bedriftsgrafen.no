from datetime import UTC, date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

import models
from repositories.subunit_repository import SubUnitRepository


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    section_mock = MagicMock()
    section_mock.scalars.return_value.all.return_value = []
    section_mock.scalar_one_or_none.return_value = None
    session.execute.return_value = section_mock
    # Merge shouldn't be async by default in mock unless called as async, but add_all/commit are.
    # Use standard AsyncMock structure for session methods
    return session


@pytest.fixture
def repo(mock_db_session):
    return SubUnitRepository(mock_db_session)


@pytest.mark.asyncio
async def test_get_by_parent_orgnr(repo, mock_db_session):
    mock_unit = MagicMock(spec=models.SubUnit)
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_unit]

    units = await repo.get_by_parent_orgnr("parent1")

    assert len(units) == 1
    assert units[0] == mock_unit


@pytest.mark.asyncio
async def test_get_refresh_timestamp_uses_last_polled_marker(repo, mock_db_session):
    row_result = MagicMock()
    row_result.scalar_one_or_none.return_value = None
    marker = datetime.now(UTC)
    marker_result = MagicMock()
    marker_result.scalar_one_or_none.return_value = marker
    mock_db_session.execute.side_effect = [row_result, marker_result]

    result = await repo.get_refresh_timestamp("999999999")

    assert result == marker


@pytest.mark.asyncio
async def test_is_cache_valid_uses_configured_ttl(repo, mock_db_session):
    row_result = MagicMock()
    row_result.scalar_one_or_none.return_value = datetime.now(UTC) - timedelta(seconds=10)
    marker_result = MagicMock()
    marker_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.side_effect = [row_result, marker_result]

    assert await repo.is_cache_valid("999999999", ttl_seconds=60) is True


@pytest.mark.asyncio
async def test_is_cache_invalid_without_row_or_marker(repo, mock_db_session):
    row_result = MagicMock()
    row_result.scalar_one_or_none.return_value = None
    marker_result = MagicMock()
    marker_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.side_effect = [row_result, marker_result]

    assert await repo.is_cache_valid("999999999", ttl_seconds=60) is False


@pytest.mark.asyncio
async def test_parent_company_exists(repo, mock_db_session):
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = "999999999"

    assert await repo.parent_company_exists("999999999") is True


@pytest.mark.asyncio
async def test_parent_company_exists_fails_closed_on_db_error(repo, mock_db_session):
    mock_db_session.execute.side_effect = Exception("DB error")

    assert await repo.parent_company_exists("999999999") is False


@pytest.mark.asyncio
async def test_mark_cache_refreshed_updates_parent_marker(repo, mock_db_session):
    mock_db_session.execute.return_value.rowcount = 1

    updated = await repo.mark_cache_refreshed("999999999")

    assert updated == 1
    stmt = mock_db_session.execute.await_args.args[0]
    compiled = str(stmt.compile(dialect=postgresql.dialect()))
    assert "last_polled_subunits" in compiled
    mock_db_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_get_by_orgnr(repo, mock_db_session):
    mock_unit = MagicMock(spec=models.SubUnit)
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_unit

    result = await repo.get_by_orgnr("unit1")

    assert result == mock_unit


@pytest.mark.asyncio
async def test_create_batch(repo, mock_db_session):
    # Subunits must have parent_orgnr to pass the filter in create_batch
    unit1 = models.SubUnit()
    unit1.orgnr = "111111111"
    unit1.navn = "Test Unit 1"
    unit1.parent_orgnr = "999999999"

    unit2 = models.SubUnit()
    unit2.orgnr = "222222222"
    unit2.navn = "Test Unit 2"
    unit2.parent_orgnr = "999999999"

    units = [unit1, unit2]

    count = await repo.create_batch(units)

    assert count == 2
    assert mock_db_session.execute.called
    assert mock_db_session.commit.called


@pytest.mark.asyncio
async def test_create_batch_with_duplicates(repo, mock_db_session):
    # Test that duplicate orgnrs are deduplicated before insert
    unit1 = models.SubUnit()
    unit1.orgnr = "111111111"
    unit1.navn = "Test Unit 1"
    unit1.parent_orgnr = "999999999"

    unit2 = models.SubUnit()
    unit2.orgnr = "111111111"  # Same orgnr as unit1
    unit2.navn = "Test Unit 1 Updated"
    unit2.parent_orgnr = "999999999"

    units = [unit1, unit2]

    # Should not raise CardinalityViolationError because we deduplicate in create_batch
    count = await repo.create_batch(units)

    # Should return 1 because the input had two items but they were for the same orgnr
    assert count == 1
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_create_batch_preserves_source_fields(repo, mock_db_session):
    unit = models.SubUnit()
    unit.orgnr = "111111111"
    unit.navn = "Test Unit"
    unit.parent_orgnr = "999999999"
    unit.registreringsdato_enhetsregisteret = date(2024, 1, 2)
    unit.raw_data = {"organisasjonsnummer": "111111111", "registreringsdatoEnhetsregisteret": "2024-01-02"}

    count = await repo.create_batch([unit])

    assert count == 1
    stmt = mock_db_session.execute.await_args.args[0]
    compiled = str(stmt.compile(dialect=postgresql.dialect()))
    assert "registreringsdato_enhetsregisteret" in compiled
    assert "data" in compiled


@pytest.mark.asyncio
async def test_search_by_name(repo, mock_db_session):
    # Mock search result
    mock_unit = MagicMock(spec=models.SubUnit)
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_unit]

    # Valid search
    result = await repo.search_by_name("TestUnit")
    assert len(result) == 1
    assert mock_db_session.execute.called

    # Invalid search (too short)
    result = await repo.search_by_name("A")
    assert len(result) == 0


@pytest.mark.asyncio
async def test_create_batch_empty_after_filter(repo, mock_db_session):
    # Test that empty list is returned when all subunits lack parent_orgnr
    unit1 = models.SubUnit()
    unit1.orgnr = "111111111"
    unit1.navn = "Test Unit 1"
    unit1.parent_orgnr = None  # Missing parent

    count = await repo.create_batch([unit1])

    # Should return 0 and not call execute
    assert count == 0
    assert not mock_db_session.execute.called


@pytest.mark.asyncio
async def test_create_batch_mixed_duplicates(repo, mock_db_session):
    # Test mixed scenario: some unique, some duplicates
    unit1 = models.SubUnit()
    unit1.orgnr = "111111111"
    unit1.navn = "Test Unit 1"
    unit1.parent_orgnr = "999999999"

    unit2 = models.SubUnit()
    unit2.orgnr = "222222222"
    unit2.navn = "Test Unit 2"
    unit2.parent_orgnr = "999999999"

    unit3 = models.SubUnit()
    unit3.orgnr = "111111111"  # Duplicate of unit1
    unit3.navn = "Test Unit 1 Updated"
    unit3.parent_orgnr = "999999999"

    units = [unit1, unit2, unit3]

    count = await repo.create_batch(units)

    # Should return 2 (deduplicated from 3)
    assert count == 2
    assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_count_by_parent(repo, mock_db_session):
    mock_db_session.execute.return_value.scalar_one.return_value = 3
    count = await repo.count_by_parent("parent1")
    assert count == 3


@pytest.mark.asyncio
async def test_count_by_parent_error(repo, mock_db_session):
    """Should return 0 on error."""
    mock_db_session.execute.side_effect = Exception("DB error")
    count = await repo.count_by_parent("parent1")
    assert count == 0


@pytest.mark.asyncio
async def test_delete_by_parent_orgnr(repo, mock_db_session):
    """Should delete all subunits for a parent and return count."""
    mock_db_session.execute.return_value.rowcount = 5

    deleted = await repo.delete_by_parent_orgnr("999999999")

    assert deleted == 5
    mock_db_session.execute.assert_called_once()
    mock_db_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_delete_by_parent_orgnr_error(repo, mock_db_session):
    """Should return 0 and rollback on error."""
    mock_db_session.execute.side_effect = Exception("DB error")

    deleted = await repo.delete_by_parent_orgnr("999999999")

    assert deleted == 0
    mock_db_session.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_delete_by_parent_orgnr_no_commit(repo, mock_db_session):
    """Should not commit when commit=False."""
    mock_db_session.execute.return_value.rowcount = 3

    deleted = await repo.delete_by_parent_orgnr("999999999", commit=False)

    assert deleted == 3
    mock_db_session.commit.assert_not_called()


@pytest.mark.asyncio
async def test_get_existing_orgnrs(repo, mock_db_session):
    """Should return set of existing orgnrs."""
    mock_db_session.execute.return_value.fetchall.return_value = [("111",), ("222",)]

    result = await repo.get_existing_orgnrs(["111", "222", "333"])

    assert result == {"111", "222"}


@pytest.mark.asyncio
async def test_get_existing_orgnrs_empty_input(repo, mock_db_session):
    """Should return empty set for empty input."""
    result = await repo.get_existing_orgnrs([])

    assert result == set()
    mock_db_session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_get_existing_orgnrs_error(repo, mock_db_session):
    """Should return empty set on error."""
    mock_db_session.execute.side_effect = Exception("DB error")

    result = await repo.get_existing_orgnrs(["111", "222"])

    assert result == set()


@pytest.mark.asyncio
async def test_get_by_parent_orgnr_error(repo, mock_db_session):
    """Should return empty list on error."""
    mock_db_session.execute.side_effect = Exception("DB error")

    result = await repo.get_by_parent_orgnr("999999999")

    assert result == []


@pytest.mark.asyncio
async def test_get_by_orgnr_error(repo, mock_db_session):
    """Should return None on error."""
    mock_db_session.execute.side_effect = Exception("DB error")

    result = await repo.get_by_orgnr("111111111")

    assert result is None


@pytest.mark.asyncio
async def test_search_by_name_error(repo, mock_db_session):
    """Should return empty list on error."""
    mock_db_session.execute.side_effect = Exception("DB error")

    result = await repo.search_by_name("Test")

    assert result == []


@pytest.mark.asyncio
async def test_search_by_name_empty_query(repo, mock_db_session):
    """Should return empty list for empty query."""
    result = await repo.search_by_name("")

    assert result == []
    mock_db_session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_search_by_name_limits_results(repo, mock_db_session):
    """Should cap results at 500."""
    mock_db_session.execute.return_value.scalars.return_value.all.return_value = []

    # Request more than max
    await repo.search_by_name("Test", limit=1000)

    # Verify execute was called (limit is enforced internally)
    mock_db_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_create_batch_empty_input(repo, mock_db_session):
    """Should return 0 for empty input."""
    count = await repo.create_batch([])

    assert count == 0
    mock_db_session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_create_batch_error(repo, mock_db_session):
    """Should return 0 and rollback on error."""
    unit = models.SubUnit()
    unit.orgnr = "111111111"
    unit.navn = "Test"
    unit.parent_orgnr = "999999999"

    mock_db_session.execute.side_effect = Exception("DB error")

    count = await repo.create_batch([unit])

    assert count == 0
    mock_db_session.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_create_batch_no_commit(repo, mock_db_session):
    """Should not commit when commit=False."""
    unit = models.SubUnit()
    unit.orgnr = "111111111"
    unit.navn = "Test"
    unit.parent_orgnr = "999999999"

    count = await repo.create_batch([unit], commit=False)

    assert count == 1
    mock_db_session.commit.assert_not_called()
