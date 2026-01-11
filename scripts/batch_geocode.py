"""
Batch Geocoding Script for Bedriftsgrafen.
Geocodes companies without coordinates using Kartverket API.

Usage:
    # Run inside Docker container:
    docker compose exec backend python -m scripts.batch_geocode --batch-size=500

    # Or as a cron job (add to crontab):
    # 0 2 * * * docker compose -f /path/to/docker-compose.yml exec -T backend python -m scripts.batch_geocode --batch-size=1000
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Company
from services.geocoding_service import GeocodingService

# Configure logging
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(os.path.join(log_dir, "geocoding.log"))],
)
logger = logging.getLogger(__name__)

# Rate limiting: Kartverket has no documented rate limit, using 5 req/sec to be safe
RATE_LIMIT_SECONDS = 0.2

# Global geocoding service instance
geocoding_service = GeocodingService()


async def get_companies_without_coords(session: AsyncSession, limit: int):
    """Fetch companies that need geocoding."""
    query = (
        select(Company)
        .where(Company.latitude.is_(None), Company.forretningsadresse.isnot(None))
        .order_by(
            # Prioritize companies with employees (more relevant)
            Company.antall_ansatte.desc().nullslast()
        )
        .limit(limit)
    )

    result = await session.execute(query)
    return result.scalars().all()


async def get_geocoding_stats(session: AsyncSession) -> dict:
    """Get current geocoding statistics."""
    total_query = select(func.count()).select_from(Company)
    geocoded_query = select(func.count()).select_from(Company).where(Company.latitude.isnot(None))
    with_address_query = select(func.count()).select_from(Company).where(Company.forretningsadresse.isnot(None))

    total = (await session.execute(total_query)).scalar()
    geocoded = (await session.execute(geocoded_query)).scalar()
    with_address = (await session.execute(with_address_query)).scalar()

    return {
        "total": total,
        "geocoded": geocoded,
        "with_address": with_address,
        "pending": with_address - geocoded,
        "percentage": round(100 * geocoded / total, 2) if total > 0 else 0,
    }


async def geocode_batch(session: AsyncSession, batch_size: int = 100, dry_run: bool = False) -> dict:
    """
    Geocode a batch of companies.

    Returns stats about the batch processing.
    """
    stats = {"processed": 0, "success": 0, "failed": 0, "skipped": 0, "errors": []}

    companies = await get_companies_without_coords(session, batch_size)

    if not companies:
        logger.info("No companies need geocoding!")
        return stats

    logger.info(f"Processing batch of {len(companies)} companies...")

    for company in companies:
        stats["processed"] += 1

        try:
            # Build address string from forretningsadresse
            address_str = geocoding_service.build_address_string(company.forretningsadresse, company.postadresse)

            if not address_str:
                stats["skipped"] += 1
                logger.debug(f"Skip {company.orgnr}: No valid address")
                continue

            # Geocode the address
            coords = await geocoding_service.geocode_address(address_str, orgnr=company.orgnr)

            if coords:
                lat, lon = coords

                if not dry_run:
                    # Update company with coordinates
                    await session.execute(
                        update(Company)
                        .where(Company.orgnr == company.orgnr)
                        .values(latitude=lat, longitude=lon, geocoded_at=datetime.utcnow())
                    )

                stats["success"] += 1
                logger.info(f"✅ {company.orgnr} ({company.navn[:30]}...): {lat:.6f}, {lon:.6f}")
            else:
                stats["failed"] += 1
                logger.warning(f"❌ {company.orgnr}: No coordinates found for '{address_str[:50]}'")

            # Rate limiting - be respectful to Kartverket API
            await asyncio.sleep(RATE_LIMIT_SECONDS)

        except Exception as e:
            stats["failed"] += 1
            stats["errors"].append(f"{company.orgnr}: {str(e)}")
            logger.error(f"Error geocoding {company.orgnr}: {e}")

    # Commit all updates
    if not dry_run:
        await session.commit()

    return stats


async def main():
    parser = argparse.ArgumentParser(description="Batch geocode companies")
    parser.add_argument("--batch-size", type=int, default=100, help="Number of companies to process (default: 100)")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually update database")
    parser.add_argument("--stats-only", action="store_true", help="Only show geocoding statistics")
    parser.add_argument("--continuous", action="store_true", help="Run continuously until all are geocoded")
    args = parser.parse_args()

    # Database connection - reuse app's database config
    from database import AsyncSessionLocal, engine

    async with AsyncSessionLocal() as session:
        # Show current stats
        stats = await get_geocoding_stats(session)
        logger.info("=" * 60)
        logger.info("GEOCODING STATISTICS")
        logger.info("=" * 60)
        logger.info(f"  Total companies:     {stats['total']:,}")
        logger.info(f"  With address:        {stats['with_address']:,}")
        logger.info(f"  Already geocoded:    {stats['geocoded']:,}")
        logger.info(f"  Pending geocoding:   {stats['pending']:,}")
        logger.info(f"  Completion:          {stats['percentage']}%")
        logger.info("=" * 60)

        if args.stats_only:
            return

        if args.continuous:
            # Run continuously until all companies are geocoded
            total_success = 0
            batch_num = 0
            while True:
                batch_num += 1
                logger.info(f"\n--- Batch {batch_num} ---")
                result = await geocode_batch(session, args.batch_size, args.dry_run)

                if result["processed"] == 0:
                    logger.info("All companies have been geocoded!")
                    break

                total_success += result["success"]
                logger.info(f"Batch complete: {result['success']}/{result['processed']} successful")
                logger.info(f"Total geocoded so far: {total_success}")

                # Brief pause between batches
                await asyncio.sleep(2)
        else:
            # Single batch
            result = await geocode_batch(session, args.batch_size, args.dry_run)

            logger.info("\n" + "=" * 60)
            logger.info("BATCH RESULTS")
            logger.info("=" * 60)
            logger.info(f"  Processed:  {result['processed']}")
            logger.info(f"  Success:    {result['success']}")
            logger.info(f"  Failed:     {result['failed']}")
            logger.info(f"  Skipped:    {result['skipped']}")

            if args.dry_run:
                logger.info("  (DRY RUN - no changes saved)")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
