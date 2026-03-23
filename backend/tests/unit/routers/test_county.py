"""Unit tests for the County router."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from database import get_db
from main import app


# Mock DB dependency
async def override_get_db():
    yield None


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def mock_stats_service():
    with patch("routers.v1.county.StatsService") as mock:
        yield mock.return_value


@pytest.mark.asyncio
async def test_get_county_dashboard(mock_stats_service):
    # Arrange
    mock_stats_service.get_county_premium_dashboard = AsyncMock(
        return_value={
            "code": "46",
            "name": "Vestland",
            "lat": 60.39,
            "lng": 5.32,
            "population": 650000,
            "population_growth_1y": 0.8,
            "company_count": 35000,
            "municipality_count": 43,
            "business_density": 53.8,
            "business_density_national_avg": 50.0,
            "total_revenue": 1_000_000_000_000,
            "establishment_trend": [{"label": "Jan 23", "value": 200}],
            "top_sectors": [{"nace_division": "46", "nace_name": "Engroshandel", "company_count": 5000}],
            "top_companies": [],
            "newest_companies": [],
            "latest_bankruptcies": [],
            "ranking_national_density": {"rank": 3, "out_of": 15},
            "ranking_national_revenue": {"rank": 2, "out_of": 15},
            "ranking_national_population": {"rank": 2, "out_of": 15},
            "municipalities": [{"code": "4601", "name": "Bergen", "company_count": 20000, "population": 285000}],
        }
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/county/46")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "46"
        assert data["name"] == "Vestland"
        assert data["population"] == 650000
        assert data["municipality_count"] == 43
        assert data["ranking_national_density"]["rank"] == 3
        assert len(data["municipalities"]) == 1
        assert data["municipalities"][0]["name"] == "Bergen"


@pytest.mark.asyncio
async def test_get_county_not_found(mock_stats_service):
    # Arrange
    mock_stats_service.get_county_premium_dashboard = AsyncMock(return_value={"population": 0, "company_count": 0})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/county/99")

        # Assert
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_counties(mock_stats_service):
    # Arrange
    mock_stats_service.get_all_counties_summary = AsyncMock(
        return_value=[
            {"code": "03", "name": "Oslo", "company_count": 60000, "municipality_count": 1, "population": 700000},
            {"code": "46", "name": "Vestland", "company_count": 35000, "municipality_count": 43, "population": 650000},
        ]
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/county/")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["code"] == "03"
        assert data[1]["code"] == "46"


@pytest.mark.asyncio
async def test_county_code_validation():
    """Test that invalid county codes are rejected."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Invalid: 3-digit code
        response = await ac.get("/v1/county/123")
        assert response.status_code == 422  # Validation error

        # Invalid: 1-digit code
        response = await ac.get("/v1/county/4")
        assert response.status_code == 422

        # Invalid: letters
        response = await ac.get("/v1/county/ab")
        assert response.status_code == 422
