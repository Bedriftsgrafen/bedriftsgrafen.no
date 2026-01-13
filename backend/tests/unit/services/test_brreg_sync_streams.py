import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date
from services.update_service import UpdateService

@pytest.fixture
def mock_db():
    return AsyncMock()

@pytest.fixture
def update_service(mock_db):
    service = UpdateService(mock_db)
    service.brreg_api = AsyncMock()
    service.subunit_repo = AsyncMock()
    service.role_repo = AsyncMock()
    service.system_repo = AsyncMock()
    return service

@pytest.mark.asyncio
async def test_fetch_subunit_updates_success(update_service, mock_db):
    # Setup mocks
    update_service.brreg_api.fetch_subunit.return_value = {
        "organisasjonsnummer": "999888777",
        "navn": "Test Subunit",
        "overordnetEnhet": "123456789"
    }
    
    # Mock HTTP response for the update stream
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "_embedded": {
            "oppdaterteUnderenheter": [
                {"organisasjonsnummer": "999888777", "oppdateringsid": 100}
            ]
        },
        "_links": {"next": None}
    }
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await update_service.fetch_subunit_updates(since_date=date(2025, 12, 1))
        
    assert result["companies_updated"] == 1
    assert result["latest_oppdateringsid"] == 100
    update_service.subunit_repo.create_batch.assert_called_once()
    # Check if the created subunit has correct data
    args, kwargs = update_service.subunit_repo.create_batch.call_args
    subunits = args[0]
    assert len(subunits) == 1
    assert subunits[0].orgnr == "999888777"
    assert subunits[0].parent_orgnr == "123456789"

@pytest.mark.asyncio
async def test_fetch_subunit_updates_handles_410(update_service, mock_db):
    # Setup mocks: API returns None for 410 (as implemented in BrregApiService)
    update_service.brreg_api.fetch_subunit.return_value = None
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "_embedded": {
            "oppdaterteUnderenheter": [
                {"organisasjonsnummer": "GONE123", "oppdateringsid": 200}
            ]
        },
        "_links": {"next": None}
    }
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await update_service.fetch_subunit_updates(since_date=date(2025, 12, 1))
        
    assert result["companies_updated"] == 0
    assert result["latest_oppdateringsid"] == 200
    update_service.subunit_repo.create_batch.assert_not_called()

@pytest.mark.asyncio
async def test_fetch_role_updates_success(update_service, mock_db):
    # Setup mocks
    update_service.brreg_api.fetch_roles.return_value = [
        {"type_kode": "DAGL", "person_navn": "Ola Nordmann"}
    ]
    
    # Mock CloudEvents batch response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "id": "500",
            "data": {"organisasjonsnummer": "987654321"}
        }
    ]
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await update_service.fetch_role_updates(since_date=date(2025, 12, 1))
        
    assert result["companies_updated"] == 1
    assert result["latest_oppdateringsid"] == 500
    # Should perform bulk delete and insert
    assert mock_db.execute.called
    update_service.role_repo.create_batch.assert_called_once()
    
    args, kwargs = update_service.role_repo.create_batch.call_args
    roles = args[0]
    assert len(roles) == 1
    assert roles[0].orgnr == "987654321"
    assert roles[0].type_kode == "DAGL"
