import pytest
from unittest.mock import AsyncMock, MagicMock, patch
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
        mock_instance.run_batch = AsyncMock(
            return_value={"processed": 10, "success": 9, "failed": 1, "remaining": 50, "total_geocoded": 9}
        )

        await scheduler_service.geocode_companies_batch()

        assert mock_instance.run_batch.called


@pytest.mark.asyncio
async def test_geocode_companies_batch_no_work(mock_session_local):
    scheduler_service = SchedulerService()

    with patch("services.geocoding_batch_service.GeocodingBatchService") as MockGeocodingService:
        mock_instance = MockGeocodingService.return_value
        mock_instance.run_batch = AsyncMock(
            return_value={"processed": 0, "success": 0, "failed": 0, "remaining": 0, "total_geocoded": 0}
        )

        # Should just log and return, no error
        await scheduler_service.geocode_companies_batch()

        assert mock_instance.run_batch.called


@pytest.mark.asyncio
async def test_run_company_updates(mock_session_local):
    scheduler_service = SchedulerService()

    with (
        patch("services.update_service.UpdateService") as MockUpdateService,
        patch("repositories.system_repository.SystemRepository") as MockSystemRepo,
    ):
        mock_update = MockUpdateService.return_value
        mock_update.fetch_updates = AsyncMock(
            return_value={
                "latest_oppdateringsid": 123,
                "companies_processed": 5,
                "companies_created": 2,
                "companies_updated": 3,
            }
        )

        mock_system = MockSystemRepo.return_value
        mock_system.get_state = AsyncMock(side_effect=[None, None])  # latest_id, last_sync_date
        mock_system.set_state = AsyncMock()

        await scheduler_service.run_company_updates()

        assert mock_update.fetch_updates.called
        assert mock_system.set_state.called


@pytest.mark.asyncio
async def test_sync_accounting_batch(mock_session_local):
    scheduler_service = SchedulerService()

    # Mock database result for orgnrs
    mock_db = mock_session_local.return_value.__aenter__.return_value
    mock_db.execute = AsyncMock(return_value=patch("sqlalchemy.engine.Result").start())
    mock_db.execute.return_value.all.return_value = [("123456789",), ("987654321",)]

    with patch("services.update_service.UpdateService") as MockUpdateService:
        mock_update = MockUpdateService.return_value
        mock_update._fetch_and_persist_financials = AsyncMock()

        await scheduler_service.sync_accounting_batch()

        assert mock_update._fetch_and_persist_financials.call_count == 2


@pytest.mark.asyncio
async def test_run_subunit_updates(mock_session_local):
    scheduler_service = SchedulerService()

    with (
        patch("services.update_service.UpdateService") as MockUpdateService,
        patch("repositories.system_repository.SystemRepository") as MockSystemRepo,
    ):
        mock_update = MockUpdateService.return_value
        mock_update.fetch_subunit_updates = AsyncMock(
            return_value={"latest_oppdateringsid": 456, "companies_processed": 10}
        )

        mock_system = MockSystemRepo.return_value
        mock_system.get_state = AsyncMock(return_value=None)
        mock_system.set_state = AsyncMock()

        await scheduler_service.run_subunit_updates()

        assert mock_update.fetch_subunit_updates.called
        assert mock_system.set_state.called


@pytest.mark.asyncio
async def test_run_role_updates(mock_session_local):
    scheduler_service = SchedulerService()

    with (
        patch("services.update_service.UpdateService") as MockUpdateService,
        patch("repositories.system_repository.SystemRepository") as MockSystemRepo,
    ):
        mock_update = MockUpdateService.return_value
        mock_update.fetch_role_updates = AsyncMock(
            return_value={"latest_oppdateringsid": 789, "companies_processed": 20}
        )

        mock_system = MockSystemRepo.return_value
        mock_system.get_state = AsyncMock(return_value=None)
        mock_system.set_state = AsyncMock()

        await scheduler_service.run_role_updates()

        assert mock_update.fetch_role_updates.called
        assert mock_system.set_state.called


@pytest.mark.asyncio
async def test_run_db_maintenance():
    # Patch the engine object in the scheduler module
    with patch("services.scheduler.engine") as mock_engine:
        conn_mock = AsyncMock()
        # execution_options returns a new connection mock
        conn_options_mock = AsyncMock()
        # execution_options is SYNC in SQLAlchemy, so use MagicMock
        conn_mock.execution_options = MagicMock(return_value=conn_options_mock)

        # Mock engine.connect() context manager
        mock_engine.connect.return_value.__aenter__.return_value = conn_mock

        scheduler_service = SchedulerService()
        await scheduler_service.run_db_maintenance()

        assert conn_mock.execution_options.called
        assert conn_options_mock.execute.called


@pytest.mark.asyncio
async def test_retry_failed_syncs(mock_session_local):
    scheduler_service = SchedulerService()

    # Mock SyncError objects
    from models import SyncError, SyncErrorStatus

    mock_error = SyncError(orgnr="123456789", entity_type="company", status=SyncErrorStatus.PENDING, attempt_count=0)

    mock_db = mock_session_local.return_value.__aenter__.return_value
    mock_db.execute = AsyncMock()

    # Use MagicMock for result so scalars() isn't a coroutine
    mock_result = MagicMock()
    mock_db.execute.return_value = mock_result
    mock_result.scalars.return_value.all.return_value = [mock_error]

    with patch("services.update_service.UpdateService") as MockUpdateService:
        mock_update = MockUpdateService.return_value
        # Success scenario
        mock_update.brreg_api.fetch_company = AsyncMock(return_value={"navn": "Test Corp"})
        mock_update.company_repo.create_or_update = AsyncMock(return_value=True)

        await scheduler_service.retry_failed_syncs()

        assert mock_error.status == SyncErrorStatus.RESOLVED
        assert mock_error.attempt_count == 1
        assert mock_db.commit.called


@pytest.mark.asyncio
async def test_check_disk_usage():
    scheduler_service = SchedulerService()

    with patch("shutil.disk_usage") as mock_disk:
        mock_disk.return_value = (1000, 500, 500)  # total, used, free
        await scheduler_service.check_disk_usage()
        assert mock_disk.called


@pytest.mark.asyncio
async def test_run_ghost_repair(mock_session_local):
    scheduler_service = SchedulerService()

    with patch("services.repair_service.RepairService") as MockRepairService:
        mock_instance = MockRepairService.return_value
        mock_instance.fix_ghost_parents = AsyncMock()

        await scheduler_service.run_ghost_repair()
        assert mock_instance.fix_ghost_parents.called


@pytest.mark.asyncio
async def test_run_role_backfill(mock_session_local):
    scheduler_service = SchedulerService()

    with patch("services.repair_service.RepairService") as MockRepairService:
        mock_instance = MockRepairService.return_value
        mock_instance.backfill_roles = AsyncMock()

        await scheduler_service.run_role_backfill()
        assert mock_instance.backfill_roles.called
