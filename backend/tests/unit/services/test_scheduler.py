import pytest
from unittest.mock import AsyncMock, patch
from services.scheduler import SchedulerService

@pytest.fixture
def mock_engine_begin():
    # Patch the engine object in the scheduler module
    with patch("services.scheduler.engine") as mock_engine:
        # Configure begin to return an async context manager
        conn_mock = AsyncMock()
        mock_engine.begin.return_value.__aenter__.return_value = conn_mock
        mock_engine.begin.return_value.__aexit__.return_value = None
        yield mock_engine.begin

@pytest.fixture
def mock_session_local():
    with patch("services.scheduler.AsyncSessionLocal") as mock:
        yield mock

@pytest.mark.asyncio
async def test_scheduler_init_and_jobs():
    scheduler_service = SchedulerService()
    
    # Verify jobs were added
    jobs = scheduler_service.scheduler.get_jobs()
    job_ids = [job.id for job in jobs]
    
    assert "refresh_views" in job_ids
    assert "sync_ssb_population" in job_ids
    assert "geocode_companies" in job_ids

@pytest.mark.asyncio
async def test_refresh_materialized_views(mock_engine_begin):
    scheduler_service = SchedulerService()
    
    await scheduler_service.refresh_materialized_views()
    
    # Verify SQL execution
    # Getting the connection mock from the engine.begin context manager
    mock_conn = mock_engine_begin.return_value.__aenter__.return_value
    assert mock_conn.execute.call_count >= 4

@pytest.mark.asyncio
async def test_sync_ssb_population(mock_session_local):
    scheduler_service = SchedulerService()
    
    # Patch the class where it is DEFINED
    with patch("services.ssb_service.SsbService") as MockSsbService:
        mock_instance = MockSsbService.return_value
        mock_instance.fetch_and_store_population = AsyncMock(return_value={"year": 2023, "municipality_count": 356})
        
        await scheduler_service.sync_ssb_population()
        
        assert mock_instance.fetch_and_store_population.called

@pytest.mark.asyncio
async def test_geocode_companies_batch(mock_session_local):
    scheduler_service = SchedulerService()
    
    with patch("services.geocoding_batch_service.GeocodingBatchService") as MockGeocodingService:
        mock_instance = MockGeocodingService.return_value
        mock_instance.run_batch = AsyncMock(return_value={
            "processed": 10,
            "success": 9,
            "failed": 1,
            "remaining": 50,
            "total_geocoded": 9
        })
        
        await scheduler_service.geocode_companies_batch()
        
        assert mock_instance.run_batch.called

@pytest.mark.asyncio
async def test_geocode_companies_batch_no_work(mock_session_local):
    scheduler_service = SchedulerService()
    
    with patch("services.geocoding_batch_service.GeocodingBatchService") as MockGeocodingService:
        mock_instance = MockGeocodingService.return_value
        mock_instance.run_batch = AsyncMock(return_value={
            "processed": 0,
            "success": 0,
            "failed": 0,
            "remaining": 0,
            "total_geocoded": 0
        })
        
        # Should just log and return, no error
        await scheduler_service.geocode_companies_batch()
        
        assert mock_instance.run_batch.called

