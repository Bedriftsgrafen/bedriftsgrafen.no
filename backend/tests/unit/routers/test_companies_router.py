from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from schemas.companies import (
    CompanyBase,
    FetchCompanyResponse,
)
from services.company_service import CompanyService

# Mock params
MOCK_ORGNR = "123456789"
MOCK_COMPANY_DATA = {
    "orgnr": MOCK_ORGNR,
    "navn": "Test Bedrift AS",
    "parent_orgnr": None,
    "parent_navn": None,
    "organisasjonsform": "AS",
    "naeringskode": "62.010",
    "antall_ansatte": 10,
    "latest_revenue": 1000000,
    "latest_profit": 100000,
}


@pytest.fixture
def mock_company_service(monkeypatch):
    service_mock = AsyncMock(spec=CompanyService)
    service_mock.enrich_nace_codes = AsyncMock()

    # We need to patch the DEPENDENCY which yields the db,
    # but more importantly, we assume the router instantiates CompanyService(db).
    # Since we can't easily patch local imports inside the function without more complex mocking,
    # a common pattern in FastAPI testing with dependency injection is to override dependencies.
    # However, since the router instantiates the service directly: used `service = CompanyService(db)`,
    # we can patch the CLASS itself.

    monkeypatch.setattr("routers.v1.companies.CompanyService", MagicMock(return_value=service_mock))
    return service_mock


@pytest.fixture
def client():
    return TestClient(app)


def test_get_companies_success(client, mock_company_service):
    # Arrange
    mock_company_service.get_companies.return_value = [CompanyBase(**MOCK_COMPANY_DATA)]

    # Act
    response = client.get("/v1/companies")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["orgnr"] == MOCK_ORGNR


def test_get_company_success(client, mock_company_service):
    # Arrange
    # CompanyWithAccounting requires many fields, ensure mock_response has them
    from models import Company

    mock_company = MagicMock(spec=Company)
    for key, val in MOCK_COMPANY_DATA.items():
        setattr(mock_company, key, val)
    mock_company.latitude = 60.0
    mock_company.longitude = 10.0
    mock_company.naeringskoder = ["62.010"]
    mock_company.stiftelsesdato = None
    mock_company.registreringsdato_enhetsregisteret = None
    mock_company.registreringsdato_foretaksregisteret = None
    mock_company.hjemmeside = None
    mock_company.postadresse = None
    mock_company.forretningsadresse = None
    mock_company.konkurs = False
    mock_company.konkursdato = None
    mock_company.under_avvikling = False
    mock_company.under_tvangsavvikling = False
    mock_company.vedtektsfestet_formaal = None
    mock_company.telefon = None
    mock_company.mobil = None
    mock_company.epostadresse = None
    mock_company.siste_innsendte_aarsregnskap = None
    mock_company.institusjonell_sektor = None
    mock_company.last_polled_regnskap = None

    mock_company_service.get_company_detail.return_value = mock_company

    # Act
    response = client.get(f"/v1/companies/{MOCK_ORGNR}")

    # Assert
    assert response.status_code == 200
    assert response.json()["orgnr"] == MOCK_ORGNR


def test_get_company_not_found(client, mock_company_service):
    # Arrange
    mock_company_service.get_company_detail.return_value = None

    # Act
    response = client.get(f"/v1/companies/{MOCK_ORGNR}")

    # Assert
    assert response.status_code == 404


def test_fetch_company_data(client, mock_company_service):
    # Arrange
    # Mocking the success response
    expected_resp = FetchCompanyResponse(orgnr=MOCK_ORGNR, company_fetched=True, financials_fetched=1, errors=[])
    mock_company_service.fetch_and_store_company.return_value = expected_resp

    # Act
    response = client.post(f"/v1/companies/{MOCK_ORGNR}/fetch")

    # Assert
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["company_fetched"] is True
    assert json_data["orgnr"] == MOCK_ORGNR


def test_search_companies(client, mock_company_service):
    # Arrange
    mock_company_service.search_companies.return_value = [CompanyBase(**MOCK_COMPANY_DATA)]

    # Act
    response = client.get("/v1/companies/search?name=Test")

    # Assert
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_company_stats(client, mock_company_service):
    """Test get company stats endpoint."""
    # Arrange
    mock_company_service.get_aggregate_stats.return_value = {
        "total_count": 100,
        "sum_revenue": 1000000,
        "sum_profit": 100000,
        "sum_employees": 500,
    }

    # Act
    response = client.get("/v1/companies/stats")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 100


def test_export_companies(client, mock_company_service, monkeypatch):
    """Test export companies endpoint."""

    # Arrange - mock export service
    async def mock_stream():
        yield b"orgnr,navn\n"
        yield b"123,Test\n"

    mock_export_service = MagicMock()
    mock_export_service.stream_companies_csv = MagicMock(return_value=mock_stream())
    monkeypatch.setattr("routers.v1.companies.ExportService", MagicMock(return_value=mock_export_service))

    # Act
    response = client.get("/v1/companies/export")

    # Assert
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


def test_get_company_similar(client, mock_company_service):
    """Test similar companies endpoint."""
    # Arrange
    mock_company_service.get_similar_companies.return_value = []

    # Act
    response = client.get(f"/v1/companies/{MOCK_ORGNR}/similar")

    # Assert
    assert response.status_code == 200
    assert response.json() == []


def test_search_subunits(client, mock_company_service):
    """Test search subunits endpoint."""
    # Arrange
    mock_company_service.search_subunits.return_value = []

    # Act
    response = client.get("/v1/companies/search/subunits?q=test")

    # Assert
    assert response.status_code == 200
