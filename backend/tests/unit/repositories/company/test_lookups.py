"""
Unit tests for company lookups repository.

Tests get_by_orgnr, get_similar_companies, get_by_industry_code, get_existing_orgnrs.
Follows AAA pattern (Arrange - Act - Assert).
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from exceptions import CompanyNotFoundException, DatabaseException
from repositories.company.lookups import LookupsMixin, _build_similar_sql


class MockLookupsRepo(LookupsMixin):
    """Concrete implementation of LookupsMixin for testing."""

    def __init__(self, db):
        self.db = db


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def lookups_repo(mock_db):
    return MockLookupsRepo(mock_db)


class TestGetByOrgnr:
    """Tests for get_by_orgnr method."""

    @pytest.mark.asyncio
    async def test_returns_company_when_found(self, lookups_repo, mock_db):
        """Should return company when orgnr exists."""
        # Arrange
        mock_company = MagicMock()
        mock_company.orgnr = "123456789"
        mock_company.navn = "Test AS"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_company
        mock_db.execute.return_value = mock_result

        # Act
        result = await lookups_repo.get_by_orgnr("123456789")

        # Assert
        assert result.orgnr == "123456789"
        assert result.navn == "Test AS"

    @pytest.mark.asyncio
    async def test_raises_not_found_when_missing(self, lookups_repo, mock_db):
        """Should raise CompanyNotFoundException when orgnr doesn't exist."""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(CompanyNotFoundException):
            await lookups_repo.get_by_orgnr("999999999")

    @pytest.mark.asyncio
    async def test_raises_database_exception_on_error(self, lookups_repo, mock_db):
        """Should raise DatabaseException on database errors."""
        # Arrange
        mock_db.execute.side_effect = Exception("DB connection failed")

        # Act & Assert
        with pytest.raises(DatabaseException):
            await lookups_repo.get_by_orgnr("123456789")


class TestGetCompanyName:
    """Tests for get_company_name method."""

    @pytest.mark.asyncio
    async def test_returns_name_from_company_table(self, lookups_repo, mock_db):
        """Should return name when found in company table."""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = "Test AS"
        mock_db.execute.return_value = mock_result

        # Act
        result = await lookups_repo.get_company_name("123456789")

        # Assert
        assert result == "Test AS"

    @pytest.mark.asyncio
    async def test_falls_back_to_subunit_table(self, lookups_repo, mock_db):
        """Should fall back to subunit table if not found in company table."""
        # Arrange
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = None
        mock_result2 = MagicMock()
        mock_result2.scalar_one_or_none.return_value = "SubUnit Name"
        mock_db.execute.side_effect = [mock_result1, mock_result2]

        # Act
        result = await lookups_repo.get_company_name("123456789")

        # Assert
        assert result == "SubUnit Name"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, lookups_repo, mock_db):
        """Should return None when not found in either table."""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Act
        result = await lookups_repo.get_company_name("999999999")

        # Assert
        assert result is None


class TestGetExistingOrgnrs:
    """Tests for get_existing_orgnrs method."""

    @pytest.mark.asyncio
    async def test_returns_existing_orgnrs(self, lookups_repo, mock_db):
        """Should return set of existing orgnrs."""
        # Arrange
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("111111111",), ("222222222",)]
        mock_db.execute.return_value = mock_result

        # Act
        result = await lookups_repo.get_existing_orgnrs(["111111111", "222222222", "333333333"])

        # Assert
        assert result == {"111111111", "222222222"}

    @pytest.mark.asyncio
    async def test_returns_empty_set_for_empty_input(self, lookups_repo, mock_db):
        """Should return empty set for empty input."""
        # Act
        result = await lookups_repo.get_existing_orgnrs([])

        # Assert
        assert result == set()
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_empty_set_on_error(self, lookups_repo, mock_db):
        """Should return empty set on database error."""
        # Arrange
        mock_db.execute.side_effect = Exception("DB error")

        # Act
        result = await lookups_repo.get_existing_orgnrs(["123456789"])

        # Assert
        assert result == set()


class TestGetSimilarCompanies:
    """Tests for get_similar_companies method."""

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_source_not_found(self, lookups_repo, mock_db):
        """Should return empty list when source company has no naeringskode."""
        # Arrange
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        mock_db.execute.return_value = mock_result

        # Act
        result = await lookups_repo.get_similar_companies("123456789", limit=5)

        # Assert
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_source_has_no_naeringskode(self, lookups_repo, mock_db):
        """Should return empty list when source company has no naeringskode."""
        # Arrange: source query returns row with None naeringskode (tuple index 0)
        mock_source_result = MagicMock()
        mock_source_result.fetchone.return_value = (None, None, None)
        mock_db.execute.return_value = mock_source_result

        # Act
        result = await lookups_repo.get_similar_companies("123456789", limit=5)

        # Assert
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_similar_companies_two_step_query(self, lookups_repo, mock_db):
        """Should execute source query then candidates query with literal params.

        The new two-step approach fetches naeringskode/kommune/postnummer first,
        then passes them as literals so PostgreSQL can use partial indexes.
        """
        # Arrange: step 1 - source row
        mock_source = MagicMock()
        mock_source.fetchone.return_value = ("62.010", "OSLO", "0150")

        # step 2 - candidates orgnrs
        mock_candidates = MagicMock()
        mock_candidates.fetchall.return_value = [("111111111",), ("222222222",)]

        # step 3 - full company objects
        mock_company1 = MagicMock()
        mock_company1.orgnr = "111111111"
        mock_company2 = MagicMock()
        mock_company2.orgnr = "222222222"
        mock_companies = MagicMock()
        mock_companies.all.return_value = [
            (mock_company1, 1000, 100, 50, 0.05, 0.30),
            (mock_company2, 2000, 200, 100, 0.05, 0.35),
        ]

        mock_db.execute.side_effect = [mock_source, mock_candidates, mock_companies]

        # Act
        result = await lookups_repo.get_similar_companies("123456789", limit=5)

        # Assert: two companies returned in candidates order
        assert len(result) == 2
        assert result[0].orgnr == "111111111"
        assert result[1].orgnr == "222222222"
        # Three execute calls: source lookup + candidates query + company fetch
        assert mock_db.execute.call_count == 3

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_candidates_found(self, lookups_repo, mock_db):
        """Should return empty list when candidates query returns no matches."""
        # Arrange: valid source, no candidate matches
        mock_source = MagicMock()
        mock_source.fetchone.return_value = ("99.999", "OSLO", "0150")
        mock_candidates = MagicMock()
        mock_candidates.fetchall.return_value = []

        mock_db.execute.side_effect = [mock_source, mock_candidates]

        # Act
        result = await lookups_repo.get_similar_companies("123456789", limit=5)

        # Assert
        assert result == []
        # Only source + candidates queries — company fetch is skipped
        assert mock_db.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_uses_kommune_only_sql_when_no_postnummer(self, lookups_repo, mock_db):
        """Should use kommune-only SQL variant when source has no postnummer.

        The no-postnummer branch uses priorities 2 (naeringskode+kommune),
        3 (prefix+kommune), 4 (prefix) — omitting priority 1 (postnummer)
        to avoid passing a None bind param to asyncpg.
        """
        # Arrange: source has kommune but no postnummer
        mock_source = MagicMock()
        mock_source.fetchone.return_value = ("62.010", "OSLO", None)

        mock_candidates = MagicMock()
        mock_candidates.fetchall.return_value = [("111111111",)]

        mock_company = MagicMock()
        mock_company.orgnr = "111111111"
        mock_companies = MagicMock()
        mock_companies.all.return_value = [(mock_company, 1000, 100, 50, 0.05, 0.30)]

        mock_db.execute.side_effect = [mock_source, mock_candidates, mock_companies]

        # Act
        result = await lookups_repo.get_similar_companies("123456789", limit=5)

        # Assert: returns candidate despite no postnummer
        assert len(result) == 1
        assert result[0].orgnr == "111111111"
        assert mock_db.execute.call_count == 3

    @pytest.mark.asyncio
    async def test_uses_postnummer_only_sql_when_no_kommune(self, lookups_repo, mock_db):
        """Should use postnummer-only SQL variant when source has no kommune.

        The no-kommune branch uses priorities 1 (postnummer) and 4 (prefix)
        only, omitting kommune-dependent priorities 2 and 3.
        """
        # Arrange: source has postnummer but no kommune
        mock_source = MagicMock()
        mock_source.fetchone.return_value = ("62.010", None, "0150")

        mock_candidates = MagicMock()
        mock_candidates.fetchall.return_value = [("222222222",)]

        mock_company = MagicMock()
        mock_company.orgnr = "222222222"
        mock_companies = MagicMock()
        mock_companies.all.return_value = [(mock_company, 2000, 200, 100, 0.05, 0.35)]

        mock_db.execute.side_effect = [mock_source, mock_candidates, mock_companies]

        # Act
        result = await lookups_repo.get_similar_companies("123456789", limit=5)

        # Assert: returns candidate despite no kommune
        assert len(result) == 1
        assert result[0].orgnr == "222222222"
        assert mock_db.execute.call_count == 3

    @pytest.mark.asyncio
    async def test_raises_database_exception_on_db_error(self, lookups_repo, mock_db):
        """Should raise DatabaseException when DB raises during similar lookup."""
        # Arrange
        mock_db.execute.side_effect = Exception("connection reset")

        # Act & Assert
        with pytest.raises(DatabaseException):
            await lookups_repo.get_similar_companies("123456789", limit=5)


class TestBuildSimilarSql:
    """Unit tests for _build_similar_sql helper in isolation."""

    def test_both_postnummer_and_kommune_includes_all_priorities(self):
        """All four priority sub-queries should be present when both fields are available."""
        sql_str = str(_build_similar_sql(has_postnummer=True, has_kommune=True))

        assert ":postnummer" in sql_str
        assert ":kommune" in sql_str
        assert "1 AS priority" in sql_str
        assert "2 AS priority" in sql_str
        assert "3 AS priority" in sql_str
        assert "4 AS priority" in sql_str

    def test_kommune_only_omits_postnummer_priority(self):
        """Priorities 2, 3, 4 present; priority 1 and :postnummer absent."""
        sql_str = str(_build_similar_sql(has_postnummer=False, has_kommune=True))

        assert ":postnummer" not in sql_str
        assert ":kommune" in sql_str
        assert "1 AS priority" not in sql_str
        assert "2 AS priority" in sql_str
        assert "3 AS priority" in sql_str
        assert "4 AS priority" in sql_str

    def test_postnummer_only_omits_kommune_priorities(self):
        """Priorities 1, 4 present; priorities 2, 3 and :kommune absent."""
        sql_str = str(_build_similar_sql(has_postnummer=True, has_kommune=False))

        assert ":postnummer" in sql_str
        assert ":kommune" not in sql_str
        assert "1 AS priority" in sql_str
        assert "2 AS priority" not in sql_str
        assert "3 AS priority" not in sql_str
        assert "4 AS priority" in sql_str

    def test_neither_includes_only_fallback_priority(self):
        """Only priority 4 fallback present when both fields are absent."""
        sql_str = str(_build_similar_sql(has_postnummer=False, has_kommune=False))

        assert ":postnummer" not in sql_str
        assert ":kommune" not in sql_str
        assert "1 AS priority" not in sql_str
        assert "2 AS priority" not in sql_str
        assert "3 AS priority" not in sql_str
        assert "4 AS priority" in sql_str

    def test_returns_textclause(self):
        """Return type must be TextClause for SQLAlchemy execute() compatibility."""
        from sqlalchemy.sql.elements import TextClause

        result = _build_similar_sql(has_postnummer=True, has_kommune=True)
        assert isinstance(result, TextClause)


class TestGetByIndustryCode:
    """Tests for get_by_industry_code method."""

    @pytest.mark.asyncio
    async def test_returns_companies_and_count(self, lookups_repo, mock_db):
        """Should return tuple of companies and total count."""
        # Arrange
        # Mock count query
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 100

        # Mock orgnr query
        mock_orgnr_result = MagicMock()
        mock_orgnr_result.fetchall.return_value = [("111111111",), ("222222222",)]

        # Mock company fetch
        mock_company1 = MagicMock()
        mock_company1.orgnr = "111111111"
        mock_company2 = MagicMock()
        mock_company2.orgnr = "222222222"
        mock_companies_result = MagicMock()
        mock_companies_result.all.return_value = [
            (mock_company1, 1000, 100, 50, 0.05, 0.3),
            (mock_company2, 2000, 200, 100, 0.05, 0.35),
        ]

        mock_db.execute.side_effect = [mock_count_result, mock_orgnr_result, mock_companies_result]

        # Act
        companies, total = await lookups_repo.get_by_industry_code("62", limit=20, offset=0)

        # Assert
        assert len(companies) == 2
        assert total == 100

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_matches(self, lookups_repo, mock_db):
        """Should return empty list when no companies match."""
        # Arrange
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0
        mock_db.execute.return_value = mock_count_result

        # Act
        companies, total = await lookups_repo.get_by_industry_code("99.999", limit=20, offset=0)

        # Assert
        assert companies == []
        assert total == 0

    @pytest.mark.asyncio
    async def test_excludes_inactive_by_default(self, lookups_repo, mock_db):
        """Should exclude bankrupt/liquidating companies by default."""
        # Arrange
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 50
        mock_orgnr_result = MagicMock()
        mock_orgnr_result.fetchall.return_value = [("111111111",)]
        mock_companies_result = MagicMock()
        mock_company = MagicMock()
        mock_company.orgnr = "111111111"
        mock_companies_result.all.return_value = [(mock_company, 1000, 100, 50, 0.05, 0.3)]

        mock_db.execute.side_effect = [mock_count_result, mock_orgnr_result, mock_companies_result]

        # Act
        await lookups_repo.get_by_industry_code("62", limit=20, offset=0, include_inactive=False)

        # Assert - check that the first query includes the WHERE clauses
        call_args = mock_db.execute.call_args_list[0]
        query_text = str(call_args[0][0])
        assert "konkurs" in query_text.lower()

    @pytest.mark.asyncio
    async def test_raises_database_exception_on_error(self, lookups_repo, mock_db):
        """Should raise DatabaseException on database errors."""
        # Arrange
        mock_db.execute.side_effect = Exception("DB error")

        # Act & Assert
        with pytest.raises(DatabaseException):
            await lookups_repo.get_by_industry_code("62", limit=20, offset=0)
