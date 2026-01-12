import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from services.nace_service import NaceService
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_nace_service(mock_db):
    # Reset cache before each test
    NaceService._nace_codes_cache = {}
    return NaceService(mock_db)


@pytest.mark.asyncio
async def test_get_nace_name_loads_cache(mock_nace_service):
    # Arrange
    with patch("services.nace_service.open") as mock_open:
        mock_file = MagicMock()
        mock_file.__enter__.return_value = [
            '"code";"parentCode";"level";"name";"shortName";"notes"',
            '"62.010";"62";"4";"Programmeringstjenester";"Programmering";""',
        ]
        mock_open.return_value = mock_file

        with patch("services.nace_service.csv.DictReader") as mock_csv:
            mock_csv.return_value = [{"code": "62.010", "shortName": "Programmering"}]

            # Act
            name = await NaceService.get_nace_name("62.010")

            # Assert
            assert name == "Programmering"
            assert NaceService._nace_codes_cache["62.010"] == "Programmering"


@pytest.mark.asyncio
async def test_get_nace_name_fallback(mock_nace_service):
    # Arrange
    NaceService._nace_codes_cache = {}  # Ensure empty
    with patch("services.nace_service.open"), patch("services.nace_service.csv.DictReader") as mock_csv:
        mock_csv.return_value = []

        # Act
        name = await NaceService.get_nace_name("99.999")

        # Assert
        assert name == "Kode 99.999"


@pytest.mark.asyncio
async def test_get_subclasses(mock_nace_service, mock_db):
    # Arrange
    mock_result = MagicMock()
    mock_result.all.return_value = [("62.010", 10), ("62.020", 5)]
    mock_db.execute.return_value = mock_result

    # Pre-populate cache to avoid file I/O
    NaceService._nace_codes_cache = {"62.010": "Programmering", "62.020": "Konsulent"}

    # Act
    subclasses = await mock_nace_service.get_subclasses("62")

    # Assert
    assert len(subclasses) == 2
    assert subclasses[0].code == "62.010"
    assert subclasses[0].count == 10
    assert subclasses[0].name == "Programmering"
    assert subclasses[1].code == "62.020"
    assert subclasses[1].count == 5
