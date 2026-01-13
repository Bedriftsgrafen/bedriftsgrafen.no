import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from main import app
from services.company_service import CompanyService
from schemas.companies import (
    CompanyBase,
    CompanyWithAccounting,
    FetchCompanyResponse,
)

# Mock params
MOCK_ORGNR = "123456789"
MOCK_COMPANY_DATA = {
    "orgnr": MOCK_ORGNR,
    "navn": "Test Bedrift AS",
    "organisasjonsform": "AS",
    "naeringskode": "62.010",
    "antall_ansatte": 10,
    "latest_revenue": 1000000,
    "latest_profit": 100000,
}


@pytest.fixture
def mock_company_service(monkeypatch):
    service_mock = AsyncMock(spec=CompanyService)

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
    mock_response = CompanyWithAccounting(**MOCK_COMPANY_DATA, raw_data={})
    # Needed for router logic (latitude check)
    mock_response.latitude = 60.0
    mock_response.longitude = 10.0
    mock_response.naeringskoder = []

    mock_company_service.get_company_with_accounting.return_value = mock_response

    # Act
    response = client.get(f"/v1/companies/{MOCK_ORGNR}")

    # Assert
    assert response.status_code == 200
    assert response.json()["orgnr"] == MOCK_ORGNR


def test_get_company_not_found(client, mock_company_service):
    # Arrange
    mock_company_service.get_company_with_accounting.return_value = None

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
