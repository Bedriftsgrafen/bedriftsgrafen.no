import pytest
from unittest.mock import AsyncMock, MagicMock
from repositories.accounting_repository import AccountingRepository
from sqlalchemy.ext.asyncio import AsyncSession
from exceptions import ValidationException


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def accounting_repo(mock_db):
    return AccountingRepository(mock_db)


@pytest.mark.asyncio
async def test_get_by_orgnr_success(accounting_repo, mock_db):
    # Arrange
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = ["Rec1", "Rec2"]
    mock_db.execute.return_value = mock_result

    # Act
    result = await accounting_repo.get_by_orgnr("123")

    # Assert
    assert len(result) == 2
    mock_db.execute.assert_called_once()


@pytest.mark.asyncio
async def test_create_or_update_validation_missing_year(accounting_repo):
    # Act & Assert
    with pytest.raises(ValidationException, match="must include accounting year"):
        await accounting_repo.create_or_update("123", {}, {})


@pytest.mark.asyncio
async def test_create_or_update_success(accounting_repo, mock_db):
    # Arrange
    row_mock = MagicMock()
    row_mock.scalar_one.return_value = "AccountingObject"
    mock_db.execute.return_value = row_mock

    # Mock retrieval after insert
    accounting_repo.get_by_orgnr_and_year = AsyncMock(return_value="AccountingObject")

    data = {
        "aar": 2023,
        "total_inntekt": "1000",
        "egenkapital": "500",
        "kortsiktig_gjeld": "200",
        "langsiktig_gjeld": "100",
    }

    # Act
    result = await accounting_repo.create_or_update("123", data, {}, autocommit=True)

    # Assert
    assert result == "AccountingObject"
    mock_db.execute.assert_called()
    mock_db.commit.assert_called()


def test_calculate_gjeldsgrad_calculation():
    # 300 debt / 500 equity = 0.6
    assert AccountingRepository._calculate_gjeldsgrad(500, 200, 100) == 0.6


def test_calculate_gjeldsgrad_zero_equity():
    assert AccountingRepository._calculate_gjeldsgrad(0, 100, 100) is None


@pytest.mark.asyncio
async def test_get_aggregated_stats(accounting_repo, mock_db):
    # Arrange
    mock_row = MagicMock()
    mock_row.total_revenue = 1000.0
    mock_row.profitable_percentage = 80.0
    mock_row.avg_operating_margin = 15.0

    mock_result = MagicMock()
    mock_result.one.return_value = mock_row
    mock_db.execute.return_value = mock_result

    # Act
    stats = await accounting_repo.get_aggregated_stats()

    # Assert
    assert stats["total_revenue"] == 1000.0
    assert stats["profitable_percentage"] == 80.0
    assert stats["avg_operating_margin"] == 15.0


@pytest.mark.asyncio
async def test_get_aggregated_stats_error_fallback(accounting_repo, mock_db):
    """Should return zeros on error."""
    mock_db.execute.side_effect = Exception("DB error")

    stats = await accounting_repo.get_aggregated_stats()

    assert stats["total_revenue"] == 0.0
    assert stats["profitable_percentage"] == 0.0


@pytest.mark.asyncio
async def test_get_aggregated_stats_null_values(accounting_repo, mock_db):
    """Should handle null values from database."""
    mock_row = MagicMock()
    mock_row.total_revenue = None
    mock_row.total_ebitda = None
    mock_row.profitable_percentage = None
    mock_row.solid_company_percentage = None
    mock_row.avg_operating_margin = None

    mock_result = MagicMock()
    mock_result.one.return_value = mock_row
    mock_db.execute.return_value = mock_result

    stats = await accounting_repo.get_aggregated_stats()

    assert stats["total_revenue"] == 0.0
    assert stats["total_ebitda"] == 0.0


@pytest.mark.asyncio
async def test_get_by_orgnr_error(accounting_repo, mock_db):
    """Should raise DatabaseException on error."""
    from exceptions import DatabaseException

    mock_db.execute.side_effect = Exception("DB error")

    with pytest.raises(DatabaseException):
        await accounting_repo.get_by_orgnr("123")


@pytest.mark.asyncio
async def test_get_by_orgnr_and_year_success(accounting_repo, mock_db):
    """Should return accounting for specific year."""
    mock_accounting = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_accounting
    mock_db.execute.return_value = mock_result

    result = await accounting_repo.get_by_orgnr_and_year("123", 2023)

    assert result == mock_accounting


@pytest.mark.asyncio
async def test_get_by_orgnr_and_year_not_found(accounting_repo, mock_db):
    """Should raise AccountingNotFoundException when not found."""
    from exceptions import AccountingNotFoundException

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    with pytest.raises(AccountingNotFoundException):
        await accounting_repo.get_by_orgnr_and_year("123", 2023)


@pytest.mark.asyncio
async def test_get_by_orgnr_and_year_error(accounting_repo, mock_db):
    """Should raise DatabaseException on error."""
    from exceptions import DatabaseException

    mock_db.execute.side_effect = Exception("DB error")

    with pytest.raises(DatabaseException):
        await accounting_repo.get_by_orgnr_and_year("123", 2023)


@pytest.mark.asyncio
async def test_count(accounting_repo, mock_db):
    """Should return estimated count from pg_class."""
    mock_result = MagicMock()
    mock_result.scalar.return_value = 1000000
    mock_db.execute.return_value = mock_result

    count = await accounting_repo.count()

    assert count == 1000000


@pytest.mark.asyncio
async def test_count_none(accounting_repo, mock_db):
    """Should return 0 when no count."""
    mock_result = MagicMock()
    mock_result.scalar.return_value = None
    mock_db.execute.return_value = mock_result

    count = await accounting_repo.count()

    assert count == 0


@pytest.mark.asyncio
async def test_refresh_materialized_view(accounting_repo, mock_db):
    """Should execute refresh and commit."""
    await accounting_repo.refresh_materialized_view()

    mock_db.execute.assert_called_once()
    mock_db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_create_or_update_error_rollback(accounting_repo, mock_db):
    """Should rollback on error when autocommit=True."""
    from exceptions import DatabaseException

    mock_db.execute.side_effect = Exception("DB error")

    data = {"aar": 2023}

    with pytest.raises(DatabaseException):
        await accounting_repo.create_or_update("123", data, {}, autocommit=True)

    mock_db.rollback.assert_called_once()


class TestHelperMethods:
    """Tests for static helper methods."""

    def test_parse_date_valid(self):
        result = AccountingRepository._parse_date("2023-12-31")
        assert result.year == 2023
        assert result.month == 12
        assert result.day == 31

    def test_parse_date_with_time(self):
        """Should parse date ignoring time portion."""
        result = AccountingRepository._parse_date("2023-06-15T12:00:00Z")
        assert result.year == 2023
        assert result.month == 6
        assert result.day == 15

    def test_parse_date_none(self):
        assert AccountingRepository._parse_date(None) is None

    def test_parse_date_short_string(self):
        assert AccountingRepository._parse_date("2023") is None

    def test_parse_date_invalid(self):
        assert AccountingRepository._parse_date("not-a-date") is None

    def test_validate_numeric_valid(self):
        assert AccountingRepository._validate_numeric("1000.50") == 1000.50
        assert AccountingRepository._validate_numeric(500) == 500.0

    def test_validate_numeric_none(self):
        assert AccountingRepository._validate_numeric(None) is None

    def test_validate_numeric_nan(self):
        assert AccountingRepository._validate_numeric(float("nan")) is None

    def test_validate_numeric_infinity(self):
        assert AccountingRepository._validate_numeric(float("inf")) is None
        assert AccountingRepository._validate_numeric(float("-inf")) is None

    def test_validate_numeric_invalid_string(self):
        assert AccountingRepository._validate_numeric("not-a-number") is None

    def test_calculate_gjeldsgrad_valid(self):
        # (200 + 100) / 500 = 0.6
        result = AccountingRepository._calculate_gjeldsgrad(500, 200, 100)
        assert result == 0.6

    def test_calculate_gjeldsgrad_with_none_debt(self):
        # (0 + 100) / 500 = 0.2
        result = AccountingRepository._calculate_gjeldsgrad(500, None, 100)
        assert result == 0.2

    def test_calculate_gjeldsgrad_zero_equity(self):
        result = AccountingRepository._calculate_gjeldsgrad(0, 200, 100)
        assert result is None

    def test_calculate_gjeldsgrad_none_equity(self):
        result = AccountingRepository._calculate_gjeldsgrad(None, 200, 100)
        assert result is None
