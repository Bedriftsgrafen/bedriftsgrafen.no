"""
Integration test for Municipality Code search.
Verifies that the backend correctly handles the language-independent municipality_code filter.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from main import app
from database import get_db

client = TestClient(app)


async def mock_get_db():
    yield AsyncMock()


app.dependency_overrides[get_db] = mock_get_db


@patch("routers.v1.companies.CompanyService")
def test_search_by_municipality_code(MockServiceClass):
    # Arrange
    mock_service = MockServiceClass.return_value

    # Ensure all service methods are AsyncMocks
    mock_service.get_companies = AsyncMock()
    mock_service.count_companies = AsyncMock()

    # Mock return value for count
    mock_service.count_companies.return_value = 1

    # Mock return value for get_companies - must match the Pydantic schema
    mock_company = MagicMock()
    mock_company.orgnr = "123456789"
    mock_company.navn = "Hamarøy Spesialisten"
    mock_company.organisasjonsform = "AS"
    mock_company.naeringskode = "62.000"
    mock_company.naeringskoder = ["62.000"]
    mock_company.stiftelsesdato = None
    mock_company.latitude = 60.0
    mock_company.longitude = 10.0
    mock_company.postadresse = {}
    mock_company.forretningsadresse = {}
    mock_company.konkurs = False
    mock_company.under_avvikling = False
    mock_company.under_tvangsavvikling = False
    mock_company.latest_revenue = 0
    mock_company.latest_profit = 0
    mock_company.latest_operating_margin = 0
    mock_company.updated_at = None
    mock_company.last_polled_regnskap = None
    mock_company.geocoded_at = None
    mock_company.hjemmeside = None
    mock_company.vedtektsfestet_formaal = None
    mock_company.konkursdato = None
    mock_company.regnskap = []
    mock_company.roller = []

    mock_service.get_companies.return_value = [mock_company]

    # Act
    # 1875 is Hamarøy/Hábmer
    response = client.get("/v1/companies?municipality_code=1875")

    # Assert
    assert response.status_code == 200

    # Verify that the service was called with the correct DTO
    call_args = mock_service.get_companies.call_args[0][0]
    assert call_args.municipality_code == "1875"

    # Test with both
    response_with_both = client.get("/v1/companies?municipality=Habmer&municipality_code=1875")
    assert response_with_both.status_code == 200
    call_args_both = mock_service.get_companies.call_args[0][0]
    assert call_args_both.municipality == "Habmer"
    assert call_args_both.municipality_code == "1875"


@patch("routers.v1.companies.CompanyService")
def test_municipality_code_validation(MockServiceClass):
    # Mock service methods as AsyncMocks just in case
    mock_service = MockServiceClass.return_value
    mock_service.get_companies = AsyncMock()
    mock_service.count_companies = AsyncMock()

    # Act: Test invalid code (length != 4)
    response_short = client.get("/v1/companies?municipality_code=123")
    assert response_short.status_code == 422  # Validation error

    # Act: Test invalid code (non-digits)
    response_alphic = client.get("/v1/companies?municipality_code=ABCD")
    assert response_alphic.status_code == 422
