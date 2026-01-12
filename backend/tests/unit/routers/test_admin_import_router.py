import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from main import app
from routers.admin_import import verify_admin_key
from main import limiter

# Disable rate limiting for tests
limiter.enabled = False

# Override dependency to bypass admin check/simulate it
async def mock_verify_admin_key():
    pass

app.dependency_overrides[verify_admin_key] = mock_verify_admin_key

client = TestClient(app)

@pytest.fixture
def mock_bulk_import_service():
    with patch("routers.admin_import.BulkImportService") as mock:
        service_instance = AsyncMock()
        mock.return_value = service_instance
        yield service_instance

@pytest.fixture
def mock_ssb_service():
    with patch("routers.admin_import.SsbService") as mock:
        service_instance = AsyncMock()
        mock.return_value = service_instance
        yield service_instance

@pytest.fixture
def mock_geocoding_batch_service():
    with patch("services.geocoding_batch_service.GeocodingBatchService") as mock:
        service_instance = AsyncMock()
        # Mocking the local import in the function
        with patch("routers.admin_import.GeocodingBatchService", new=mock):
             yield service_instance

# Wait, GeocodingBatchService is imported inside the function in the router.
# So simply patching "services.geocoding_batch_service.GeocodingBatchService" might work if `sys.modules` is respected,
# but usually we patch where it is used.
# Since it is a local import inside `run_geocoding_batch`, patching 'routers.admin_import.GeocodingBatchService' won't work easily if it's not at module level.
# Actually, patching `services.geocoding_batch_service.GeocodingBatchService` often works if the module imports it.
# But here: `from services.geocoding_batch_service import GeocodingBatchService` is inside the def.
# So I should patch `services.geocoding_batch_service.GeocodingBatchService`.

@pytest.mark.asyncio
async def test_populate_import_queue_success(mock_bulk_import_service):
    mock_bulk_import_service.populate_queue.return_value = {"added": 10, "duplicates": 0}
    
    response = client.post(
        "/admin/import/queue/populate",
        json={"orgnr_list": ["123456789"], "priority": 10},
        headers={"X-Admin-Key": "test"} # Even with override, good practice
    )
    
    assert response.status_code == 200
    assert response.json() == {"added": 10, "duplicates": 0}
    mock_bulk_import_service.populate_queue.assert_called_once_with(["123456789"], 10)

@pytest.mark.asyncio
async def test_populate_import_queue_invalid_request():
    response = client.post("/admin/import/queue/populate", json={})
    assert response.status_code == 400
    assert "Must provide either" in response.json()["detail"]

@pytest.mark.asyncio
async def test_start_bulk_import(mock_bulk_import_service):
    # This endpoint adds a background task. 
    # Testing background tasks with TestClient is tricky, usually they run.
    # But start_bulk_import mocks the service inside the background task wrapper.
    # The routers code: `background_tasks.add_task(_run_bulk_import, ...)`
    # `_run_bulk_import` creates a NEW service instance.
    # So `mock_bulk_import_service` fixture (which mocks the class) should capture the instantiation.
    
    response = client.post("/admin/import/bulk/start", json={"batch_name": "test_batch"})
    
    assert response.status_code == 200
    assert response.json()["message"] == "Bulk import started in background"

@pytest.mark.asyncio
async def test_get_progress(mock_bulk_import_service):
    mock_bulk_import_service.get_progress.return_value = {"pending": 5, "completed": 10}
    
    response = client.get("/admin/import/progress")
    assert response.status_code == 200
    assert response.json() == {"pending": 5, "completed": 10}

@pytest.mark.asyncio
async def test_retry_failed_imports(mock_bulk_import_service):
    mock_bulk_import_service.retry_failed.return_value = 5
    
    response = client.post("/admin/import/retry-failed")
    assert response.status_code == 200
    assert "Reset 5 failed items" in response.json()["message"]

@pytest.mark.asyncio
async def test_sync_ssb_population(mock_ssb_service):
    mock_ssb_service.fetch_and_store_population.return_value = {"updated": 50}
    
    response = client.post("/admin/import/ssb/population")
    assert response.status_code == 200
    assert response.json() == {"updated": 50}

# Geocoding test - needs careful patching because of local import
@pytest.mark.asyncio
async def test_run_geocoding_batch():
    with patch("services.geocoding_batch_service.GeocodingBatchService") as MockService:
        mock_instance = AsyncMock()
        MockService.return_value = mock_instance
        mock_instance.run_batch.return_value = {"processed": 10}
        
        response = client.post("/admin/import/geocode")
        assert response.status_code == 200
        assert response.json() == {"processed": 10}

@pytest.mark.asyncio
async def test_get_geocoding_status():
    with patch("services.geocoding_batch_service.GeocodingBatchService") as MockService:
        mock_instance = AsyncMock()
        MockService.return_value = mock_instance
        mock_instance.count_companies_needing_geocoding.return_value = 20
        mock_instance.count_geocoded_companies.return_value = 80
        
        response = client.get("/admin/import/geocode/status")
        assert response.status_code == 200
        data = response.json()
        assert data["remaining"] == 20
        assert data["total_geocoded"] == 80
        assert data["percent_complete"] == 80.0
