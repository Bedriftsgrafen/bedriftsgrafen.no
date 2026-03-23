from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.company.repository import CompanyRepository
from repositories.company_filter_builder import FilterParams


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def repo(mock_db):
    return CompanyRepository(mock_db)


@pytest.mark.asyncio
async def test_get_map_markers_fetch_n_plus_1_logic(repo, mock_db):
    """
    Test that get_map_markers uses the fetch N+1 strategy correctly.
    """
    limit = 5
    # Mock database to return limit + 1 rows (6 rows)
    mock_rows = [
        ("org1", "C1", 60.0, 10.0, "62.010", 10),
        ("org2", "C2", 60.1, 10.1, "62.010", 20),
        ("org3", "C3", 60.2, 10.2, "62.010", 30),
        ("org4", "C4", 60.3, 10.3, "62.010", 40),
        ("org5", "C5", 60.4, 10.4, "62.010", 50),
        ("org6", "C6", 60.5, 10.5, "62.010", 60),
    ]

    mock_result = MagicMock()
    mock_result.all.return_value = mock_rows
    mock_db.execute.return_value = mock_result

    filters = FilterParams(naeringskode="62")

    # Act
    markers, total = await repo.get_map_markers(filters=filters, limit=limit)

    # Assert
    # 1. Total should be len(mock_rows) = 6
    assert total == 6
    # 2. Results should be truncated to limit = 5
    assert len(markers) == 5
    assert markers[0][0] == "org1"
    assert markers[4][0] == "org5"

    # 3. Verify it used Limit(limit + 1) -> we can't easily check the SQL here without more complex mocking,
    # but the logic that processes the result is verified.


@pytest.mark.asyncio
async def test_get_map_markers_no_truncation(repo, mock_db):
    """Test that it behaves correctly when results are fewer than limit."""
    limit = 5
    mock_rows = [
        ("org1", "C1", 60.0, 10.0, "62.010", 10),
        ("org2", "C2", 60.1, 10.1, "62.010", 20),
    ]

    mock_result = MagicMock()
    mock_result.all.return_value = mock_rows
    mock_db.execute.return_value = mock_result

    filters = FilterParams(naeringskode="62")

    # Act
    markers, total = await repo.get_map_markers(filters=filters, limit=limit)

    # Assert
    assert total == 2
    assert len(markers) == 2
    assert markers[0][0] == "org1"
    assert markers[1][0] == "org2"
