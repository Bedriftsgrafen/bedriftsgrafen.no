import logging
import resource
import shutil
import time
from datetime import UTC, datetime, timedelta
from functools import wraps

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from constants.concurrency import SUBUNIT_UPDATE_PAGE_SIZE
from database import AsyncSessionLocal, engine
from services.seo_service import SEOService

logger = logging.getLogger(__name__)

# Use PostgreSQL's two-key advisory lock space so refresh coordination cannot
# collide with orgnr-based single-key locks used by write paths.
MV_REFRESH_LOCK_NAMESPACE = 7_421
MV_REFRESH_LOCK_RESOURCE = 1

# Tables to vacuum during maintenance (allowlist for safety).
# Keep bedrifter separate so the large registry table cannot prevent smaller
# tables from being maintained when it needs a larger maintenance budget.
BEDRIFTER_MAINTENANCE_TABLE = "bedrifter"
REGULAR_MAINTENANCE_TABLES = (
    "underenheter",  # SubUnits
    "roller",  # Roles
    "regnskap",  # Accounting statements
    "municipality_population",  # SSB population data
    "system_state",  # System state tracking
    "sync_errors",  # Sync error log
    "bulk_import_queue",  # Bulk import queue
    "import_batches",  # Import batch tracking (plural!)
)
MAINTENANCE_TABLES = (*REGULAR_MAINTENANCE_TABLES, BEDRIFTER_MAINTENANCE_TABLE)
REGULAR_MAINTENANCE_STATEMENT_TIMEOUT_MS = 60_000
BEDRIFTER_MAINTENANCE_STATEMENT_TIMEOUT_MS = 300_000


class SchedulerService:
    """Background job scheduler for periodic tasks."""

    def __init__(self) -> None:
        self.scheduler = AsyncIOScheduler()
        self._active_jobs: set[str] = set()
        self._setup_jobs()

    def _wrap_job(self, job_id: str, func):
        """Track scheduler-owned job activity for lightweight diagnostics."""

        @wraps(func)
        async def runner(*args, **kwargs):
            self._active_jobs.add(job_id)
            try:
                return await func(*args, **kwargs)
            finally:
                self._active_jobs.discard(job_id)

        return runner

    def _setup_jobs(self) -> None:
        now = datetime.now(UTC)

        # Refresh light materialized views every 10 minutes
        # (small/fast views: company_totals, stats, orgform, financials, etc.)
        self.scheduler.add_job(
            self._wrap_job("refresh_views_light", self.refresh_views_light),
            trigger=IntervalTrigger(minutes=10, start_date=now + timedelta(seconds=30)),
            id="refresh_views_light",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )

        # Refresh expensive materialized views every 60 minutes.
        # Runtime is driven by source-table aggregation cost, not just MV size.
        self.scheduler.add_job(
            self._wrap_job("refresh_views_heavy", self.refresh_views_heavy),
            trigger=IntervalTrigger(minutes=60, start_date=now + timedelta(minutes=5)),
            id="refresh_views_heavy",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
        )

        # Sync SSB population data weekly (Sundays at 03:00)
        self.scheduler.add_job(
            self._wrap_job("sync_ssb_population", self.sync_ssb_population),
            trigger=CronTrigger(day_of_week="sun", hour=3, minute=0),
            id="sync_ssb_population",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Geocode companies without coordinates (every 15 minutes)
        self.scheduler.add_job(
            self._wrap_job("geocode_companies_batch", self.geocode_companies_batch),
            trigger=IntervalTrigger(minutes=15),
            id="geocode_companies",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Update company metadata incrementally (every 15 minutes)
        # Replaces legacy bedriftsgrafen-company-updates.service
        self.scheduler.add_job(
            self._wrap_job("run_company_updates", self.run_company_updates),
            trigger=IntervalTrigger(minutes=15),
            id="company_updates",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Sync accounting data for companies (every 5 minutes)
        # Staggered: Start 2 minutes after launch
        self.scheduler.add_job(
            self._wrap_job("sync_accounting_batch", self.sync_accounting_batch),
            trigger=IntervalTrigger(minutes=5, start_date=now + timedelta(minutes=2)),
            id="accounting_sync",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Update subunit metadata (every 15 minutes)
        # Staggered: Start 7 minutes after launch
        self.scheduler.add_job(
            self._wrap_job("run_subunit_updates", self.run_subunit_updates),
            trigger=IntervalTrigger(minutes=15, start_date=now + timedelta(minutes=7)),
            id="subunit_updates",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Update role metadata (every 30 minutes)
        # Staggered: Start 10 minutes after launch
        self.scheduler.add_job(
            self._wrap_job("run_role_updates", self.run_role_updates),
            trigger=IntervalTrigger(minutes=30, start_date=now + timedelta(minutes=10)),
            id="role_updates",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Database maintenance daily at 03:00 (VACUUM ANALYZE)
        self.scheduler.add_job(
            self._wrap_job("run_db_maintenance", self.run_db_maintenance),
            trigger=CronTrigger(hour=3, minute=0),
            id="db_maintenance",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Retry failed syncs every hour
        # Staggered: Start 20 minutes after launch
        self.scheduler.add_job(
            self._wrap_job("retry_failed_syncs", self.retry_failed_syncs),
            trigger=IntervalTrigger(hours=1, start_date=now + timedelta(minutes=20)),
            id="retry_syncs",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Check disk usage daily at 06:01
        self.scheduler.add_job(
            self._wrap_job("disk_check", self.check_disk_usage),
            trigger=CronTrigger(hour=6, minute=1),
            id="disk_check",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Run proactive repairs daily at 04:00
        self.scheduler.add_job(
            self._wrap_job("run_ghost_repair", self.run_ghost_repair),
            trigger=CronTrigger(hour=4, minute=0),
            id="ghost_repair",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Run role backfill weekly (Sundays at 04:30)
        self.scheduler.add_job(
            self._wrap_job("role_backfill", self.run_role_backfill),
            trigger=CronTrigger(day_of_week="sun", hour=4, minute=30),
            id="role_backfill",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Warm sitemap cache every 6 hours
        self.scheduler.add_job(
            self._wrap_job("warm_sitemap_cache", self.warm_sitemap_cache),
            trigger=IntervalTrigger(hours=6),
            id="warm_sitemap_cache",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=3600,
        )

        # Purge deleted companies daily at 02:30
        # Removes companies with slettedato from Brønnøysund (GDPR compliance)
        self.scheduler.add_job(
            self._wrap_job("purge_deleted_companies", self.purge_deleted_companies),
            trigger=CronTrigger(hour=2, minute=30),
            id="purge_deleted",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=3600,
        )

    @staticmethod
    def _read_memory_value(path: str) -> int | None:
        """Read a numeric cgroup memory file if available."""
        try:
            with open(path, encoding="utf-8") as file_handle:
                value = file_handle.read().strip()
        except OSError:
            return None

        return int(value) if value.isdigit() else None

    def _get_memory_snapshot(self) -> dict[str, int | None]:
        """Capture current process and cgroup memory with minimal overhead."""
        rss_kb = None
        hwm_kb = None

        try:
            with open("/proc/self/status", encoding="utf-8") as status_file:
                for line in status_file:
                    if line.startswith("VmRSS:"):
                        rss_value = line.split()[1]
                        rss_kb = int(rss_value) if rss_value.isdigit() else None
                    elif line.startswith("VmHWM:"):
                        hwm_value = line.split()[1]
                        hwm_kb = int(hwm_value) if hwm_value.isdigit() else None
        except OSError:
            pass

        return {
            "rss_kb": rss_kb,
            "hwm_kb": hwm_kb,
            "ru_maxrss_kb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            "cgroup_memory_current_bytes": self._read_memory_value("/sys/fs/cgroup/memory.current"),
            "cgroup_memory_max_bytes": self._read_memory_value("/sys/fs/cgroup/memory.max"),
            "cgroup_swap_current_bytes": self._read_memory_value("/sys/fs/cgroup/memory.swap.current"),
            "cgroup_swap_max_bytes": self._read_memory_value("/sys/fs/cgroup/memory.swap.max"),
        }

    def _log_memory_snapshot(self, job: str, phase: str, **extra: object) -> None:
        """Emit structured memory telemetry for worker OOM investigations."""
        snapshot = self._get_memory_snapshot()
        safe_extra = {f"metric_{key}": value for key, value in extra.items()}
        extra_tokens = " ".join(
            f"{key}={value}"
            for key, value in extra.items()
            if value is not None and (isinstance(value, int | bool) or (isinstance(value, str) and " " not in value))
        )
        message = (
            "scheduler_memory job=%s phase=%s rss_kb=%s hwm_kb=%s ru_maxrss_kb=%s "
            "cgroup_memory_current_bytes=%s cgroup_memory_max_bytes=%s "
            "cgroup_swap_current_bytes=%s cgroup_swap_max_bytes=%s"
        )
        if extra_tokens:
            message = f"{message} {extra_tokens}"

        logger.info(
            message,
            job,
            phase,
            snapshot["rss_kb"],
            snapshot["hwm_kb"],
            snapshot["ru_maxrss_kb"],
            snapshot["cgroup_memory_current_bytes"],
            snapshot["cgroup_memory_max_bytes"],
            snapshot["cgroup_swap_current_bytes"],
            snapshot["cgroup_swap_max_bytes"],
            extra={"job": job, "phase": phase, **snapshot, **safe_extra},
        )

    async def start(self) -> None:
        self.scheduler.start()
        logger.info("Scheduler started", extra={"jobs": [job.id for job in self.scheduler.get_jobs()]})

    async def shutdown(self) -> None:
        self.scheduler.shutdown()
        logger.info("Scheduler shutdown")

    async def refresh_views_light(self) -> None:
        """Refresh small/fast materialized views (every 10 min).

        All MV refreshes are owned by this scheduler — no other code path
        may issue REFRESH MATERIALIZED VIEW.
        """
        views: list[tuple[str, bool, int]] = [
            # (view_name, run_analyze, statement_timeout_ms)
            ("company_totals", True, 30_000),
            ("industry_subclass_stats", False, 30_000),
            ("county_stats", False, 30_000),
            ("municipality_stats", False, 30_000),
            ("orgform_counts", False, 30_000),
            ("latest_financials", True, 30_000),
            ("latest_accountings", True, 30_000),
            ("person_landing_stats_mv", True, 30_000),
        ]
        await self._run_refresh_batch(views, kind="light")

    async def refresh_views_heavy(self) -> None:
        """Refresh large/slow materialized views (every 60 min).

        All MV refreshes are owned by this scheduler — no other code path
        may issue REFRESH MATERIALIZED VIEW.
        """
        views: list[tuple[str, bool, int]] = [
            # (view_name, run_analyze, statement_timeout_ms)
            ("industry_stats", True, 300_000),  # Small output, expensive source aggregation
            ("commercial_people_mv", True, 300_000),  # ~57MB
            ("person_toplist_mv", True, 600_000),  # ~120MB, needs up to 10 min
        ]
        await self._run_refresh_batch(views, kind="heavy")

    async def _try_acquire_refresh_lock(self, kind: str) -> AsyncConnection | None:
        """Acquire a session advisory lock and keep its connection alive for the whole batch."""
        lock_conn = await engine.connect()
        try:
            lock_conn = await lock_conn.execution_options(isolation_level="AUTOCOMMIT")
            acquired = bool(
                (
                    await lock_conn.execute(
                        text("SELECT pg_try_advisory_lock(:namespace, :resource)"),
                        {
                            "namespace": MV_REFRESH_LOCK_NAMESPACE,
                            "resource": MV_REFRESH_LOCK_RESOURCE,
                        },
                    )
                ).scalar_one()
            )
            if not acquired:
                logger.info("mv_batch_skipped kind=%s reason=global_lock_held", kind)
                await lock_conn.close()
                return None

            return lock_conn
        except Exception:
            logger.exception(
                "mv_batch_lock_failed kind=%s lock_namespace=%s lock_resource=%s",
                kind,
                MV_REFRESH_LOCK_NAMESPACE,
                MV_REFRESH_LOCK_RESOURCE,
            )
            await lock_conn.close()
            raise

    async def _release_refresh_lock(self, lock_conn: AsyncConnection, kind: str) -> None:
        """Release the session advisory lock and close its owning connection."""
        try:
            released = bool(
                (
                    await lock_conn.execute(
                        text("SELECT pg_advisory_unlock(:namespace, :resource)"),
                        {
                            "namespace": MV_REFRESH_LOCK_NAMESPACE,
                            "resource": MV_REFRESH_LOCK_RESOURCE,
                        },
                    )
                ).scalar_one()
            )
            if not released:
                logger.warning(
                    "mv_batch_unlock_mismatch kind=%s lock_namespace=%s lock_resource=%s",
                    kind,
                    MV_REFRESH_LOCK_NAMESPACE,
                    MV_REFRESH_LOCK_RESOURCE,
                )
        except Exception:
            logger.exception(
                "mv_batch_unlock_failed kind=%s lock_namespace=%s lock_resource=%s",
                kind,
                MV_REFRESH_LOCK_NAMESPACE,
                MV_REFRESH_LOCK_RESOURCE,
            )
        finally:
            await lock_conn.close()

    @staticmethod
    def _compact_query(query: str, max_len: int = 120) -> str:
        compact = " ".join(query.split())
        if len(compact) <= max_len:
            return compact
        return compact[: max_len - 3] + "..."

    async def _log_refresh_failure_snapshot(
        self,
        *,
        kind: str,
        view_name: str,
        duration_ms: int,
        timeout_ms: int,
    ) -> None:
        try:
            async with engine.connect() as conn:
                refresh_rows = (
                    await conn.execute(
                        text(
                            """
                            SELECT pid, query
                            FROM pg_stat_activity
                            WHERE state = 'active'
                              AND query ILIKE 'REFRESH MATERIALIZED VIEW%'
                            ORDER BY pid
                            """
                        )
                    )
                ).all()
                parallel_workers = int(
                    (
                        await conn.execute(
                            text(
                                """
                                WITH refreshes AS (
                                    SELECT pid
                                    FROM pg_stat_activity
                                    WHERE state = 'active'
                                      AND query ILIKE 'REFRESH MATERIALIZED VIEW%'
                                )
                                SELECT COUNT(*)
                                FROM pg_stat_activity
                                WHERE backend_type = 'parallel worker'
                                  AND leader_pid IN (SELECT pid FROM refreshes)
                                """
                            )
                        )
                    ).scalar_one()
                )
        except Exception as exc:
            logger.warning(
                "mv_refresh_diag_unavailable kind=%s view=%s duration_ms=%s timeout_ms=%s error=%s",
                kind,
                view_name,
                duration_ms,
                timeout_ms,
                exc,
            )
            return

        active_scheduler_jobs = (
            ",".join(sorted(job_id for job_id in self._active_jobs if not job_id.startswith("refresh_views_")))
            or "none"
        )
        active_refreshes = ";".join(f"{pid}:{self._compact_query(str(query))}" for pid, query in refresh_rows) or "none"
        logger.warning(
            "mv_refresh_diag kind=%s view=%s duration_ms=%s timeout_ms=%s active_refreshes=%s parallel_workers=%s active_scheduler_jobs=%s",
            kind,
            view_name,
            duration_ms,
            timeout_ms,
            active_refreshes,
            parallel_workers,
            active_scheduler_jobs,
        )

    async def _run_refresh_batch(self, views: list[tuple[str, bool, int]], kind: str) -> None:
        """Refresh a batch of materialized views sequentially, each in its own transaction."""
        lock_conn = await self._try_acquire_refresh_lock(kind)
        if lock_conn is None:
            return

        logger.info("mv_batch_start kind=%s views=%s", kind, len(views))
        batch_t0 = time.monotonic()
        refreshed = 0
        failed_views: list[str] = []

        try:
            for view_name, run_analyze, timeout_ms in views:
                t0 = time.monotonic()
                try:
                    async with engine.begin() as conn:
                        await conn.execute(text(f"SET LOCAL statement_timeout = '{timeout_ms}'"))
                        await conn.execute(
                            text(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view_name}")
                        )  # view_name from allowlist
                        if run_analyze:
                            await conn.execute(text(f"ANALYZE {view_name}"))  # view_name from allowlist
                    duration_ms = int((time.monotonic() - t0) * 1000)
                    logger.info(
                        "mv_refresh_done kind=%s view=%s duration_ms=%s timeout_ms=%s",
                        kind,
                        view_name,
                        duration_ms,
                        timeout_ms,
                    )
                    refreshed += 1
                except Exception:
                    duration_ms = int((time.monotonic() - t0) * 1000)
                    failed_views.append(view_name)
                    logger.warning(
                        "mv_refresh_failed kind=%s view=%s duration_ms=%s timeout_ms=%s",
                        kind,
                        view_name,
                        duration_ms,
                        timeout_ms,
                        exc_info=True,
                    )
                    await self._log_refresh_failure_snapshot(
                        kind=kind,
                        view_name=view_name,
                        duration_ms=duration_ms,
                        timeout_ms=timeout_ms,
                    )

            batch_duration_ms = int((time.monotonic() - batch_t0) * 1000)
            if failed_views:
                logger.error(
                    "mv_batch_partial kind=%s refreshed=%s failed=%s failed_views=%s duration_ms=%s",
                    kind,
                    refreshed,
                    len(failed_views),
                    ",".join(failed_views),
                    batch_duration_ms,
                )
            else:
                logger.info(
                    "mv_batch_done kind=%s refreshed=%s failed=0 duration_ms=%s",
                    kind,
                    refreshed,
                    batch_duration_ms,
                )
        finally:
            await self._release_refresh_lock(lock_conn, kind)

    async def sync_ssb_population(self) -> None:
        """Sync municipality population data from SSB."""
        from services.ssb_service import SsbService  # Import here to avoid circular imports

        logger.info("Starting SSB population sync...")
        try:
            async with AsyncSessionLocal() as db:
                service = SsbService(db)
                result = await service.fetch_and_store_population()
                logger.info(
                    "SSB population sync completed",
                    extra={"year": result.get("year"), "count": result.get("municipality_count")},
                )
        except Exception as e:
            logger.exception("Failed to sync SSB population", extra={"error": str(e)})

    async def geocode_companies_batch(self) -> None:
        """Geocode a batch of companies without coordinates."""
        from services.geocoding_batch_service import GeocodingBatchService

        logger.info("Starting geocoding batch...")
        try:
            # Use async context manager for session
            async with AsyncSessionLocal() as db:
                try:
                    service = GeocodingBatchService(db)
                    result = await service.run_batch(batch_size=100)

                    # Log progress
                    if result["processed"] > 0:
                        logger.info(
                            "Geocoding batch completed",
                            extra={
                                "success": result["success"],
                                "failed": result["failed"],
                                "remaining": result["remaining"],
                                "total_geocoded": result["total_geocoded"],
                            },
                        )
                    else:
                        logger.info("No companies need geocoding")
                except Exception:
                    logger.exception("Geocoding batch service failed")
                    await db.rollback()
                    raise
        except Exception as e:
            logger.exception("Failed to run geocoding batch", extra={"error": str(e)})

    async def run_company_updates(self) -> None:
        """Fetch incremental company updates from Brønnøysund."""
        from datetime import date, timedelta

        from repositories.system_repository import SystemRepository
        from services.update_service import UpdateService

        logger.info("Starting incremental company updates...")
        self._log_memory_snapshot("company_updates", "start")
        try:
            async with AsyncSessionLocal() as db:
                service = UpdateService(db)
                system_repo = SystemRepository(db)

                # Get state
                latest_id_str = await system_repo.get_state("company_update_latest_id")
                last_sync_date_str = await system_repo.get_state("company_update_last_sync_date")

                start_id = int(latest_id_str) if latest_id_str and latest_id_str.isdigit() else None
                since_date = (
                    date.fromisoformat(last_sync_date_str) if last_sync_date_str else (date.today() - timedelta(days=1))
                )

                result = await service.fetch_updates(since_date=since_date, start_id=start_id)

                # Update state
                if result.get("latest_oppdateringsid"):
                    await system_repo.set_state("company_update_latest_id", str(result["latest_oppdateringsid"]))

                if result.get("companies_processed", 0) > 0 or not result.get("errors"):
                    await system_repo.set_state("company_update_last_sync_date", date.today().isoformat())

                logger.info(
                    "Company updates completed",
                    extra={
                        "processed": result.get("companies_processed"),
                        "new": result.get("companies_created"),
                        "updated": result.get("companies_updated"),
                    },
                )
                self._log_memory_snapshot(
                    "company_updates",
                    "done",
                    processed=result.get("companies_processed", 0),
                    created=result.get("companies_created", 0),
                    updated=result.get("companies_updated", 0),
                )
        except Exception as e:
            self._log_memory_snapshot("company_updates", "failed", error=str(e))
            logger.exception("Failed to run incremental company updates", extra={"error": str(e)})

    async def sync_accounting_batch(self) -> None:
        """Sync accounting data for companies needing updates."""
        from datetime import datetime, timedelta

        from services.update_service import UpdateService

        logger.info("Starting accounting sync batch...")
        self._log_memory_snapshot("accounting_sync", "start")
        try:
            async with AsyncSessionLocal() as db:
                # 1. Selection logic: New companies first, then oldest polled ones
                # Priority: never polled -> oldest polled
                limit = 50
                cutoff_date = datetime.now(UTC).date() - timedelta(days=30)

                # UNION ALL so each branch uses its own index:
                #   - never-polled branch: idx_bedrifter_needs_financial_polling (partial index on IS NULL)
                #   - stale branch: ix_bedrifter_last_polled_regnskap (B-tree index + ORDER BY LIMIT)
                # Avoids a full sequential scan caused by the OR predicate on 1.14M rows.
                union_stmt = text("""
                    (SELECT orgnr FROM bedrifter
                     WHERE last_polled_regnskap IS NULL
                     ORDER BY orgnr LIMIT :lim)
                    UNION ALL
                    (SELECT orgnr FROM bedrifter
                     WHERE last_polled_regnskap <= :cutoff
                     ORDER BY last_polled_regnskap ASC LIMIT :lim)
                    LIMIT :lim
                """)

                result = await db.execute(union_stmt, {"cutoff": cutoff_date, "lim": limit})
                orgnrs = [row[0] for row in result.all()]
                total = len(orgnrs)

                self._log_memory_snapshot("accounting_sync", "selected", selected=total, limit=limit)

                if not orgnrs:
                    logger.info("No companies need accounting sync at this time.")
                    self._log_memory_snapshot("accounting_sync", "empty")
                    return

                # 2. Process batch
                update_service = UpdateService(db)
                processed = 0
                for attempt_index, orgnr in enumerate(orgnrs, start=1):
                    try:
                        from schemas.brreg import UpdateBatchResult

                        dummy_result = UpdateBatchResult(since_date=datetime.now().date(), since_iso="")
                        await update_service._fetch_and_persist_financials(orgnr, dummy_result)
                        processed += 1
                    except Exception as ex:
                        logger.warning("Failed to sync accounting", extra={"orgnr": orgnr, "error": str(ex)})

                    if attempt_index % 10 == 0 or attempt_index == total:
                        self._log_memory_snapshot(
                            "accounting_sync",
                            "progress",
                            attempted=attempt_index,
                            processed=processed,
                            total=total,
                        )

                logger.info(
                    "Accounting sync batch completed",
                    extra={"processed": processed, "total": total},
                )
                self._log_memory_snapshot(
                    "accounting_sync",
                    "done",
                    processed=processed,
                    total=total,
                )

        except Exception as e:
            self._log_memory_snapshot("accounting_sync", "failed", error=str(e))
            logger.exception("Failed to run accounting sync batch", extra={"error": str(e)})

    async def run_subunit_updates(self) -> None:
        """Fetch incremental subunit updates."""
        from datetime import date

        from repositories.system_repository import SystemRepository
        from services.update_service import UpdateService

        logger.info("Starting incremental subunit updates...")
        try:
            async with AsyncSessionLocal() as db:
                service = UpdateService(db)
                system_repo = SystemRepository(db)

                # Get state
                latest_id_str = await system_repo.get_state("subunit_update_latest_id")
                start_id = int(latest_id_str) if latest_id_str and latest_id_str.isdigit() else None

                # Default lookback of 30 days if no state exists
                since_date = (date.today() - timedelta(days=30)) if not start_id else None

                result = await service.fetch_subunit_updates(
                    since_date=since_date, start_id=start_id, page_size=SUBUNIT_UPDATE_PAGE_SIZE
                )

                # Update state
                if result.get("latest_oppdateringsid"):
                    await system_repo.set_state("subunit_update_latest_id", str(result["latest_oppdateringsid"]))

                logger.info(
                    "Subunit updates completed",
                    extra={
                        "processed": result.get("companies_processed"),
                        "updated": result.get("companies_updated"),
                    },
                )
        except Exception as e:
            logger.exception("Failed to run incremental subunit updates", extra={"error": str(e)})

    async def run_role_updates(self) -> None:
        """Fetch incremental role updates."""
        from datetime import date

        from repositories.system_repository import SystemRepository
        from services.update_service import UpdateService

        logger.info("Starting incremental role updates...")
        try:
            async with AsyncSessionLocal() as db:
                service = UpdateService(db)
                system_repo = SystemRepository(db)

                # Get state
                after_id_str = await system_repo.get_state("role_update_latest_id")
                after_id = int(after_id_str) if after_id_str and after_id_str.isdigit() else None

                # Default lookback of 30 days if no state exists
                since_date = (date.today() - timedelta(days=30)) if not after_id else None

                result = await service.fetch_role_updates(since_date=since_date, after_id=after_id)

                # Update state
                if result.get("latest_oppdateringsid"):
                    await system_repo.set_state("role_update_latest_id", str(result["latest_oppdateringsid"]))

                logger.info(
                    "Role updates completed",
                    extra={
                        "processed": result.get("companies_processed"),
                        "updated": result.get("companies_updated"),
                    },
                )
        except Exception as e:
            logger.exception("Failed to run incremental role updates", extra={"error": str(e)})

    async def run_db_maintenance(self) -> None:
        """Runs VACUUM ANALYZE on main tables for performance optimization.

        Note: VACUUM cannot run inside a transaction, so we use autocommit mode.
        """
        logger.info("Starting database maintenance (VACUUM ANALYZE)...")
        self._log_memory_snapshot("db_maintenance", "start", tables=len(MAINTENANCE_TABLES))
        try:
            # VACUUM must run outside a transaction - use raw connection with autocommit
            async with engine.connect() as conn:
                # Set isolation level to autocommit for VACUUM
                # execution_options is async on AsyncConnection (returns coroutine)
                conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
                try:
                    for table in REGULAR_MAINTENANCE_TABLES:
                        await self._vacuum_analyze_table(
                            conn,
                            table,
                            REGULAR_MAINTENANCE_STATEMENT_TIMEOUT_MS,
                        )

                    await self._vacuum_analyze_table(
                        conn,
                        BEDRIFTER_MAINTENANCE_TABLE,
                        BEDRIFTER_MAINTENANCE_STATEMENT_TIMEOUT_MS,
                    )
                finally:
                    await conn.execute(text("RESET statement_timeout"))

                logger.info(
                    "Database maintenance completed",
                    extra={"tables": len(MAINTENANCE_TABLES)},
                )
                self._log_memory_snapshot("db_maintenance", "done", tables=len(MAINTENANCE_TABLES))
        except Exception as e:
            self._log_memory_snapshot("db_maintenance", "failed", error=str(e), tables=len(MAINTENANCE_TABLES))
            logger.exception("Database maintenance failed", extra={"error": str(e)})

    async def _vacuum_analyze_table(self, conn: AsyncConnection, table: str, timeout_ms: int) -> None:
        await conn.execute(text(f"SET statement_timeout = {timeout_ms}"))
        await conn.execute(text(f"VACUUM ANALYZE {table}"))
        logger.info(
            f"db_maintenance_table_done table={table} timeout_ms={timeout_ms}",
            extra={"table": table, "timeout_ms": timeout_ms},
        )

    async def check_disk_usage(self) -> None:
        """Checks disk usage on the root partition and logs warnings if high."""
        logger.info("Checking disk usage...")
        try:
            total, used, _free = shutil.disk_usage("/")
            usage_percent = (used / total) * 100
            if usage_percent > 80:
                logger.warning(f"HIGH DISK USAGE: {usage_percent:.1f}% used on root partition")
            else:
                logger.info(f"Disk usage OK: {usage_percent:.1f}%")
        except Exception as e:
            logger.error(f"Disk usage check failed: {e}")

    async def retry_failed_syncs(self) -> None:
        """Retry failed synchronization attempts.

        Uses proper state management to ensure consistent error status.
        """
        from datetime import datetime

        from sqlalchemy import delete, select

        from models import Role, SyncError, SyncErrorStatus
        from services.brreg_mappers import map_role_from_api
        from services.update_service import UpdateService

        logger.info("Starting retry of failed syncs...")
        try:
            async with AsyncSessionLocal() as db:
                # Fetch pending errors that haven't hit max attempts
                stmt = select(SyncError).where(
                    SyncError.status.in_([SyncErrorStatus.PENDING, SyncErrorStatus.RETRYING]),
                    SyncError.attempt_count < 5,
                )
                result = await db.execute(stmt)
                errors = result.scalars().all()

                if not errors:
                    logger.info("No failed syncs to retry.")
                    return

                update_service = UpdateService(db)
                resolved_count = 0

                for error in errors:
                    # Track attempt before trying
                    error.attempt_count += 1
                    error.last_retry_at = datetime.now(UTC)
                    success = False

                    try:
                        if error.entity_type == "company":
                            parent_data = await update_service.brreg_api.fetch_company(error.orgnr)
                            if parent_data:
                                res = await update_service.company_repo.create_or_update(parent_data)
                                if res:
                                    success = True

                        elif error.entity_type == "role":
                            # Delete old roles first to prevent duplicates
                            await db.execute(delete(Role).where(Role.orgnr == error.orgnr))

                            roles_data = await update_service.brreg_api.fetch_roles(error.orgnr)
                            roles = [map_role_from_api(r, error.orgnr) for r in roles_data]
                            if roles:
                                await update_service.role_repo.create_batch(roles, commit=False)
                            success = True

                        # Update status based on result
                        if success:
                            error.status = SyncErrorStatus.RESOLVED
                            error.resolved_at = datetime.now(UTC)
                            resolved_count += 1
                            logger.info(f"Resolved sync error for {error.orgnr}")
                        else:
                            error.status = SyncErrorStatus.RETRYING

                    except Exception as ex:
                        logger.warning(f"Retry failed for {error.orgnr}: {ex}")
                        if error.attempt_count >= 5:
                            error.status = SyncErrorStatus.PERMANENT_FAILURE
                        else:
                            error.status = SyncErrorStatus.PENDING  # Reset to pending for next retry

                    # Commit after each error to preserve progress
                    try:
                        await db.commit()
                    except Exception as commit_err:
                        logger.warning(f"Commit failed for {error.orgnr}, rolling back: {commit_err}")
                        await db.rollback()

                logger.info(
                    "Retry batch completed",
                    extra={"resolved": resolved_count, "total": len(errors)},
                )

        except Exception as e:
            logger.exception("Failed to run retry_failed_syncs", extra={"error": str(e)})

    async def run_ghost_repair(self) -> None:
        """Daily: Fix subunits referencing non-existent parent companies (critical FK integrity)."""
        from services.repair_service import RepairService

        logger.info("Starting daily ghost repair...")
        try:
            async with AsyncSessionLocal() as db:
                service = RepairService(db, repair=True)
                await service.fix_ghost_parents(limit=500)
                logger.info("Daily ghost repair completed successfully.")
        except Exception as e:
            logger.exception("Failed to run ghost repair", extra={"error": str(e)})

    async def run_role_backfill(self) -> None:
        """Weekly: Backfill roles for companies to build Role Network dataset."""
        from services.repair_service import RepairService

        logger.info("Starting weekly role backfill...")
        try:
            async with AsyncSessionLocal() as db:
                service = RepairService(db, repair=True)
                await service.backfill_roles(limit=500)
                logger.info("Weekly role backfill completed successfully.")
        except Exception as e:
            logger.exception("Failed to run role backfill", extra={"error": str(e)})

    async def cleanup_import_queue(self) -> None:
        """Weekly: Clean up old completed/failed entries from bulk_import_queue.

        Removes entries older than 7 days that are in terminal states (COMPLETED, FAILED, SKIPPED)
        to prevent table bloat and maintain query performance.
        """
        from datetime import datetime, timedelta

        from sqlalchemy import delete

        from models_import import BulkImportQueue, ImportStatus

        logger.info("Starting bulk import queue cleanup...")
        try:
            async with AsyncSessionLocal() as db:
                cutoff_date = datetime.now(UTC) - timedelta(days=7)

                # Delete old terminal-state entries
                stmt = delete(BulkImportQueue).where(
                    BulkImportQueue.status.in_([ImportStatus.COMPLETED, ImportStatus.FAILED, ImportStatus.SKIPPED]),
                    BulkImportQueue.completed_at < cutoff_date,
                )

                result = await db.execute(stmt)
                await db.commit()

                deleted_count: int = result.rowcount  # type: ignore[attr-defined]
                logger.info("Bulk import queue cleanup completed", extra={"deleted": deleted_count, "cutoff_days": 7})
        except Exception as e:
            logger.exception("Failed to cleanup import queue", extra={"error": str(e)})

    async def warm_sitemap_cache(self) -> None:
        """Proactively refreshes the sitemap cache to avoid slow first requests."""
        logger.info("Proactively warming sitemap cache...")
        try:
            async with AsyncSessionLocal() as db:
                seo_service = SEOService(db)
                await seo_service.get_sitemap_data(force_refresh=True)
                logger.info("Sitemap cache warmed successfully")
        except Exception as e:
            logger.error(f"Error warming sitemap cache: {e}")

    async def purge_deleted_companies(self) -> None:
        """Daily: Purge companies marked as deleted by Brønnøysund (slettedato set).

        GDPR compliance: Companies with a deletion date from the source registry
        should not remain in our database. Cascades to roles, subunits, and accounting.

        Cascade coverage audit (2026-03-23):
        - This method deletes roles explicitly before companies ✓
        - crud.py:purge_company() also deletes roles before company ✓
        - No other code path deletes from bedrifter without cleaning up roles.
        """
        from sqlalchemy import delete

        from models import Accounting, Company, Role, SubUnit

        BATCH_SIZE = 1000
        logger.info("Starting purge of deleted companies...")
        try:
            async with AsyncSessionLocal() as db:
                purged = 0

                while True:
                    batch_result = await db.execute(
                        text(
                            """
                            SELECT orgnr
                            FROM bedrifter
                            WHERE (data->>'slettedato') IS NOT NULL
                            ORDER BY orgnr
                            LIMIT :limit
                            """
                        ),
                        {"limit": BATCH_SIZE},
                    )
                    batch_orgnrs = [row[0] for row in batch_result.fetchall()]

                    if not batch_orgnrs:
                        break

                    logger.info(f"Found {len(batch_orgnrs)} deleted companies to purge in next batch.")

                    # Cascade delete: roles -> subunits -> accounting -> company
                    await db.execute(delete(Role).where(Role.orgnr.in_(batch_orgnrs)))
                    await db.execute(delete(SubUnit).where(SubUnit.parent_orgnr.in_(batch_orgnrs)))
                    await db.execute(delete(Accounting).where(Accounting.orgnr.in_(batch_orgnrs)))
                    await db.execute(delete(Company).where(Company.orgnr.in_(batch_orgnrs)))
                    await db.commit()

                    purged += len(batch_orgnrs)
                    logger.info(f"Purged batch: {purged} deleted companies removed so far.")

                if purged == 0:
                    logger.info("No deleted companies to purge.")
                else:
                    logger.info(f"Purge complete: {purged} deleted companies removed.")
        except Exception as e:
            logger.exception("Failed to purge deleted companies", extra={"error": str(e)})
