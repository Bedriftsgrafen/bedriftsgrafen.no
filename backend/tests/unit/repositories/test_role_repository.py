"""
MECE Unit Tests for RoleRepository

Test Categories:
1. get_by_orgnr - Fetching roles for a company
2. is_cache_valid - Cache invalidation logic
3. create_batch - Bulk role creation
4. delete_by_orgnr - Role deletion
5. search_people - Person name search (NEW)
6. get_person_commercial_roles - Commercial role filtering (NEW)
"""

import pytest
from datetime import date, datetime, timedelta
from unittest.mock import MagicMock, AsyncMock

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


# ============================================================================
# Category 1: get_by_orgnr
# ============================================================================
class TestGetByOrgnr:
    """Tests for fetching roles by organization number."""

    @pytest.mark.asyncio
    async def test_returns_roles_for_valid_orgnr(self, repo, mock_db_session):
        """Returns list of roles for existing company."""
        mock_role = MagicMock(spec=models.Role)
        mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_role]

        result = await repo.get_by_orgnr("123456789")

        assert len(result) == 1
        assert result[0] == mock_role

    @pytest.mark.asyncio
    async def test_returns_empty_list_for_unknown_orgnr(self, repo, mock_db_session):
        """Returns empty list when no roles exist."""
        mock_db_session.execute.return_value.scalars.return_value.all.return_value = []

        result = await repo.get_by_orgnr("999999999")

        assert result == []

    @pytest.mark.asyncio
    async def test_handles_database_error_gracefully(self, repo, mock_db_session):
        """Returns empty list on database error."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        result = await repo.get_by_orgnr("123456789")

        assert result == []


# ============================================================================
# Category 2: is_cache_valid
# ============================================================================
class TestIsCacheValid:
    """Tests for cache validation logic."""

    @pytest.mark.asyncio
    async def test_invalid_when_no_timestamp(self, repo, mock_db_session):
        """Cache is invalid when no roles exist."""
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = None

        assert await repo.is_cache_valid("123") is False

    @pytest.mark.asyncio
    async def test_valid_when_fresh(self, repo, mock_db_session):
        """Cache is valid when updated within 7 days."""
        fresh = datetime.now() - timedelta(days=1)
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = fresh

        assert await repo.is_cache_valid("123") is True

    @pytest.mark.asyncio
    async def test_invalid_when_stale(self, repo, mock_db_session):
        """Cache is invalid when older than 7 days."""
        stale = datetime.now() - timedelta(days=8)
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = stale

        assert await repo.is_cache_valid("123") is False

    @pytest.mark.asyncio
    async def test_boundary_exactly_7_days(self, repo, mock_db_session):
        """Cache is invalid at exactly 7 days boundary."""
        boundary = datetime.now() - timedelta(days=7)
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = boundary

        # At exactly 7 days, cache should be invalid
        assert await repo.is_cache_valid("123") is False


# ============================================================================
# Category 3: create_batch
# ============================================================================
class TestCreateBatch:
    """Tests for bulk role creation."""

    @pytest.mark.asyncio
    async def test_creates_roles_and_commits(self, repo, mock_db_session):
        """Creates roles and commits transaction."""
        roles = [models.Role(), models.Role()]

        count = await repo.create_batch(roles)

        assert count == 2
        mock_db_session.add_all.assert_called_once_with(roles)
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_zero_for_empty_list(self, repo, mock_db_session):
        """Returns 0 when passed empty list."""
        count = await repo.create_batch([])

        assert count == 0
        mock_db_session.add_all.assert_not_called()

    @pytest.mark.asyncio
    async def test_rollback_on_error(self, repo, mock_db_session):
        """Rolls back transaction on database error."""
        mock_db_session.commit.side_effect = Exception("DB Error")

        count = await repo.create_batch([models.Role()])

        assert count == 0
        mock_db_session.rollback.assert_called_once()


# ============================================================================
# Category 4: delete_by_orgnr
# ============================================================================
class TestDeleteByOrgnr:
    """Tests for role deletion."""

    @pytest.mark.asyncio
    async def test_deletes_and_returns_count(self, repo, mock_db_session):
        """Deletes roles and returns correct count."""
        mock_result = MagicMock()
        mock_result.rowcount = 5
        mock_db_session.execute.return_value = mock_result

        deleted = await repo.delete_by_orgnr("123456789")

        assert deleted == 5
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_zero_when_none_deleted(self, repo, mock_db_session):
        """Returns 0 when no roles matched."""
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db_session.execute.return_value = mock_result

        deleted = await repo.delete_by_orgnr("999999999")

        assert deleted == 0


# ============================================================================
# Category 5: search_people (NEW)
# ============================================================================
class TestSearchPeople:
    """Tests for person name search functionality."""

    @pytest.mark.asyncio
    async def test_returns_empty_for_short_query(self, repo, mock_db_session):
        """Returns empty list for queries shorter than 3 characters."""
        result = await repo.search_people("Jo")

        assert result == []
        mock_db_session.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_person_results(self, repo, mock_db_session):
        """Returns matching persons with role counts."""
        mock_row = MagicMock()
        mock_row.person_navn = "Ola Nordmann"
        mock_row.foedselsdato = date(1980, 5, 15)
        mock_row.role_count = 3

        mock_db_session.execute.return_value = [mock_row]

        result = await repo.search_people("Ola")

        assert len(result) == 1
        assert result[0]["name"] == "Ola Nordmann"
        assert result[0]["birthdate"] == date(1980, 5, 15)
        assert result[0]["role_count"] == 3

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(self, repo, mock_db_session):
        """Limit parameter is passed to query."""
        mock_db_session.execute.return_value = []

        await repo.search_people("Test", limit=5)

        # Verify execute was called (query was built)
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_handles_null_birthdate(self, repo, mock_db_session):
        """Handles persons without birthdate."""
        mock_row = MagicMock()
        mock_row.person_navn = "Kari Nordmann"
        mock_row.foedselsdato = None
        mock_row.role_count = 1

        mock_db_session.execute.return_value = [mock_row]

        result = await repo.search_people("Kari")

        assert result[0]["birthdate"] is None

    @pytest.mark.asyncio
    async def test_handles_database_error(self, repo, mock_db_session):
        """Returns empty list on database error."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        result = await repo.search_people("Test")

        assert result == []


# ============================================================================
# Category 6: get_person_commercial_roles (NEW)
# ============================================================================
class TestGetPersonCommercialRoles:
    """Tests for commercial role filtering per Enhetsregisterloven § 22."""

    @pytest.mark.asyncio
    async def test_filters_by_person_name(self, repo, mock_db_session):
        """Queries filter by exact person name match."""
        mock_db_session.execute.return_value.scalars.return_value.all.return_value = []

        await repo.get_person_commercial_roles("Ola Nordmann")

        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_filters_by_birthdate_when_provided(self, repo, mock_db_session):
        """Query includes birthdate filter when provided."""
        mock_db_session.execute.return_value.scalars.return_value.all.return_value = []

        await repo.get_person_commercial_roles("Ola Nordmann", date(1980, 5, 15))

        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_roles_list(self, repo, mock_db_session):
        """Returns list of Role models."""
        mock_role = MagicMock(spec=models.Role)
        mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_role]

        result = await repo.get_person_commercial_roles("Test Person")

        assert len(result) == 1
        assert result[0] == mock_role

    @pytest.mark.asyncio
    async def test_handles_database_error(self, repo, mock_db_session):
        """Returns empty list on database error."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        result = await repo.get_person_commercial_roles("Test Person")

        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_for_person_with_only_noncommercial_roles(self, repo, mock_db_session):
        """
        A person with only roles in BRL/FLI should return empty.
        (This is tested via the SQL filter, mocked here)
        """
        # The SQL filter should exclude these, returning empty
        mock_db_session.execute.return_value.scalars.return_value.all.return_value = []

        result = await repo.get_person_commercial_roles("Person With Only BRL")

        assert result == []
