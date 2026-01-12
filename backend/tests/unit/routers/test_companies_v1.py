"""
Unit tests for the Companies V1 router.

Tests company list, count, detail, search, and export endpoints.
Mocks service layer to isolate router logic.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch

from main import app
from database import get_db


# Mock DB dependency
async def override_get_db():
    yield MagicMock()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def mock_company_service():
    with patch("routers.v1.companies.CompanyService") as mock:
        yield mock.return_value


@pytest.mark.asyncio
async def test_get_companies(mock_company_service):
    # Arrange
    mock_company_service.get_companies = AsyncMock(return_value=[{"orgnr": "123456789", "navn": "Test AS"}])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/companies")

        # Assert
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["orgnr"] == "123456789"


@pytest.mark.asyncio
async def test_count_companies(mock_company_service):
    # Arrange
    mock_company_service.count_companies = AsyncMock(return_value=42)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/companies/count")

        # Assert
        assert response.status_code == 200
        assert response.json() == 42


@pytest.mark.asyncio
async def test_get_company_detail(mock_company_service):
    # Arrange
    # Create a proper mock structure that satisfies Pydantic validation
    mock_company = MagicMock()
    mock_company.orgnr = "123456789"
    mock_company.navn = "Test AS"
    mock_company.organisasjonsform = "AS"
    mock_company.naeringskode = "62.010"
    mock_company.stiftelsesdato = None
    mock_company.hjemmeside = None
    mock_company.postadresse = None
    mock_company.forretningsadresse = None
    mock_company.konkurs = False
    mock_company.konkursdato = None
    mock_company.under_avvikling = False
    mock_company.under_tvangsavvikling = False
    mock_company.vedtektsfestet_formaal = None
    mock_company.latitude = 60.0
    mock_company.longitude = 10.0
    mock_company.naeringskoder = ["62.010"]
    mock_company.raw_data = {"oppdatert": "2023-01-01"}

    # Financial data (optional in response model, but good to have)
    mock_company.siste_regnskap = None
    mock_company.last_polled_regnskap = None

    # Configure mock return
    mock_company_service.get_company_with_accounting = AsyncMock(return_value=mock_company)

    # Mock NACE service to avoid external calls
    with patch("services.nace_service.NaceService.get_nace_name", AsyncMock(return_value="Programming")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # Act
            response = await ac.get("/v1/companies/123456789")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["orgnr"] == "123456789"
            assert data["navn"] == "Test AS"


@pytest.mark.asyncio
async def test_get_company_not_found(mock_company_service):
    # Arrange
    mock_company_service.get_company_with_accounting = AsyncMock(return_value=None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/companies/999999999")

        # Assert
        assert response.status_code == 404
        assert response.json()["detail"] == "Company not found"


@pytest.mark.asyncio
async def test_search_companies(mock_company_service):
    # Arrange
    mock_company_service.search_companies = AsyncMock(
        return_value=[{"orgnr": "123", "navn": "Apple"}, {"orgnr": "456", "navn": "Appleseed"}]
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/companies/search?name=app")

        # Assert
        assert response.status_code == 200
        assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_get_company_stats(mock_company_service):
    # Arrange
    mock_stats = {"total": 100, "revenue_sum": 1000000, "org_form_breakdown": {"AS": 80, "ENK": 20}}
    mock_company_service.get_aggregate_stats = AsyncMock(return_value=mock_stats)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Act
        response = await ac.get("/v1/companies/stats")

        # Assert
        assert response.status_code == 200
        assert response.json()["total"] == 100
        assert response.json()["org_form_breakdown"]["AS"] == 80
