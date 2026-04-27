import logging
import shutil
import time
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text

from constants.concurrency import SUBUNIT_UPDATE_PAGE_SIZE
from database import AsyncSessionLocal, engine
from services.seo_service import SEOService

logger = logging.getLogger(__name__)

# Tables to vacuum during maintenance (allowlist for safety)
# Regular tables that accumulate data and need periodic VACUUM ANALYZE
MAINTENANCE_TABLES = frozenset(
    [
        "bedrifter",  # Companies
        "underenheter",  # SubUnits
        "roller",  # Roles
        "regnskap",  # Accounting statements
        "municipality_population",  # SSB population data
        "system_state",  # System state tracking
        "sync_errors",  # Sync error log
        "bulk_import_queue",  # Bulk import queue
        "import_batches",  # Import batch tracking (plural!)
    ]
)


class SchedulerService:
    """Background job scheduler for periodic tasks."""

    def __init__(self) -> None:
        self.scheduler = AsyncIOScheduler()
        self._setup_jobs()

    def _setup_jobs(self) -> None:
        now = datetime.now(UTC)

        # Refresh light materialized views every 10 minutes
        # (small/fast views: company_totals, stats, orgform, financials, etc.)
        self.scheduler.add_job(
            self.refresh_views_light,
            trigger=IntervalTrigger(minutes=10, start_date=now + timedelta(seconds=30)),
            id="refresh_views_light",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )

        # Refresh heavy materialized views every 60 minutes
        # (large views: industry_stats 204MB, commercial_people_mv 57MB, person_toplist_mv 120MB)
        self.scheduler.add_job(
            self.refresh_views_heavy,
            trigger=IntervalTrigger(minutes=60, start_date=now + timedelta(minutes=5)),
            id="refresh_views_heavy",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
        )

        # Sync SSB population data weekly (Sundays at 03:00)
        self.scheduler.add_job(
            self.sync_ssb_population,
            trigger=CronTrigger(day_of_week="sun", hour=3, minute=0),
            id="sync_ssb_population",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Geocode companies without coordinates (every 15 minutes)
        self.scheduler.add_job(
            self.geocode_companies_batch,
            trigger=IntervalTrigger(minutes=15),
            id="geocode_companies",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Update company metadata incrementally (every 15 minutes)
        # Replaces legacy bedriftsgrafen-company-updates.service
        self.scheduler.add_job(
            self.run_company_updates,
            trigger=IntervalTrigger(minutes=15),
            id="company_updates",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Sync accounting data for companies (every 5 minutes)
        # Staggered: Start 2 minutes after launch
        self.scheduler.add_job(
            self.sync_accounting_batch,
            trigger=IntervalTrigger(minutes=5, start_date=now + timedelta(minutes=2)),
            id="accounting_sync",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Update subunit metadata (every 15 minutes)
        # Staggered: Start 7 minutes after launch
        self.scheduler.add_job(
            self.run_subunit_updates,
            trigger=IntervalTrigger(minutes=15, start_date=now + timedelta(minutes=7)),
            id="subunit_updates",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Update role metadata (every 30 minutes)
        # Staggered: Start 10 minutes after launch
        self.scheduler.add_job(
            self.run_role_updates,
            trigger=IntervalTrigger(minutes=30, start_date=now + timedelta(minutes=10)),
            id="role_updates",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Database maintenance daily at 03:00 (VACUUM ANALYZE)
        self.scheduler.add_job(
            self.run_db_maintenance,
            trigger=CronTrigger(hour=3, minute=0),
            id="db_maintenance",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Retry failed syncs every hour
        # Staggered: Start 20 minutes after launch
        self.scheduler.add_job(
            self.retry_failed_syncs,
            trigger=IntervalTrigger(hours=1, start_date=now + timedelta(minutes=20)),
            id="retry_syncs",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Check disk usage daily at 06:01
        self.scheduler.add_job(
            self.check_disk_usage,
            trigger=CronTrigger(hour=6, minute=1),
            id="disk_check",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Run proactive repairs daily at 04:00
        self.scheduler.add_job(
            self.run_ghost_repair,
            trigger=CronTrigger(hour=4, minute=0),
            id="ghost_repair",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Run role backfill weekly (Sundays at 04:30)
        self.scheduler.add_job(
            self.run_role_backfill,
            trigger=CronTrigger(day_of_week="sun", hour=4, minute=30),
            id="role_backfill",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Warm sitemap cache every 6 hours
        self.scheduler.add_job(
            self.warm_sitemap_cache,
            trigger=IntervalTrigger(hours=6),
            id="warm_sitemap_cache",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=3600,
        )

        # Purge deleted companies daily at 02:30
        # Removes companies with slettedato from Brønnøysund (GDPR compliance)
        self.scheduler.add_job(
            self.purge_deleted_companies,
            trigger=CronTrigger(hour=2, minute=30),
            id="purge_deleted",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=3600,
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
            ("industry_stats", False, 300_000),  # ~204MB, can take several minutes
            ("commercial_people_mv", True, 300_000),  # ~57MB
            ("person_toplist_mv", True, 600_000),  # ~120MB, needs up to 10 min
        ]
        await self._run_refresh_batch(views, kind="heavy")

    async def _run_refresh_batch(self, views: list[tuple[str, bool, int]], kind: str) -> None:
        """Refresh a batch of materialized views sequentially, each in its own transaction."""
        logger.info("Starting materialized view refresh", extra={"kind": kind, "count": len(views)})
        refreshed = 0
        failed_views: list[str] = []

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
                    "mv_refresh_done",
                    extra={"view": view_name, "duration_ms": duration_ms, "kind": kind},
                )
                refreshed += 1
            except Exception:
                failed_views.append(view_name)
                logger.warning("Failed to refresh materialized view: %s", view_name, exc_info=True)

        if failed_views:
            logger.error(
                "Materialized view refresh partially failed",
                extra={"kind": kind, "refreshed": refreshed, "failed": failed_views},
            )
        else:
            logger.info(
                "Materialized view refresh completed",
                extra={"kind": kind, "views_refreshed": refreshed},
            )

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
        except Exception as e:
            logger.exception("Failed to run incremental company updates", extra={"error": str(e)})

    async def sync_accounting_batch(self) -> None:
        """Sync accounting data for companies needing updates."""
        from datetime import datetime, timedelta

        from services.update_service import UpdateService

        logger.info("Starting accounting sync batch...")
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

                if not orgnrs:
                    logger.info("No companies need accounting sync at this time.")
                    return

                # 2. Process batch
                update_service = UpdateService(db)
                processed = 0
                for orgnr in orgnrs:
                    try:
                        from schemas.brreg import UpdateBatchResult

                        dummy_result = UpdateBatchResult(since_date=datetime.now().date(), since_iso="")
                        await update_service._fetch_and_persist_financials(orgnr, dummy_result)
                        processed += 1
                    except Exception as ex:
                        logger.warning("Failed to sync accounting", extra={"orgnr": orgnr, "error": str(ex)})

                logger.info(
                    "Accounting sync batch completed",
                    extra={"processed": processed, "total": len(orgnrs)},
                )

        except Exception as e:
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
        try:
            # VACUUM must run outside a transaction - use raw connection with autocommit
            async with engine.connect() as conn:
                # Set isolation level to autocommit for VACUUM
                # execution_options is async on AsyncConnection (returns coroutine)
                conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
                for table in MAINTENANCE_TABLES:
                    await conn.execute(text(f"VACUUM ANALYZE {table}"))
                logger.info(
                    "Database maintenance completed",
                    extra={"tables": len(MAINTENANCE_TABLES)},
                )
        except Exception as e:
            logger.exception("Database maintenance failed", extra={"error": str(e)})

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
                # Count first
                count_result = await db.execute(
                    text("SELECT COUNT(*) FROM bedrifter WHERE (data->>'slettedato') IS NOT NULL")
                )
                total = count_result.scalar() or 0

                if total == 0:
                    logger.info("No deleted companies to purge.")
                    return

                logger.info(f"Found {total} deleted companies to purge.")
                purged = 0

                while purged < total:
                    batch_result = await db.execute(
                        text("SELECT orgnr FROM bedrifter WHERE (data->>'slettedato') IS NOT NULL LIMIT :limit"),
                        {"limit": BATCH_SIZE},
                    )
                    batch_orgnrs = [row[0] for row in batch_result.fetchall()]

                    if not batch_orgnrs:
                        break

                    # Cascade delete: roles -> subunits -> accounting -> company
                    await db.execute(delete(Role).where(Role.orgnr.in_(batch_orgnrs)))
                    await db.execute(delete(SubUnit).where(SubUnit.parent_orgnr.in_(batch_orgnrs)))
                    await db.execute(delete(Accounting).where(Accounting.orgnr.in_(batch_orgnrs)))
                    await db.execute(delete(Company).where(Company.orgnr.in_(batch_orgnrs)))
                    await db.commit()

                    purged += len(batch_orgnrs)
                    logger.info(f"Purged batch: {purged}/{total}")

                logger.info(f"Purge complete: {purged} deleted companies removed.")
        except Exception as e:
            logger.exception("Failed to purge deleted companies", extra={"error": str(e)})
