"""Unit tests for the Municipality router."""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from main import app
from database import get_db


# Mock DB dependency
async def override_get_db():
    yield None


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def mock_stats_service():
    with patch("routers.v1.municipality.StatsService") as mock:
        yield mock.return_value


@pytest.mark.asyncio
async def test_get_municipality_dashboard(mock_stats_service):
    # Arrange
    mock_stats_service.get_municipality_premium_dashboard = AsyncMock(
        return_value={
            "code": "0301",
            "name": "Oslo",
            "county_code": "03",
            "county_name": "Oslo",
            "population": 700000,
            "population_growth_1y": 1.2,
            "company_count": 50000,
            "business_density": 71.4,
            "business_density_national_avg": 50.0,
            "total_revenue": None,
            "establishment_trend": [{"label": "Jan 23", "value": 100}],
            "top_sectors": [{"nace_division": "62", "nace_name": "IT", "company_count": 1000}],
            "top_companies": [],
            "newest_companies": [],
            "ranking_in_county_density": {"rank": 1, "out_of": 10},
            "ranking_in_county_revenue": {"rank": 1, "out_of": 10},
        }
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/municipality/0301")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "0301"
        assert data["name"] == "Oslo"
        assert data["population"] == 700000
        assert data["ranking_in_county_density"]["rank"] == 1


@pytest.mark.asyncio
async def test_get_municipality_not_found(mock_stats_service):
    # Arrange
    mock_stats_service.get_municipality_premium_dashboard = AsyncMock(
        return_value={"population": 0, "company_count": 0}
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/municipality/9999")

        # Assert
        assert response.status_code == 404
