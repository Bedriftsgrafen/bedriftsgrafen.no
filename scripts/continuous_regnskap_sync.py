#!/usr/bin/env python3
"""
Continuous Background Service for Financial Data Synchronization

This script runs continuously and safely updates financial data (regnskap) for all companies:
- Fetches financial data for companies with no data (last_updated IS NULL)
- Re-fetches financial data for companies with oldest data (for updates)
- Rate-limited (5 requests/sec = 18,000/hour = 432,000/day)
- Auto-restarts on crashes/network failures
- Safe PostgreSQL connection handling
- Graceful shutdown on SIGTERM/SIGINT

Usage:
import asyncio
import logging
import os
import signal
import sys
import time
from datetime import datetime, timedelta

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import load_only

To run as systemd service:
    sudo systemctl start bedriftsgrafen-regnskap-sync
"""

import asyncio
import logging
import os
import signal
import sys
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

# Add parent directory to path for imports
sys.path.insert(0, "/app")

from database import AsyncSessionLocal, engine  # noqa: E402
from models import Accounting, Company  # noqa: E402

# Configuration
RATE_LIMIT_DELAY = 0.05  # Reduced delay (we rely on concurrency limit now)
BATCH_SIZE = 20  # Reverted to 20 for stability
CONCURRENCY = 5  # Reduced concurrency to lower load (Load avg > 7)
RETRY_DELAY = 300  # 5 minutes before retrying on error
REFETCH_THRESHOLD_DAYS = 30  # Re-fetch if older than 30 days
API_TIMEOUT = 30  # API request timeout in seconds

# Logging setup - compact format for large-scale processing


log_handlers = [logging.StreamHandler(sys.stdout)]
try:
    log_dir = "/app/logs"
    os.makedirs(log_dir, exist_ok=True)
    log_handlers.append(logging.FileHandler(f"{log_dir}/regnskap_sync.log"))
except Exception as e:
    print(f"Warning: Could not create file log handler: {e}", file=sys.stderr)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", handlers=log_handlers)
logger = logging.getLogger(__name__)

# CRITICAL: Silence httpx verbose logging
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# Progress tracking
processed_count = 0
success_count = 0
not_found_count = 0
error_count = 0

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


async def fetch_regnskap_from_api(orgnr: str, client: httpx.AsyncClient) -> dict | None:
    """
    Fetch financial data from Brønnøysund API

    Returns the most recent year's data, or None if unavailable
    """
    url = f"https://data.brreg.no/regnskapsregisteret/regnskap/{orgnr}"

    try:
        response = await client.get(url, timeout=API_TIMEOUT)

        if response.status_code == 404:
            return None

        if response.status_code != 200:
            logger.warning(f"{orgnr}: API returned {response.status_code}")
            if response.status_code >= 500:
                # Back off on server errors
                await asyncio.sleep(5)
            return None

        data = response.json()

        # API returns array of years, take first (most recent)
        if not data or len(data) == 0:
            return None

        return data[0]  # Most recent year

    except httpx.TimeoutException:
        return None
    except httpx.RequestError as e:
        logger.error(f"{orgnr}: Network error - {e}")
        return None
    except Exception as e:
        logger.error(f"{orgnr}: Unexpected error - {e}")
        return None


def parse_regnskap_data(data: dict) -> dict:
    """
    Parse Brønnøysund API response into database-friendly format

    Extracts key financial metrics with Norwegian terminology
    """
    parsed = {
        "raw_data": data,
        "aar": None,
        "periode_fra": None,
        "periode_til": None,
        "total_inntekt": None,
        "aarsresultat": None,
        "egenkapital": None,
        "driftsresultat": None,
        "salgsinntekter": None,
        "omloepsmidler": None,
        "kortsiktig_gjeld": None,
        "avskrivninger": None,
        "anleggsmidler": None,
        "langsiktig_gjeld": None,
    }

    # Extract year and period dates
    if "regnskapsperiode" in data:
        periode = data["regnskapsperiode"]
        if "tilDato" in periode:
            til_dato = periode["tilDato"]
            parsed["aar"] = int(til_dato.split("-")[0])
            # Parse periode_til as date object
            try:
                parsed["periode_til"] = datetime.strptime(til_dato[:10], "%Y-%m-%d").date()
            except (ValueError, TypeError):
                parsed["periode_til"] = None
        if "fraDato" in periode:
            fra_dato = periode["fraDato"]
            try:
                parsed["periode_fra"] = datetime.strptime(fra_dato[:10], "%Y-%m-%d").date()
            except (ValueError, TypeError):
                parsed["periode_fra"] = None

    # Fallback: if periode_til is missing but we have year, use Dec 31
    if parsed["periode_til"] is None and parsed["aar"]:
        from datetime import date as date_type
        parsed["periode_til"] = date_type(parsed["aar"], 12, 31)

    # Extract balance sheet data
    if "egenkapitalGjeld" in data:
        eg = data["egenkapitalGjeld"]

        if "egenkapital" in eg:
            parsed["egenkapital"] = eg["egenkapital"].get("sumEgenkapital")

        if "gjeldOversikt" in eg:
            gjeld = eg["gjeldOversikt"]
            if "kortsiktigGjeld" in gjeld:
                parsed["kortsiktig_gjeld"] = gjeld["kortsiktigGjeld"].get("sumKortsiktigGjeld")
            if "langsiktigGjeld" in gjeld:
                parsed["langsiktig_gjeld"] = gjeld["langsiktigGjeld"].get("sumLangsiktigGjeld")

    # Extract assets
    if "eiendeler" in data:
        eiendeler = data["eiendeler"]
        if "omloepsmidler" in eiendeler:
            parsed["omloepsmidler"] = eiendeler["omloepsmidler"].get("sumOmloepsmidler")
        if "anleggsmidler" in eiendeler:
            parsed["anleggsmidler"] = eiendeler["anleggsmidler"].get("sumAnleggsmidler")

    # Extract income statement data
    if "resultatregnskapResultat" in data:
        rr = data["resultatregnskapResultat"]

        parsed["aarsresultat"] = rr.get("aarsresultat")

        if "driftsresultat" in rr:
            drift = rr["driftsresultat"]
            parsed["driftsresultat"] = drift.get("driftsresultat")

            if "driftsinntekter" in drift:
                parsed["salgsinntekter"] = drift["driftsinntekter"].get("sumDriftsinntekter")
                parsed["total_inntekt"] = drift["driftsinntekter"].get("sumDriftsinntekter")

            if "driftskostnad" in drift:
                kostnad = drift["driftskostnad"]
                parsed["avskrivninger"] = kostnad.get("avskrivningerDriftsloesore")

    return parsed





async def bulk_upsert_regnskap(session: AsyncSession, records: list[dict]) -> int:
    """
    Bulk insert or update financial data using the correct unique constraint.
    
    The regnskap table has a unique constraint on (orgnr, periode_til).
    """
    if not records:
        return 0

    try:
        # Prepare the insert statement
        stmt = pg_insert(Accounting).values(records)

        # Explicitly define columns to update on conflict
        # We avoid iterating stmt.excluded to prevent issues with Computed columns or PKs
        update_columns = [
            "aar",
            "periode_fra",
            "total_inntekt",
            "aarsresultat",
            "egenkapital",
            "gjeldsgrad",
            "driftsresultat",
            "salgsinntekter",
            "omloepsmidler",
            "kortsiktig_gjeld",
            "avskrivninger",
            "anleggsmidler",
            "langsiktig_gjeld",
            "raw_data",
        ]

        # Map column names to their excluded values
        update_dict = {col: getattr(stmt.excluded, col) for col in update_columns}

        # On conflict (orgnr, periode_til), update the columns
        # Uses the named constraint instead of index_elements for correctness
        stmt = stmt.on_conflict_do_update(
            constraint="regnskap_orgnr_periode_unique",
            set_=update_dict
        )

        await session.execute(stmt)
        return len(records)

    except Exception as e:
        logger.error(f"Bulk upsert error: {e}")
        raise e





async def get_companies_needing_update(session: AsyncSession, limit: int) -> list[Company]:
    """
    Get companies that need financial data update

    Priority:
    1. Companies never polled (last_polled_regnskap IS NULL)
    2. Companies polled longest ago (last_polled_regnskap ASC)
    """
    # Optimization: Split into two queries to use the index efficiently.
    # The index on last_polled_regnskap is default (ASC NULLS LAST).
    # A single query with NULLS FIRST forces a full sort or inefficient scan.
    # CRITICAL: Use load_only to fetch ONLY orgnr. Fetching full objects with JSONB/TSVECTOR
    # causes massive IO overhead and timeouts on RPi.

    # 1. Get companies that have NEVER been polled
    stmt = select(Company).options(load_only(Company.orgnr)).where(Company.last_polled_regnskap.is_(None)).limit(limit)
    result = await session.execute(stmt)
    companies = list(result.scalars().all())

    # 2. If we have space, get the oldest polled ones ONLY if they are older than threshold
    if len(companies) < limit:
        remaining = limit - len(companies)
        cutoff_date = datetime.utcnow().date() - timedelta(days=REFETCH_THRESHOLD_DAYS)

        stmt = (
            select(Company)
            .options(load_only(Company.orgnr))
            .where(Company.last_polled_regnskap <= cutoff_date)
            .order_by(Company.last_polled_regnskap.asc())
            .limit(remaining)
        )
        result = await session.execute(stmt)
        more_companies = result.scalars().all()
        companies.extend(more_companies)

    if companies:
        # logger.info(f"Found {len(companies)} companies to poll")
        pass
    else:
        logger.info("No companies found")

    return companies


async def process_batch(orgnrs: list[str]):
    """
    Process a batch of companies with parallel fetching and bulk DB updates
    """
    global processed_count, not_found_count, success_count, error_count

    # Semaphore to limit concurrent API requests
    sem = asyncio.Semaphore(CONCURRENCY)

    async def fetch_with_sem(orgnr, client):
        async with sem:
            try:
                data = await fetch_regnskap_from_api(orgnr, client)
                # Small sleep to be nice to the API even with concurrency
                await asyncio.sleep(RATE_LIMIT_DELAY)
                return orgnr, data
            except Exception as e:
                logger.error(f"{orgnr}: Fetch error - {e}")
                return orgnr, None

    async with httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=CONCURRENCY, max_connections=CONCURRENCY)
    ) as client:
        # 1. Fetch all data in parallel
        tasks = [fetch_with_sem(orgnr, client) for orgnr in orgnrs]
        results = await asyncio.gather(*tasks)

        # 2. Process results and prepare for bulk write
        orgnrs_to_update = []
        records_to_upsert = []

        for orgnr, data in results:
            orgnrs_to_update.append(orgnr)

            if data:
                parsed = parse_regnskap_data(data)
                if parsed["aar"]:
                    # Add orgnr to parsed data for the model
                    parsed["orgnr"] = orgnr
                    records_to_upsert.append(parsed)
            else:
                not_found_count += 1

        # 3. Bulk Write to DB (Single Transaction)
        if orgnrs_to_update:
            async with AsyncSessionLocal() as session:
                try:
                    # Increase timeout for this batch operation (60s)
                    await session.execute(text("SET statement_timeout = '60000'"))

                    # A. Bulk Upsert Accounting Data
                    if records_to_upsert:
                        await bulk_upsert_regnskap(session, records_to_upsert)
                        success_count += len(records_to_upsert)

                    # B. Bulk Update last_polled_regnskap
                    stmt = (
                        update(Company)
                        .where(Company.orgnr.in_(orgnrs_to_update))
                        .values(last_polled_regnskap=datetime.utcnow().date())
                    )
                    await session.execute(stmt)

                    # Commit the whole batch
                    await session.commit()

                except Exception as e:
                    logger.error(f"Batch transaction failed: {e}")
                    await session.rollback()
                    await session.rollback()
                    error_count += len(orgnrs_to_update)

        # Update processed count
        processed_count += len(orgnrs)


# Configuration
RATE_LIMIT_DELAY = 0.05  # Reduced delay (we rely on concurrency limit now)
BATCH_SIZE = 20  # Reverted to 20 for stability
CONCURRENCY = 5  # Reduced concurrency to lower load (Load avg > 7)
RETRY_DELAY = 300  # 5 minutes before retrying on error
REFETCH_THRESHOLD_DAYS = 30  # Re-fetch if older than 30 days
API_TIMEOUT = 30  # API request timeout in seconds
REFRESH_VIEW_INTERVAL = 1000  # Refresh materialized view every 1000 companies

# ... (logging setup) ...


async def main_loop():
    """Main continuous synchronization loop"""
    global processed_count, success_count, not_found_count, error_count

    logger.info("=== Starting Continuous Regnskap Sync Service ===")
    logger.info(f"Rate limit: {1 / RATE_LIMIT_DELAY:.1f} req/sec")
    logger.info(f"Batch size: {BATCH_SIZE}")
    logger.info(f"Refetch threshold: {REFETCH_THRESHOLD_DAYS} days")

    iteration = 0
    last_refresh_count = 0

    while not shutdown_flag:
        iteration += 1
        # logger.debug(f"--- Iteration {iteration} ---")  # Too verbose

        try:
            orgnrs_to_process = []
            async with AsyncSessionLocal() as session:
                # Get companies needing update
                companies = await get_companies_needing_update(session, BATCH_SIZE)
                orgnrs_to_process = [c.orgnr for c in companies]

            if not orgnrs_to_process:
                logger.info("No companies need updates. Sleeping for 1 hour...")
                await asyncio.sleep(3600)
                continue

            # Reset batch counters
            batch_start_count = processed_count

            # Process batch (outside of session block)
            await process_batch(orgnrs_to_process)

            # Refresh materialized view periodically
            if processed_count - last_refresh_count >= REFRESH_VIEW_INTERVAL:
                logger.info("Refreshing materialized view...")
                try:
                    # REFRESH MATERIALIZED VIEW CONCURRENTLY cannot run inside a transaction block
                    # We must use a separate connection with AUTOCOMMIT isolation level
                    async with engine.connect() as conn:
                        await conn.execution_options(isolation_level="AUTOCOMMIT")
                        await conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY latest_accountings"))

                    last_refresh_count = processed_count
                    logger.info("Materialized view refreshed")
                except Exception as e:
                    logger.error(f"Failed to refresh view: {e}")
                    # No rollback needed here as we used a separate connection

            processed_count - batch_start_count
            # Only log batch completion every 10 iterations (every ~2000 companies)
            if iteration % 10 == 0:
                logger.info(
                    f"Progress: {processed_count} processed | ✓{success_count} ✗{not_found_count} ⚠{error_count}"
                )

        except Exception as e:
            logger.error(f"Main loop error: {e}")
            logger.info(f"Retrying in {RETRY_DELAY} seconds...")
            await asyncio.sleep(RETRY_DELAY)
            continue

    logger.info(f"=== Shutdown complete | Total: ✓{success_count} ✗{not_found_count} ⚠{error_count} ===")


if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
    except Exception as e:
        logger.critical(f"Fatal error: {e}")
        sys.exit(1)
