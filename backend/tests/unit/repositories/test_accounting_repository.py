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
