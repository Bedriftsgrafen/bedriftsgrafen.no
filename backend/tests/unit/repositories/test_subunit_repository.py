import pytest
from unittest.mock import MagicMock, AsyncMock
from repositories.subunit_repository import SubUnitRepository
import models


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
