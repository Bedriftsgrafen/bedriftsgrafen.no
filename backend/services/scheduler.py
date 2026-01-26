import logging
import shutil
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text

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
        now = datetime.now(timezone.utc)

        # Refresh materialized views every 5 minutes
        self.scheduler.add_job(
            self.refresh_materialized_views,
            trigger=IntervalTrigger(minutes=5),
            id="refresh_views",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
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

    async def start(self) -> None:
        self.scheduler.start()
        logger.info("Scheduler started", extra={"jobs": [job.id for job in self.scheduler.get_jobs()]})

    async def shutdown(self) -> None:
        self.scheduler.shutdown()
        logger.info("Scheduler shutdown")

    async def refresh_materialized_views(self) -> None:
        """Refreshes all materialized views used for statistics and caching.

        Uses CONCURRENTLY to prevent table locks so reads can continue.
        Views must have unique indexes to support concurrent refresh.
        """
        logger.info("Starting materialized view refresh (CONCURRENTLY)...")
        try:
            async with engine.begin() as conn:
                # Core statistics views (refreshed every 5 minutes)
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY company_totals;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY industry_stats;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY industry_subclass_stats;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY county_stats;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY municipality_stats;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY orgform_counts;"))

                # Financial caching views (latest year per company)
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY latest_financials;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY latest_accountings;"))

            logger.info("Materialized view refresh completed successfully", extra={"views_refreshed": 8})
        except Exception as e:
            logger.exception("Failed to refresh materialized views", extra={"error": str(e)})

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
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import select

        from models import Company
        from services.update_service import UpdateService

        logger.info("Starting accounting sync batch...")
        try:
            async with AsyncSessionLocal() as db:
                # 1. Selection logic: New companies first, then oldest polled ones
                # Priority: never polled -> oldest polled
                limit = 50
                cutoff_date = datetime.now(timezone.utc).date() - timedelta(days=30)

                # Fetch companies that need polling
                stmt = (
                    select(Company.orgnr)
                    .where((Company.last_polled_regnskap.is_(None)) | (Company.last_polled_regnskap <= cutoff_date))
                    .order_by(Company.last_polled_regnskap.asc().nulls_first())
                    .limit(limit)
                )

                result = await db.execute(stmt)
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

                result = await service.fetch_subunit_updates(since_date=since_date, start_id=start_id)

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
                # execution_options returns a NEW connection object
                conn = conn.execution_options(isolation_level="AUTOCOMMIT")  # type: ignore[assignment]
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
            total, used, free = shutil.disk_usage("/")
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
                    error.last_retry_at = datetime.now(timezone.utc)
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
                            roles = [
                                Role(
                                    orgnr=error.orgnr,
                                    type_kode=r.get("type_kode"),
                                    type_beskrivelse=r.get("type_beskrivelse"),
                                    person_navn=r.get("person_navn"),
                                    foedselsdato=update_service._parse_date(r.get("foedselsdato")),
                                    enhet_navn=r.get("enhet_navn"),
                                    enhet_orgnr=r.get("enhet_orgnr"),
                                    fratraadt=r.get("fratraadt", False),
                                    rekkefoelge=r.get("rekkefoelge"),
                                )
                                for r in roles_data
                            ]
                            if roles:
                                await update_service.role_repo.create_batch(roles, commit=False)
                            success = True

                        # Update status based on result
                        if success:
                            error.status = SyncErrorStatus.RESOLVED
                            error.resolved_at = datetime.now(timezone.utc)
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
                    await db.commit()

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
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)

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
