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


@pytest.mark.asyncio
async def test_get_subclasses_handles_error(mock_nace_service, mock_db):
    """Should return empty list on database error."""
    mock_db.execute.side_effect = Exception("Database error")

    result = await mock_nace_service.get_subclasses("99")

    assert result == []


@pytest.mark.asyncio
async def test_get_all_nace_codes(mock_nace_service):
    """Should return full cache dictionary."""
    NaceService._nace_codes_cache = {"62.010": "Programmering", "62.020": "Konsulent"}

    result = await NaceService.get_all_nace_codes()

    assert len(result) == 2
    assert result["62.010"] == "Programmering"


@pytest.mark.asyncio
async def test_get_nace_name_code_without_dot(mock_nace_service):
    """Should find code even without dot."""
    NaceService._nace_codes_cache = {"62010": "Programmering"}

    result = await NaceService.get_nace_name("62.010")

    assert result == "Programmering"


@pytest.mark.asyncio
async def test_get_hierarchy():
    """Should load NACE hierarchy from CSV."""
    NaceService._nace_codes_cache = {}  # Reset

    with patch("services.nace_service.os.path.exists", return_value=True):
        with patch("services.nace_service.open") as mock_open:
            mock_file = MagicMock()
            mock_file.__enter__.return_value = mock_file
            mock_file.__exit__.return_value = False
            mock_open.return_value = mock_file

            with patch("services.nace_service.csv.DictReader") as mock_csv:
                mock_csv.return_value = [
                    {"code": "62", "parentCode": "", "level": "2", "shortName": "IT"},
                    {"code": "62.01", "parentCode": "62", "level": "3", "shortName": "Programming"},
                ]

                result = await NaceService.get_hierarchy()

                assert len(result) == 2
                assert result[0]["code"] == "62"
                assert result[0]["level"] == 2
                assert result[1]["parent"] == "62"


@pytest.mark.asyncio
async def test_get_hierarchy_file_not_found():
    """Should return empty list if CSV file missing."""
    with patch("services.nace_service.os.path.exists", return_value=False):
        result = await NaceService.get_hierarchy()
        assert result == []


@pytest.mark.asyncio
async def test_get_hierarchy_handles_error():
    """Should return empty list on error."""
    with patch("services.nace_service.os.path.exists", side_effect=Exception("IO error")):
        result = await NaceService.get_hierarchy()
        assert result == []


@pytest.mark.asyncio
async def test_load_nace_codes_file_not_found():
    """Should handle missing CSV file gracefully."""
    NaceService._nace_codes_cache = {}  # Reset

    with patch("services.nace_service.os.path.exists", return_value=False):
        await NaceService._load_nace_codes()

        # Cache should be empty but not cause error
        assert NaceService._nace_codes_cache == {}
