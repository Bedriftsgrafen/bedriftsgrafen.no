"""
Integration test for NACE fallback in Geography Stats.
Verifies that the backend correctly handles 5-digit NACE codes on summary-level endpoints.
"""

from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from main import app
from database import get_db

client = TestClient(app)


async def mock_get_db():
    yield AsyncMock()


app.dependency_overrides[get_db] = mock_get_db


@patch("routers.v1.stats.StatsService")
def test_geography_stats_nace_fallback(MockServiceClass):
    # Arrange
    mock_service = MockServiceClass.return_value
    mock_service.get_geography_stats = AsyncMock(return_value=[])

    # Act: Test with 5-digit NACE (formerly triggered 422)
    response = client.get("/v1/stats/geography?level=county&metric=company_count&nace=62.100")

    # Assert
    assert response.status_code == 200
    # Service should be called with NO truncation in the router (truncation happens in service)
    # Actually, the router passes '62.100' and the service truncates it to '62'
    # Since we mocked the SERVICE, we check the call to it
    mock_service.get_geography_stats.assert_called_once_with(
        level="county", metric="company_count", nace="62.100", county_code=None
    )


@patch("routers.v1.stats.StatsService")
def test_geography_averages_nace_fallback(MockServiceClass):
    # Arrange
    from schemas.stats import GeoAveragesResponse

    mock_service = MockServiceClass.return_value

    # Return a real schema object to pass FastAPI validation
    mock_response = GeoAveragesResponse(
        national_avg=10.5, national_total=1000, county_avg=12.2, county_total=200, county_name="Oslo"
    )
    mock_service.get_geography_averages = AsyncMock(return_value=mock_response)

    # Act: Test with 5-digit NACE
    response = client.get("/v1/stats/geography/averages?level=county&metric=company_count&nace=62.100")

    # Assert
    assert response.status_code == 200
    mock_service.get_geography_averages.assert_called_once_with(
        level="county", metric="company_count", nace="62.100", county_code=None
    )


def test_invalid_nace_pattern():
    # Act: Test with invalid pattern (not 2 or 5 digits)
    response = client.get("/v1/stats/geography?nace=621")  # 3 digits not allowed by regex
    assert response.status_code == 422
