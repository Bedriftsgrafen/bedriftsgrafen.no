"""
Unit tests for company lookups repository.

Tests get_by_orgnr, get_similar_companies, get_by_industry_code, get_existing_orgnrs.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from repositories.company.lookups import LookupsMixin
from exceptions import CompanyNotFoundException, DatabaseException


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
        # Arrange
        mock_source = MagicMock()
        mock_source.naeringskode = None  # No NACE code
        mock_source.kommune = "OSLO"
        mock_source.postnummer = "0150"
        mock_source_result = MagicMock()
        mock_source_result.fetchone.return_value = mock_source
        mock_db.execute.return_value = mock_source_result

        # Act
        result = await lookups_repo.get_similar_companies("123456789", limit=5)

        # Assert
        assert result == []


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


class TestCount:
    """Tests for count method."""

    @pytest.mark.asyncio
    async def test_returns_total_count(self, lookups_repo, mock_db):
        """Should return total company count."""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1000000
        mock_db.execute.return_value = mock_result

        # Act
        result = await lookups_repo.count()

        # Assert
        assert result == 1000000

    @pytest.mark.asyncio
    async def test_returns_zero_when_empty(self, lookups_repo, mock_db):
        """Should return 0 when no companies."""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar.return_value = None
        mock_db.execute.return_value = mock_result

        # Act
        result = await lookups_repo.count()

        # Assert
        assert result == 0
