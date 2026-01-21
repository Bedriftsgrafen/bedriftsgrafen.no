"""
Integration tests for Companies Router.
Tests API contracts and Router <-> Service interaction.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from main import app
from models import Company
from database import get_db

# We need to override get_db to avoid real DB connection attempts

client = TestClient(app)


async def mock_get_db():
    yield AsyncMock()


app.dependency_overrides[get_db] = mock_get_db


@patch("routers.v1.companies.NaceService")
@patch("routers.v1.companies.CompanyService")
def test_get_company_success(MockServiceClass, MockNaceService):
    # Arrange
    mock_service = MockServiceClass.return_value
    mock_company = MagicMock(spec=Company)
    mock_company.orgnr = "123456789"
    mock_company.navn = "Test AS"
    mock_company.latitude = 60.0
    mock_company.organisasjonsform = "AS"
    mock_company.naeringskode = "62.000"
    mock_company.naeringskoder = ["62.000"]
    mock_company.stiftelsesdato = None
    mock_company.registreringsdato_enhetsregisteret = None
    mock_company.registreringsdato_foretaksregisteret = None
    mock_company.hjemmeside = None
    mock_company.postadresse = {}
    mock_company.forretningsadresse = {}
    mock_company.konkursdato = None
    mock_company.vedtektsfestet_formaal = None
    mock_company.regnskap = []  # Relationship
    mock_company.roller = []  # Relationship

    # Missing fields required by CompanyBase schema (to avoid MagicMock auto-creation causing type errors)
    mock_company.longitude = 10.0
    mock_company.konkurs = False
    mock_company.under_avvikling = False
    mock_company.under_tvangsavvikling = False
    mock_company.latest_profit = 0.0
    mock_company.latest_revenue = 0.0
    mock_company.latest_operating_margin = 0.0
    mock_company.updated_at = None
    mock_company.last_polled_regnskap = None
    mock_company.geocoded_at = None

    # String fields required by CompanyWithAccounting (must be explicit to avoid MagicMock auto-creation)
    mock_company.telefon = None
    mock_company.mobil = None
    mock_company.epostadresse = None
    mock_company.siste_innsendte_aarsregnskap = None
    mock_company.institusjonell_sektor = None

    # Async mock return
    async def get_comp(*args, **kwargs):
        return mock_company

    mock_service.get_company_with_accounting.side_effect = get_comp

    # Mock NaceService
    async def get_nace(code):
        return "Konsulentvirksomhet"

    MockNaceService.get_nace_name.side_effect = get_nace

    # Act
    response = client.get("/v1/companies/123456789")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["orgnr"] == "123456789"
    assert data["navn"] == "Test AS"
    assert len(data["naeringskoder"]) == 1
    assert data["naeringskoder"][0]["kode"] == "62.000"
    assert data["naeringskoder"][0]["beskrivelse"] == "Konsulentvirksomhet"


@patch("routers.v1.companies.CompanyService")
def test_get_company_not_found(MockServiceClass):
    # Arrange
    mock_service = MockServiceClass.return_value

    async def get_comp(*args, **kwargs):
        return None

    mock_service.get_company_with_accounting.side_effect = get_comp

    # Act
    response = client.get("/v1/companies/999999999")

    # Assert
    assert response.status_code == 404


@patch("routers.v1.companies.ExportService")
def test_export_companies_headers(MockExportClass):
    # Arrange
    mock_service = MockExportClass.return_value

    async def mock_stream(*args, **kwargs):
        yield b"\ufeff"
        yield b"Header\n"
        yield b"Data\n"

    mock_service.stream_companies_csv.side_effect = mock_stream
    # Also need EXPORT_ROW_LIMIT on the class/instance
    MockExportClass.EXPORT_ROW_LIMIT = 1000

    # Act
    response = client.get("/v1/companies/export")

    # Assert
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert response.content.startswith(b"\ufeffHeader")
