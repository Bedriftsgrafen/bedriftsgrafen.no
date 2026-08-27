from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.scheduler import (
    BEDRIFTER_MAINTENANCE_STATEMENT_TIMEOUT_MS,
    BEDRIFTER_MAINTENANCE_TABLE,
    MV_REFRESH_LOCK_NAMESPACE,
    MV_REFRESH_LOCK_RESOURCE,
    REGULAR_MAINTENANCE_STATEMENT_TIMEOUT_MS,
    REGULAR_MAINTENANCE_TABLES,
    SchedulerService,
)
from services.update_service import FinancialPollOutcome


@pytest.fixture
def mock_engine():
    with patch("services.scheduler.engine") as mock_engine:
        begin_conn_mock = AsyncMock()
        mock_engine.begin.return_value.__aenter__.return_value = begin_conn_mock
        mock_engine.begin.return_value.__aexit__.return_value = None

        lock_conn_mock = AsyncMock()
        lock_conn_mock.execution_options = AsyncMock(return_value=lock_conn_mock)
        lock_conn_mock.close = AsyncMock()
        mock_engine.connect = AsyncMock(return_value=lock_conn_mock)
        yield mock_engine


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

    assert "refresh_views_light" in job_ids
    assert "refresh_views_heavy" in job_ids
    assert "sync_ssb_population" in job_ids
    assert "geocode_companies" in job_ids


@pytest.mark.asyncio
async def test_refresh_views_light(mock_engine):
    scheduler_service = SchedulerService()

    lock_conn = AsyncMock()
    with (
        patch.object(
            scheduler_service, "_try_acquire_refresh_lock", new=AsyncMock(return_value=lock_conn)
        ) as mock_lock,
        patch.object(scheduler_service, "_release_refresh_lock", new=AsyncMock()) as mock_release,
    ):
        await scheduler_service.refresh_views_light()

    mock_conn = mock_engine.begin.return_value.__aenter__.return_value
    # 8 light views x (SET LOCAL + REFRESH + optional ANALYZE) — at least 8 REFRESH calls
    assert mock_conn.execute.call_count >= 8
    mock_lock.assert_awaited_once_with("light")
    mock_release.assert_awaited_once_with(lock_conn, "light")


@pytest.mark.asyncio
async def test_refresh_views_heavy(mock_engine):
    scheduler_service = SchedulerService()

    lock_conn = AsyncMock()
    with (
        patch.object(
            scheduler_service, "_try_acquire_refresh_lock", new=AsyncMock(return_value=lock_conn)
        ) as mock_lock,
        patch.object(scheduler_service, "_release_refresh_lock", new=AsyncMock()) as mock_release,
    ):
        await scheduler_service.refresh_views_heavy()

    mock_conn = mock_engine.begin.return_value.__aenter__.return_value
    # 3 heavy views x (SET LOCAL + REFRESH + optional ANALYZE) — at least 3 REFRESH calls
    assert mock_conn.execute.call_count >= 3
    execute_sql = [str(call.args[0]) for call in mock_conn.execute.await_args_list]
    assert "ANALYZE industry_stats" in execute_sql
    mock_lock.assert_awaited_once_with("heavy")
    mock_release.assert_awaited_once_with(lock_conn, "heavy")


@pytest.mark.asyncio
async def test_refresh_views_light_skips_when_lock_is_held(mock_engine):
    scheduler_service = SchedulerService()

    with (
        patch.object(scheduler_service, "_try_acquire_refresh_lock", new=AsyncMock(return_value=None)) as mock_lock,
        patch.object(scheduler_service, "_release_refresh_lock", new=AsyncMock()) as mock_release,
    ):
        await scheduler_service.refresh_views_light()

    mock_lock.assert_awaited_once_with("light")
    mock_engine.begin.assert_not_called()
    mock_release.assert_not_called()


@pytest.mark.asyncio
async def test_try_acquire_refresh_lock_returns_none_when_held(mock_engine):
    scheduler_service = SchedulerService()
    lock_conn = mock_engine.connect.return_value
    result = MagicMock()
    result.scalar_one.return_value = False
    lock_conn.execute = AsyncMock(return_value=result)

    acquired = await scheduler_service._try_acquire_refresh_lock("light")

    assert acquired is None
    lock_conn.execution_options.assert_awaited_once_with(isolation_level="AUTOCOMMIT")
    execute_args = lock_conn.execute.await_args_list[0]
    assert "pg_try_advisory_lock(:namespace, :resource)" in str(execute_args.args[0])
    assert execute_args.args[1] == {
        "namespace": MV_REFRESH_LOCK_NAMESPACE,
        "resource": MV_REFRESH_LOCK_RESOURCE,
    }
    lock_conn.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_release_refresh_lock_uses_two_key_namespace(mock_engine):
    scheduler_service = SchedulerService()
    lock_conn = AsyncMock()
    result = MagicMock()
    result.scalar_one.return_value = True
    lock_conn.execute = AsyncMock(return_value=result)
    lock_conn.close = AsyncMock()

    await scheduler_service._release_refresh_lock(lock_conn, "light")

    execute_args = lock_conn.execute.await_args_list[0]
    assert "pg_advisory_unlock(:namespace, :resource)" in str(execute_args.args[0])
    assert execute_args.args[1] == {
        "namespace": MV_REFRESH_LOCK_NAMESPACE,
        "resource": MV_REFRESH_LOCK_RESOURCE,
    }
    lock_conn.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_refresh_batch_releases_lock_when_refresh_fails(mock_engine):
    scheduler_service = SchedulerService()
    lock_conn = AsyncMock()
    mock_conn = mock_engine.begin.return_value.__aenter__.return_value
    mock_conn.execute = AsyncMock(side_effect=RuntimeError("boom"))

    with (
        patch.object(scheduler_service, "_try_acquire_refresh_lock", new=AsyncMock(return_value=lock_conn)),
        patch.object(scheduler_service, "_release_refresh_lock", new=AsyncMock()) as mock_release,
        patch.object(scheduler_service, "_log_refresh_failure_snapshot", new=AsyncMock()) as mock_diag,
    ):
        await scheduler_service._run_refresh_batch([("company_totals", False, 30_000)], kind="light")

    mock_diag.assert_awaited_once()
    mock_release.assert_awaited_once_with(lock_conn, "light")


@pytest.mark.asyncio
async def test_log_refresh_failure_snapshot_includes_active_scheduler_jobs(mock_engine):
    scheduler_service = SchedulerService()
    scheduler_service._active_jobs.update({"run_company_updates", "sync_accounting_batch", "refresh_views_light"})

    connect_ctx = AsyncMock()
    lock_conn = AsyncMock()
    connect_ctx.__aenter__.return_value = lock_conn
    connect_ctx.__aexit__.return_value = None
    mock_engine.connect = MagicMock(return_value=connect_ctx)

    refresh_result = MagicMock()
    refresh_result.all.return_value = []
    parallel_result = MagicMock()
    parallel_result.scalar_one.return_value = 0
    lock_conn.execute = AsyncMock(side_effect=[refresh_result, parallel_result])

    with patch("services.scheduler.logger.warning") as mock_warning:
        await scheduler_service._log_refresh_failure_snapshot(
            kind="light",
            view_name="company_totals",
            duration_ms=30_001,
            timeout_ms=30_000,
        )

    logged_args = mock_warning.call_args.args
    assert "active_scheduler_jobs=%s" in logged_args[0]
    assert logged_args[-1] == "run_company_updates,sync_accounting_batch"


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
        patch.object(scheduler_service, "_log_memory_snapshot") as mock_memory,
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
        phases = [call.args[:2] for call in mock_memory.call_args_list]
        assert ("company_updates", "start") in phases
        assert ("company_updates", "done") in phases


@pytest.mark.asyncio
async def test_run_company_updates_preserves_date_cursor_when_batch_has_gap(mock_session_local):
    scheduler_service = SchedulerService()

    with (
        patch.object(scheduler_service, "_log_memory_snapshot"),
        patch("services.update_service.UpdateService") as MockUpdateService,
        patch("repositories.system_repository.SystemRepository") as MockSystemRepo,
    ):
        mock_update = MockUpdateService.return_value
        mock_update.fetch_updates = AsyncMock(
            return_value={
                "latest_oppdateringsid": None,
                "companies_processed": 2,
                "companies_created": 0,
                "companies_updated": 1,
                "errors": ["123456789: API timeout"],
                "cursor_gap_detected": True,
            }
        )

        mock_system = MockSystemRepo.return_value
        mock_system.get_state = AsyncMock(side_effect=[None, "2026-08-16"])
        mock_system.set_state = AsyncMock()

        await scheduler_service.run_company_updates()

        mock_system.set_state.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_accounting_batch(mock_session_local):
    scheduler_service = SchedulerService()

    # Mock database result for orgnrs
    mock_db = mock_session_local.return_value.__aenter__.return_value
    mock_db.execute = AsyncMock(return_value=patch("sqlalchemy.engine.Result").start())
    mock_db.execute.return_value.all.return_value = [("123456789",), ("987654321",)]
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()

    with (
        patch.object(scheduler_service, "_log_memory_snapshot") as mock_memory,
        patch("services.update_service.UpdateService") as MockUpdateService,
    ):
        mock_update = MockUpdateService.return_value
        mock_update._fetch_and_persist_financials = AsyncMock(return_value=FinancialPollOutcome.COMPLETED)

        await scheduler_service.sync_accounting_batch()

        assert mock_update._fetch_and_persist_financials.call_count == 2
        assert mock_db.commit.await_count == 2
        mock_db.rollback.assert_not_awaited()
        selection_stmt = mock_db.execute.await_args_list[0].args[0]
        assert "financial_poll_retry_after" in selection_stmt.text
        assert "retry_cutoff" in mock_db.execute.await_args_list[0].args[1]
        phases = [call.args[:2] for call in mock_memory.call_args_list]
        assert ("accounting_sync", "start") in phases
        assert ("accounting_sync", "selected") in phases
        assert ("accounting_sync", "progress") in phases
        assert ("accounting_sync", "done") in phases


@pytest.mark.asyncio
async def test_sync_accounting_batch_stops_when_circuit_opens(mock_session_local):
    scheduler_service = SchedulerService()
    mock_db = mock_session_local.return_value.__aenter__.return_value
    mock_db.execute = AsyncMock(return_value=patch("sqlalchemy.engine.Result").start())
    mock_db.execute.return_value.all.return_value = [("123456789",), ("234567891",), ("345678912",)]
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()

    with (
        patch.object(scheduler_service, "_log_memory_snapshot") as mock_memory,
        patch("services.update_service.UpdateService") as MockUpdateService,
    ):
        mock_update = MockUpdateService.return_value
        mock_update._fetch_and_persist_financials = AsyncMock(
            side_effect=[FinancialPollOutcome.RETRY_LATER, FinancialPollOutcome.CIRCUIT_OPEN]
        )

        await scheduler_service.sync_accounting_batch()

    assert mock_update._fetch_and_persist_financials.await_count == 2
    mock_db.commit.assert_awaited_once()
    mock_db.rollback.assert_awaited_once()
    done_call = next(call for call in mock_memory.call_args_list if call.args[:2] == ("accounting_sync", "done"))
    assert done_call.kwargs == {
        "attempted": 2,
        "processed": 0,
        "failed": 0,
        "deferred": 2,
        "skipped": 1,
        "total": 3,
    }


@pytest.mark.asyncio
async def test_sync_accounting_batch_reports_terminal_failure_without_success(mock_session_local):
    scheduler_service = SchedulerService()
    mock_db = mock_session_local.return_value.__aenter__.return_value
    mock_db.execute = AsyncMock(return_value=patch("sqlalchemy.engine.Result").start())
    mock_db.execute.return_value.all.return_value = [("123456789",)]
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()

    with (
        patch.object(scheduler_service, "_log_memory_snapshot") as mock_memory,
        patch("services.update_service.UpdateService") as MockUpdateService,
    ):
        mock_update = MockUpdateService.return_value
        mock_update._fetch_and_persist_financials = AsyncMock(return_value=FinancialPollOutcome.TERMINAL_FAILURE)

        await scheduler_service.sync_accounting_batch()

    mock_db.commit.assert_awaited_once()
    mock_db.rollback.assert_not_awaited()
    done_call = next(call for call in mock_memory.call_args_list if call.args[:2] == ("accounting_sync", "done"))
    assert done_call.kwargs["processed"] == 0
    assert done_call.kwargs["failed"] == 1


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
        # execution_options is async on AsyncConnection (returns coroutine)
        conn_options_mock = AsyncMock()
        conn_mock.execution_options = AsyncMock(return_value=conn_options_mock)

        # Mock engine.connect() context manager
        mock_engine.connect.return_value.__aenter__.return_value = conn_mock

        scheduler_service = SchedulerService()
        with patch.object(scheduler_service, "_log_memory_snapshot") as mock_memory:
            await scheduler_service.run_db_maintenance()

        assert conn_mock.execution_options.called
        assert conn_options_mock.execute.called
        execute_sql = [str(call.args[0]) for call in conn_options_mock.execute.await_args_list]
        vacuum_sql = [sql for sql in execute_sql if sql.startswith("VACUUM ANALYZE")]

        assert vacuum_sql == [
            *(f"VACUUM ANALYZE {table}" for table in REGULAR_MAINTENANCE_TABLES),
            f"VACUUM ANALYZE {BEDRIFTER_MAINTENANCE_TABLE}",
        ]
        assert f"SET statement_timeout = {REGULAR_MAINTENANCE_STATEMENT_TIMEOUT_MS}" in execute_sql
        assert f"SET statement_timeout = {BEDRIFTER_MAINTENANCE_STATEMENT_TIMEOUT_MS}" in execute_sql
        assert execute_sql[-1] == "RESET statement_timeout"
        phases = [call.args[:2] for call in mock_memory.call_args_list]
        assert ("db_maintenance", "start") in phases
        assert ("db_maintenance", "done") in phases


@pytest.mark.asyncio
async def test_purge_deleted_companies_does_not_count_first(mock_session_local):
    scheduler_service = SchedulerService()

    mock_db = mock_session_local.return_value.__aenter__.return_value
    empty_result = MagicMock()
    empty_result.fetchall.return_value = []
    mock_db.execute = AsyncMock(return_value=empty_result)
    mock_db.commit = AsyncMock()

    await scheduler_service.purge_deleted_companies()

    execute_sql = [str(call.args[0]) for call in mock_db.execute.await_args_list]
    assert not any("COUNT(*)" in sql for sql in execute_sql)
    purge_selects = [sql for sql in execute_sql if "SELECT orgnr" in sql and "FROM bedrifter" in sql]
    assert len(purge_selects) == 1
    assert "(data->>'slettedato') IS NOT NULL" in purge_selects[0]
    assert "ORDER BY orgnr" in purge_selects[0]
    mock_db.commit.assert_not_called()


def test_log_memory_snapshot_handles_reserved_logging_keys():
    scheduler_service = SchedulerService()

    with patch("services.scheduler.logger.info") as mock_info:
        scheduler_service._log_memory_snapshot("company_updates", "done", created=1, updated=2)

    assert mock_info.called


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
