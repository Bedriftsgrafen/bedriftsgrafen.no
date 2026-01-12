#!/usr/bin/env python3
#!/usr/bin/env python3
"""
Continuous Background Service for Company & Subunit Updates

This script runs continuously and safely updates company metadata (enheter & underenheter):
- Fetches incremental updates for companies from oppdateringer/enheter endpoint
- Fetches incremental updates for subunits from oppdateringer/underenheter endpoint
- Rate-limited (respects Brønnøysund API limits)
- Auto-restarts on crashes/network failures
- Safe PostgreSQL connection handling
- Graceful shutdown on SIGTERM/SIGINT

Updates are fetched daily, catching up on:
1. New companies (Endringstype: "Ny")
2. Company changes (Endringstype: "Endring")
3. Subunit changes (separate endpoint)

Usage:
    python3 scripts/continuous_company_updates.py

To run as systemd service:
    sudo systemctl start bedriftsgrafen-company-updates
    sudo systemctl enable bedriftsgrafen-company-updates
"""

import asyncio
import logging
import os
import signal
import sys
from datetime import date, datetime, timedelta
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, "/app")

from database import AsyncSessionLocal  # noqa: E402
from repositories.system_repository import SystemRepository  # noqa: E402
from services.update_service import UpdateService  # noqa: E402

# Configuration
RETRY_DELAY = 60  # 1 minute before retrying on error
API_TIMEOUT = 30  # API request timeout in seconds
UPDATE_INTERVAL = 900  # 15 minutes between full update checks (more frequent checks, smaller batches)
BATCH_SIZE = 1000  # Items per API request

# Keys for system state
STATE_KEY_COMPANY_UPDATE = "company_update_latest_id"
STATE_KEY_LAST_FULL_SYNC = "company_update_last_sync_date"

# Logging setup

log_handlers = [logging.StreamHandler(sys.stdout)]
try:
    log_dir = "/app/logs"
    os.makedirs(log_dir, exist_ok=True)
    log_handlers.append(logging.FileHandler(f"{log_dir}/company_updates.log"))
except Exception as e:
    print(f"Warning: Could not create file log handler: {e}", file=sys.stderr)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", handlers=log_handlers)
logger = logging.getLogger(__name__)

# Silence verbose external logging
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)

# Graceful shutdown flag
shutdown_flag = False


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global shutdown_flag
    logger.info(f"Received signal {signum}. Initiating graceful shutdown...")
    shutdown_flag = True


# Register signal handlers
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


async def fetch_company_updates(service: UpdateService, since_date: date | None = None, start_id: int | None = None) -> dict[str, Any]:
    """
    Fetch incremental company updates from Brønnøysundregistrene

    Args:
        service: UpdateService instance with database connection
        since_date: Fetch updates after this date (defaults to yesterday)
        start_id: Resume fetching updates after this ID (more reliable than date)

    Returns:
        Dictionary with update statistics
    """
    if since_date is None:
        since_date = date.today() - timedelta(days=1)

    logger.info(f"Fetching company updates (enheter) since {since_date.isoformat()} (start_id: {start_id})...")

    try:
        result = await service.fetch_updates(since_date=since_date, page_size=BATCH_SIZE, start_id=start_id)

        logger.info("Company updates completed:")
        logger.info(f"  - Processed: {result['companies_processed']}")
        logger.info(f"  - Created: {result['companies_created']}")
        logger.info(f"  - Updated: {result['companies_updated']}")
        logger.info(f"  - Pages: {result['pages_fetched']}")

        if result.get("errors"):
            logger.warning(f"  - Errors: {len(result['errors'])}")
            for err in result["errors"][:3]:
                logger.warning(f"    • {err}")

        return result

    except Exception as e:
        logger.error(f"Failed to fetch company updates: {str(e)}")
        return {"companies_processed": 0, "companies_created": 0, "companies_updated": 0, "errors": [str(e)]}


async def main_loop():
    """Main continuous update loop"""
    global shutdown_flag

    logger.info("=" * 80)
    logger.info("BEDRIFTSGRAFEN - CONTINUOUS COMPANY UPDATES SERVICE")
    logger.info("=" * 80)
    logger.info(f"Starting service at {datetime.now().isoformat()}")
    logger.info(f"Update interval: {UPDATE_INTERVAL}s ({UPDATE_INTERVAL / 3600:.1f} hours)")
    logger.info(f"Batch size: {BATCH_SIZE} items per request")
    logger.info("=" * 80)

    iteration = 0

    while not shutdown_flag:
        iteration += 1

        try:
            now = datetime.now()
            logger.info(f"\n[Iteration {iteration}] Starting update cycle at {now.isoformat()}")

            # Connect to database
            async with AsyncSessionLocal() as db:
                service = UpdateService(db)
                system_repo = SystemRepository(db)

                # Ensure state table exists on first run
                if iteration == 1:
                    await system_repo.ensure_state_table()

                # Check stored state logic using repository
                latest_id_str = await system_repo.get_state(STATE_KEY_COMPANY_UPDATE)
                last_sync_date_str = await system_repo.get_state(STATE_KEY_LAST_FULL_SYNC)

                since_date = None
                start_id = None

                if latest_id_str:
                    logger.info(f"Resuming from update ID: {latest_id_str}")
                    try:
                        start_id = int(latest_id_str)
                    except ValueError:
                        logger.warning(f"Invalid update ID in DB: {latest_id_str}, falling back to date")
                
                # Determine date for fallback or logging
                if last_sync_date_str:
                    try:
                        since_date = date.fromisoformat(last_sync_date_str)
                        logger.info(f"Using sync date: {since_date}")
                    except ValueError:
                        since_date = date.today() - timedelta(days=1)
                elif not start_id:
                    # First run ever: catch up from Dec 4th
                    since_date = date(2025, 12, 4)
                    logger.info(f"First run (no state) - initializing from {since_date}")

                # Fetch updates
                result = await fetch_company_updates(service, since_date=since_date, start_id=start_id)

                # Persist state
                if result.get("latest_oppdateringsid"):
                    await system_repo.set_state(STATE_KEY_COMPANY_UPDATE, str(result["latest_oppdateringsid"]))

                # Always update sync date on success or if no new updates were found
                if result.get("companies_processed", 0) > 0 or not result.get("errors"):
                    today_str = date.today().isoformat()
                    await system_repo.set_state(STATE_KEY_LAST_FULL_SYNC, today_str)

                if result.get("companies_processed", 0) > 0:
                    logger.info(f"✓ Successfully processed {result['companies_processed']} company records")
                else:
                    logger.info("No new company updates found")

            # Wait before next iteration
            logger.info(f"Sleeping for {UPDATE_INTERVAL}s until next update cycle...")

            # Sleep with periodic checks for shutdown signal
            sleep_remaining = UPDATE_INTERVAL
            sleep_interval = 5  # Check shutdown signal frequently

            while sleep_remaining > 0 and not shutdown_flag:
                await asyncio.sleep(min(sleep_interval, sleep_remaining))
                sleep_remaining -= sleep_interval

        except asyncio.CancelledError:
            logger.info("Update cycle cancelled")
            break

        except Exception as e:
            logger.error(f"Critical error in update cycle: {str(e)}", exc_info=False)
            logger.info(f"Will retry in {RETRY_DELAY}s...")

            # Sleep with periodic checks for shutdown
            sleep_remaining = RETRY_DELAY
            sleep_interval = 5

            while sleep_remaining > 0 and not shutdown_flag:
                await asyncio.sleep(min(sleep_interval, sleep_remaining))
                sleep_remaining -= sleep_interval

    logger.info("=" * 80)
    logger.info("SERVICE SHUTDOWN - Company updates service terminated gracefully")
    logger.info("=" * 80)


if __name__ == "__main__":
    try:
        # Set event loop policy for Windows if needed
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

        # Run the main loop
        asyncio.run(main_loop())

    except KeyboardInterrupt:
        logger.info("Service interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"Fatal error: {str(e)}", exc_info=True)
        sys.exit(1)
