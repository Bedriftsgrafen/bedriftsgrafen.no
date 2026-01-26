"""
Unit tests for company search repository.

Tests full-text search, ILIKE fallback, and error handling.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

from repositories.company.search import SearchMixin
from exceptions import DatabaseException


class MockSearchRepo(SearchMixin):
    """Concrete implementation of SearchMixin for testing."""

    def __init__(self, db):
        self.db = db


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def search_repo(mock_db):
    return MockSearchRepo(mock_db)


def make_mock_company(orgnr: str):
    """Helper to create a mock company with required attributes."""
    mock = MagicMock()
    mock.orgnr = orgnr
    mock.navn = f"Company {orgnr}"
    mock.organisasjonsform = "AS"
    mock.naeringskode = "62.010"
    mock.antall_ansatte = 10
    mock.stiftelsesdato = None
    mock.registreringsdato_enhetsregisteret = None
    mock.registreringsdato_foretaksregisteret = None
    mock.registrert_i_foretaksregisteret = True
    mock.registrert_i_mvaregisteret = False
    mock.registrert_i_frivillighetsregisteret = False
    mock.registrert_i_stiftelsesregisteret = False
    mock.registrert_i_partiregisteret = False
    mock.konkurs = False
    mock.under_avvikling = False
    mock.under_tvangsavvikling = False
    mock.konkursdato = None
    mock.vedtektsfestet_formaal = None
    mock.hjemmeside = None
    mock.postadresse = {}
    mock.forretningsadresse = {}
    mock.naeringskoder = []
    return mock


class TestSearchByName:
    """Tests for search_by_name method."""

    @pytest.mark.asyncio
    async def test_short_query_uses_ilike_prefix(self, search_repo, mock_db):
        """Queries < 3 chars should use ILIKE prefix matching."""
        # Arrange
        mock_result = MagicMock()
        mock_company = make_mock_company("123456789")
        # Return tuples like (company, rev, profit, op_profit, op_margin, eq_ratio)
        mock_result.all.return_value = [(mock_company, 1000, 100, 50, 0.05, 0.3)]
        mock_db.execute.return_value = mock_result

        # Act
        results = await search_repo.search_by_name("AB", limit=10)

        # Assert
        assert len(results) == 1
        assert results[0].orgnr == "123456789"
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_exact_orgnr_match_returns_single_result(self, search_repo, mock_db):
        """Exact 9-digit orgnr should return immediately."""
        # Arrange
        mock_result = MagicMock()
        mock_company = make_mock_company("123456789")
        mock_result.first.return_value = (mock_company, 1000, 100, 50, 0.05, 0.3)
        mock_db.execute.return_value = mock_result

        # Act
        results = await search_repo.search_by_name("123456789", limit=10)

        # Assert
        assert len(results) == 1
        assert results[0].orgnr == "123456789"

    @pytest.mark.asyncio
    async def test_fts_search_for_long_queries(self, search_repo, mock_db):
        """Queries >= 3 chars should use full-text search."""
        # Arrange
        mock_result = MagicMock()
        mock_company1 = make_mock_company("111111111")
        mock_company2 = make_mock_company("222222222")
        mock_result.all.return_value = [
            (mock_company1, 5000, 500, 250, 0.05, 0.4),
            (mock_company2, 3000, 300, 150, 0.05, 0.35),
        ]
        mock_db.execute.return_value = mock_result

        # Act
        results = await search_repo.search_by_name("Test Company", limit=10)

        # Assert
        assert len(results) == 2
        assert results[0].orgnr == "111111111"
        assert results[1].orgnr == "222222222"

    @pytest.mark.asyncio
    async def test_empty_results_returns_empty_list(self, search_repo, mock_db):
        """No matches should return empty list."""
        # Arrange
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_db.execute.return_value = mock_result

        # Act
        results = await search_repo.search_by_name("NonexistentCompany", limit=10)

        # Assert
        assert results == []

    @pytest.mark.asyncio
    async def test_db_error_raises_database_exception(self, search_repo, mock_db):
        """Database errors should raise DatabaseException."""
        # Arrange
        from sqlalchemy.exc import DBAPIError

        mock_db.execute.side_effect = DBAPIError("connection", {}, None)

        # Act & Assert
        with pytest.raises(DatabaseException) as exc_info:
            await search_repo.search_by_name("Test", limit=10)
        assert "search failed" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_semaphore_timeout_raises_exception(self, search_repo, mock_db):
        """Semaphore timeout should raise DatabaseException."""
        # Arrange - patch the semaphore timeout to be very short
        with patch("repositories.company.search.SEARCH_SEMAPHORE_TIMEOUT", 0.001):
            # Create a blocking scenario
            async def slow_execute(*args, **kwargs):
                await asyncio.sleep(1)
                return MagicMock()

            mock_db.execute = slow_execute

            # Act & Assert
            with pytest.raises(DatabaseException) as exc_info:
                await search_repo.search_by_name("Test", limit=10)
            assert "timed out" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(self, search_repo, mock_db):
        """Should respect the limit parameter."""
        # Arrange
        mock_result = MagicMock()
        mock_companies = [(make_mock_company(f"00000000{i}"), i * 100, i * 10, i * 5, 0.05, 0.3) for i in range(5)]
        mock_result.all.return_value = mock_companies
        mock_db.execute.return_value = mock_result

        # Act
        results = await search_repo.search_by_name("Test", limit=5)

        # Assert
        assert len(results) == 5

    @pytest.mark.asyncio
    async def test_orgnr_not_found_falls_through_to_fts(self, search_repo, mock_db):
        """9-digit query that doesn't match should fall through to FTS."""
        # Arrange
        mock_exact_result = MagicMock()
        mock_exact_result.first.return_value = None  # No exact match

        mock_fts_result = MagicMock()
        mock_company = make_mock_company("987654321")
        mock_fts_result.all.return_value = [(mock_company, 1000, 100, 50, 0.05, 0.3)]

        # First call returns no exact match, second call returns FTS results
        mock_db.execute.side_effect = [mock_exact_result, mock_fts_result]

        # Act
        results = await search_repo.search_by_name("999999999", limit=10)

        # Assert
        assert len(results) == 1
        assert results[0].orgnr == "987654321"
