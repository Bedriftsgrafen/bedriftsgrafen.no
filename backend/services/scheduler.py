import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text

from database import AsyncSessionLocal, engine

logger = logging.getLogger(__name__)


class SchedulerService:
    """Background job scheduler for periodic tasks."""

    def __init__(self) -> None:
        self.scheduler = AsyncIOScheduler()
        self._setup_jobs()

    def _setup_jobs(self) -> None:
        # Refresh materialized views every 5 minutes
        self.scheduler.add_job(
            self.refresh_materialized_views,
            trigger=IntervalTrigger(minutes=5),
            id="refresh_views",
            replace_existing=True,
        )

        # Sync SSB population data weekly (Sundays at 03:00)
        self.scheduler.add_job(
            self.sync_ssb_population,
            trigger=CronTrigger(day_of_week="sun", hour=3, minute=0),
            id="sync_ssb_population",
            replace_existing=True,
        )

        # Geocode companies without coordinates (every 1 hour)
        self.scheduler.add_job(
            self.geocode_companies_batch,
            trigger=IntervalTrigger(hours=1),
            id="geocode_companies",
            replace_existing=True,
        )

        # Update company metadata incrementally (every 15 minutes)
        # Replaces legacy bedriftsgrafen-company-updates.service
        self.scheduler.add_job(
            self.run_company_updates,
            trigger=IntervalTrigger(minutes=15),
            id="company_updates",
            replace_existing=True,
        )

        # Sync accounting data for companies (every 5 minutes)
        # Replaces legacy bedriftsgrafen-regnskap-sync.service
        self.scheduler.add_job(
            self.sync_accounting_batch,
            trigger=IntervalTrigger(minutes=5),
            id="accounting_sync",
            replace_existing=True,
        )

        # Update subunit metadata (every 15 minutes)
        self.scheduler.add_job(
            self.run_subunit_updates,
            trigger=IntervalTrigger(minutes=15),
            id="subunit_updates",
            replace_existing=True,
        )

        # Update role metadata (every 30 minutes)
        self.scheduler.add_job(
            self.run_role_updates,
            trigger=IntervalTrigger(minutes=30),
            id="role_updates",
            replace_existing=True,
        )

    async def start(self) -> None:
        self.scheduler.start()
        logger.info("Scheduler started", extra={"jobs": [job.id for job in self.scheduler.get_jobs()]})

    async def shutdown(self) -> None:
        self.scheduler.shutdown()
        logger.info("Scheduler shutdown")

    async def refresh_materialized_views(self) -> None:
        """Refreshes materialized views used for statistics CONCURRENTLY."""
        logger.info("Starting materialized view refresh (CONCURRENTLY)...")
        try:
            async with engine.begin() as conn:
                # Concurrent refresh prevents table locks so reads can continue
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY company_totals;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY industry_stats;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY county_stats;"))
                await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY municipality_stats;"))
            logger.info("Materialized view refresh completed successfully.")
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
                    result = await service.run_batch(batch_size=250)

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
                        "created": result.get("companies_created"),
                        "updated": result.get("companies_updated"),
                    },
                )
        except Exception as e:
            logger.exception("Failed to run incremental company updates", extra={"error": str(e)})

    async def sync_accounting_batch(self) -> None:
        """Sync accounting data for companies needing updates."""
        from datetime import datetime, timedelta

        from sqlalchemy import select

        from models import Company
        from services.update_service import UpdateService

        logger.info("Starting accounting sync batch...")
        try:
            async with AsyncSessionLocal() as db:
                # 1. Selection logic: New companies first, then oldest polled ones
                # Priority: never polled -> oldest polled
                limit = 50
                cutoff_date = datetime.utcnow().date() - timedelta(days=30)

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
                        logger.warning(f"Failed to sync accounting for {orgnr}: {ex}")

                logger.info(f"Accounting sync batch completed. Processed {processed}/{len(orgnrs)} companies.")

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

                # Catch up from Dec 1st 2025 if no state
                since_date = date(2025, 12, 1) if not start_id else None

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

                # Catch up from Dec 1st 2025 if no state
                since_date = date(2025, 12, 1) if not after_id else None

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
