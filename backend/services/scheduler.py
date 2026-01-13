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
