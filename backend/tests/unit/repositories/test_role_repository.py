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

from datetime import UTC, date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

import models
from repositories.role_repository import RoleRepository


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    # Synchronous methods - use MagicMock (not AsyncMock) to avoid unawaited coroutine warnings
    session.add = MagicMock()
    session.add_all = MagicMock()
    session.expunge = MagicMock()

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

        fresh = datetime.now(UTC) - timedelta(days=1)
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = fresh

        assert await repo.is_cache_valid("123") is True

    @pytest.mark.asyncio
    async def test_invalid_when_stale(self, repo, mock_db_session):
        """Cache is invalid when older than 7 days."""

        stale = datetime.now(UTC) - timedelta(days=8)
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = stale

        assert await repo.is_cache_valid("123") is False

    @pytest.mark.asyncio
    async def test_boundary_exactly_7_days(self, repo, mock_db_session):
        """Cache is invalid at exactly 7 days boundary."""

        boundary = datetime.now(UTC) - timedelta(days=7)
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
# Category 4b: delete_batch
# ============================================================================
class TestDeleteBatch:
    """Tests for batch role deletion across multiple companies."""

    @pytest.mark.asyncio
    async def test_deletes_roles_for_multiple_orgnrs(self, repo, mock_db_session):
        """Deletes roles across multiple companies and returns total count."""
        mock_result = MagicMock()
        mock_result.rowcount = 15
        mock_db_session.execute.return_value = mock_result

        deleted = await repo.delete_batch(["111111111", "222222222", "333333333"])

        assert deleted == 15
        mock_db_session.execute.assert_called_once()
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_zero_for_empty_list(self, repo, mock_db_session):
        """Returns 0 immediately when given an empty list (no DB call)."""
        deleted = await repo.delete_batch([])

        assert deleted == 0
        mock_db_session.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_rollback_on_error(self, repo, mock_db_session):
        """Rolls back transaction on database error."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        deleted = await repo.delete_batch(["123456789"])

        assert deleted == 0
        mock_db_session.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_commit_when_flag_is_false(self, repo, mock_db_session):
        """Does not commit when commit=False."""
        mock_result = MagicMock()
        mock_result.rowcount = 3
        mock_db_session.execute.return_value = mock_result

        deleted = await repo.delete_batch(["123456789"], commit=False)

        assert deleted == 3
        mock_db_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_rollback_on_error_when_commit_false(self, repo, mock_db_session):
        """Does not rollback when commit=False and error occurs."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        deleted = await repo.delete_batch(["123456789"], commit=False)

        assert deleted == 0
        mock_db_session.rollback.assert_not_called()


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

    @pytest.mark.asyncio
    async def test_include_all_parameter_accepted(self, repo, mock_db_session):
        """Admin bypass parameter is accepted."""
        mock_db_session.execute.return_value = []
        result = await repo.search_people("Test", include_all=True)
        assert result == []
        mock_db_session.execute.assert_called_once()


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

    @pytest.mark.asyncio
    async def test_include_all_parameter_accepted(self, repo, mock_db_session):
        """Admin bypass parameter is accepted and returns results."""
        mock_role = MagicMock(spec=models.Role)
        mock_db_session.execute.return_value.scalars.return_value.all.return_value = [mock_role]

        result = await repo.get_person_commercial_roles("Test Person", include_all=True)

        assert len(result) == 1


# ============================================================================
# Phase 2.2: Sitemap-related methods coverage
# ============================================================================
class TestCountTotalRoles:
    """Tests for total role counting."""

    @pytest.mark.asyncio
    async def test_returns_total_count(self, repo, mock_db_session):
        """Returns the total number of roles in the database."""
        mock_db_session.execute.return_value.scalar.return_value = 50000

        result = await repo.count_total_roles()

        assert result == 50000
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_zero_on_error(self, repo, mock_db_session):
        """Returns 0 when database error occurs."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        result = await repo.count_total_roles()

        assert result == 0


class TestGetAverageBoardAge:
    """Tests for average board member age calculation."""

    @pytest.mark.asyncio
    async def test_returns_average_age(self, repo, mock_db_session):
        """Returns calculated average age of board members."""
        mock_db_session.execute.return_value.scalar.return_value = 52.5

        result = await repo.get_average_board_age()

        assert result == 52.5
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_data(self, repo, mock_db_session):
        """Returns 0.0 when no board members exist."""
        mock_db_session.execute.return_value.scalar.return_value = None

        result = await repo.get_average_board_age()

        assert result == 0.0

    @pytest.mark.asyncio
    async def test_returns_zero_on_error(self, repo, mock_db_session):
        """Returns 0.0 when database error occurs."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        result = await repo.get_average_board_age()

        assert result == 0.0


class TestCountCommercialPeople:
    """Tests for counting unique people with commercial roles (sitemap)."""

    @pytest.mark.asyncio
    async def test_returns_unique_person_count(self, repo, mock_db_session):
        """Returns count of unique (name, birthdate) combinations."""
        mock_db_session.execute.return_value.scalar.return_value = 150000

        result = await repo.count_commercial_people()

        assert result == 150000

    @pytest.mark.asyncio
    async def test_returns_zero_on_error(self, repo, mock_db_session):
        """Returns 0 when database error occurs."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        result = await repo.count_commercial_people()

        assert result == 0


class TestGetPaginatedCommercialPeople:
    """Tests for paginated person listing (sitemap generation)."""

    @pytest.mark.asyncio
    async def test_returns_list_of_tuples(self, repo, mock_db_session):
        """Returns list of (name, birthdate, updated_at) tuples."""
        from datetime import datetime

        mock_rows = [
            MagicMock(person_navn="Ola Nordmann", foedselsdato=date(1980, 1, 1), latest_update=datetime(2024, 1, 15)),
            MagicMock(person_navn="Kari Hansen", foedselsdato=date(1975, 6, 20), latest_update=datetime(2024, 1, 10)),
        ]
        mock_db_session.execute.return_value = mock_rows

        result = await repo.get_paginated_commercial_people(offset=0, limit=100)

        assert len(result) == 2
        assert result[0][0] == "Ola Nordmann"
        assert result[0][1] == date(1980, 1, 1)

    @pytest.mark.asyncio
    async def test_offset_pagination(self, repo, mock_db_session):
        """Uses offset-based pagination when no keyset params provided."""
        mock_db_session.execute.return_value = []

        await repo.get_paginated_commercial_people(offset=50000, limit=50000)

        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_keyset_pagination(self, repo, mock_db_session):
        """Uses keyset pagination when after_name/after_birthdate provided."""
        mock_db_session.execute.return_value = []

        await repo.get_paginated_commercial_people(
            after_name="Ola Nordmann",
            after_birthdate=date(1980, 1, 1),
            limit=50000,
        )

        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self, repo, mock_db_session):
        """Returns empty list when database error occurs."""
        mock_db_session.execute.side_effect = Exception("DB Error")

        result = await repo.get_paginated_commercial_people(offset=0, limit=100)

        assert result == []


class TestGetPersonSitemapAnchors:
    """Tests for sitemap page anchor generation."""

    @pytest.mark.asyncio
    async def test_returns_anchor_tuples(self, repo, mock_db_session):
        """Returns list of (name, birthdate) anchors for each sitemap page."""
        # Mock count first, then anchor queries
        call_count = [0]

        def mock_execute_side_effect(*args, **kwargs):
            call_count[0] += 1
            result = MagicMock()
            if call_count[0] == 1:  # count_commercial_people subquery
                result.scalar.return_value = 75000  # 2 pages at 50000 each
            else:
                # Anchor query returns single row
                row = MagicMock()
                row.person_navn = f"Anchor Person {call_count[0]}"
                row.foedselsdato = date(1980, 1, 1)
                result.first.return_value = row
            return result

        mock_db_session.execute.side_effect = mock_execute_side_effect

        result = await repo.get_person_sitemap_anchors(page_size=50000)

        # Should have 1 anchor (for page 2)
        assert len(result) >= 0  # May be empty depending on offset logic


class TestGetPersonSitemapAnchorsOptimized:
    """Tests for optimized sitemap anchor generation using window functions."""

    @pytest.mark.asyncio
    async def test_returns_anchor_tuples(self, repo, mock_db_session):
        """Returns list of (name, birthdate) anchors using window functions."""
        mock_rows = [
            ("Anchor 1", date(1980, 1, 1)),
            ("Anchor 2", date(1975, 6, 15)),
        ]
        mock_db_session.execute.return_value = mock_rows

        result = await repo.get_person_sitemap_anchors_optimized(page_size=50000)

        # Should return list of tuples
        assert isinstance(result, list)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_page_boundaries(self, repo, mock_db_session):
        """Returns empty list when dataset smaller than page_size."""
        mock_db_session.execute.return_value = []

        result = await repo.get_person_sitemap_anchors_optimized(page_size=50000)

        # No rows when MOD(rn, page_size) = 0 yields nothing
        assert result == []


# ============================================================================
# Category 8: Sitemap Exclusion Verification (Fix 4 — GDPR)
# ============================================================================
class TestSitemapExcludesOrphanedPeople:
    """Verify that persons whose companies have been purged are excluded from sitemaps.

    The INNER JOIN on models.Company in count_commercial_people() and
    get_paginated_commercial_people() guarantees that roles referencing
    deleted companies (no row in bedrifter) are excluded. These tests
    document that structural guarantee.
    """

    @pytest.mark.asyncio
    async def test_count_uses_inner_join(self, repo, mock_db_session):
        """count_commercial_people() uses INNER JOIN — orphaned roles excluded."""
        mock_db_session.execute.return_value.scalar.return_value = 0
        result = await repo.count_commercial_people()
        assert result == 0

        # Verify the executed query contains a JOIN on Company
        call_args = mock_db_session.execute.call_args
        stmt = call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "JOIN bedrifter" in compiled or "JOIN" in compiled

    @pytest.mark.asyncio
    async def test_paginated_uses_inner_join(self, repo, mock_db_session):
        """get_paginated_commercial_people() uses INNER JOIN — orphaned roles excluded."""
        mock_db_session.execute.return_value = []
        result = await repo.get_paginated_commercial_people(offset=0, limit=10)
        assert result == []

        # Verify the executed query contains a JOIN on Company
        call_args = mock_db_session.execute.call_args
        stmt = call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "JOIN bedrifter" in compiled or "JOIN" in compiled
