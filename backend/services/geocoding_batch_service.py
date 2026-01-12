"""
Geocoding Batch Service.

Processes companies without coordinates in batches,
respecting Kartverket API limits with throttling.
"""

import asyncio
import logging
import httpx
from datetime import datetime

from typing import Any, Sequence

from sqlalchemy import Row, and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import Company
from services.geocoding_service import GeocodingService

logger = logging.getLogger(__name__)


class GeocodingBatchService:
    """
    Batch geocoding service for companies without coordinates.

    Designed to run as a background job with respectful rate limiting.
    """

    # Conservative rate limiting - 1 request per second
    DELAY_BETWEEN_REQUESTS = 1.0  # seconds
    DELAY_ON_ERROR = 5.0  # seconds
    DEFAULT_BATCH_SIZE = 100
    MAX_GEOCODING_ATTEMPTS = 3  # Skip after this many failed attempts

    def __init__(self, db: AsyncSession):
        self.db = db
        self.geocoder = GeocodingService()

    async def get_companies_needing_geocoding(self, limit: int = DEFAULT_BATCH_SIZE) -> Sequence[Row[Any]]:
        """Fetch companies that need geocoding, selecting only necessary columns."""
        query = (
            select(
                Company.orgnr, 
                Company.forretningsadresse, 
                Company.postadresse, 
                Company.geocoding_attempts
            )
            .where(
                and_(
                    Company.latitude.is_(None),
                    Company.forretningsadresse.isnot(None),
                    Company.geocoding_attempts < self.MAX_GEOCODING_ATTEMPTS,
                )
            )
            # Prioritize companies with employees (more likely to be real/active)
            .order_by(Company.antall_ansatte.desc().nullslast())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return result.all()  # Returns Sequence of Row objects with selected columns

    async def count_companies_needing_geocoding(self) -> int:
        """Count companies that still need geocoding (excluding max-attempts)."""
        query = select(func.count()).select_from(Company).where(
            and_(
                Company.latitude.is_(None),
                Company.forretningsadresse.isnot(None),
                Company.geocoding_attempts < self.MAX_GEOCODING_ATTEMPTS,
            )
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def count_geocoded_companies(self) -> int:
        """Count companies that have been geocoded."""
        query = select(func.count()).select_from(Company).where(
            Company.latitude.isnot(None)
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def geocode_company(self, company: Company) -> bool:
        """
        Geocode a single company using a savepoint for transaction isolation.
        
        Each company update is wrapped in a savepoint (nested transaction),
        so failures don't abort the entire batch transaction.

        Returns True if successful, False otherwise.
        """
        # Use a savepoint to isolate this company's transaction
        async with self.db.begin_nested():
            try:
                # Build address string from company data
                address = GeocodingService.build_address_string(
                    company.forretningsadresse or {},
                    company.postadresse
                )

                if not address:
                    logger.debug(f"No address for company {company.orgnr}")
                    # Increment attempts even when no address
                    await self.db.execute(
                        update(Company)
                        .where(Company.orgnr == company.orgnr)
                        .values(geocoding_attempts=Company.geocoding_attempts + 1)
                    )
                    return False

                coords = await self.geocoder.geocode_address(address, orgnr=company.orgnr)

                if coords:
                    lat, lon = coords
                    # Update company with coordinates and increment attempts
                    await self.db.execute(
                        update(Company)
                        .where(Company.orgnr == company.orgnr)
                        .values(
                            latitude=lat,
                            longitude=lon,
                            geocoding_attempts=Company.geocoding_attempts + 1,
                        )
                    )
                    return True
                else:
                    # Increment attempts even on failure to avoid infinite retries
                    await self.db.execute(
                        update(Company)
                        .where(Company.orgnr == company.orgnr)
                        .values(geocoding_attempts=Company.geocoding_attempts + 1)
                    )
                    logger.debug(f"No coordinates found for {company.orgnr}: {address}")
                    return False

            except Exception as e:
                # Any exception inside the savepoint will rollback just this savepoint
                logger.warning(f"Error geocoding {company.orgnr}: {e}")
                # Savepoint automatically rolled back, return False
                return False

    async def run_batch(self, batch_size: int = DEFAULT_BATCH_SIZE) -> dict:
        """
        Run a batch of geocoding operations with parallel I/O and sequential DB updates.

        Returns statistics about the batch run.
        """
        start_time = datetime.now()

        # Get companies to geocode (already optimized to fetch only needed columns)
        companies = await self.get_companies_needing_geocoding(batch_size)

        if not companies:
            logger.info("No companies need geocoding")
            return {
                "processed": 0,
                "success": 0,
                "failed": 0,
                "remaining": 0,
                "duration_seconds": 0,
            }

        semaphore = asyncio.Semaphore(10)  # Process 10 companies in parallel I/O
        success_count = 0
        fail_count = 0

        async with httpx.AsyncClient(timeout=10.0) as client:
            # Inject shared client into geocoder
            self.geocoder.client = client
            
            async def geocode_task(company):
                async with semaphore:
                    try:
                        address = GeocodingService.build_address_string(
                            company.forretningsadresse or {},
                            company.postadresse
                        )
                        if not address:
                            return company.orgnr, None, "No address"
                        
                        coords = await self.geocoder.geocode_address(address, orgnr=company.orgnr)
                        return company.orgnr, coords, address
                    except Exception as e:
                        return company.orgnr, None, str(e)

            # Step 1: Parallel I/O (Geocoding lookups)
            logger.info(f"Starting parallel geocoding lookups for {len(companies)} companies...")
            tasks = [geocode_task(c) for c in companies]
            results = await asyncio.gather(*tasks)

        # Step 2: Sequential DB updates (Session safety)
        logger.info("Geocoding lookups complete. Starting sequential database updates...")
        for orgnr, coords, address_or_error in results:
            # Use savepoint for each update to isolate failures
            try:
                async with self.db.begin_nested():
                    if coords:
                        lat, lon = coords
                        await self.db.execute(
                            update(Company)
                            .where(Company.orgnr == orgnr)
                            .values(
                                latitude=lat,
                                longitude=lon,
                                geocoding_attempts=Company.geocoding_attempts + 1,
                                geocoded_at=func.now()
                            )
                        )
                        success_count += 1
                    else:
                        # Increment attempts even on failure
                        await self.db.execute(
                            update(Company)
                            .where(Company.orgnr == orgnr)
                            .values(geocoding_attempts=Company.geocoding_attempts + 1)
                        )
                        fail_count += 1
                        if address_or_error != "No address":
                            logger.debug(f"Failed to geocode {orgnr}: {address_or_error}")
            except Exception as e:
                logger.error(f"Error updating database for {orgnr}: {e}")
                # Critical: If the transaction is fundamentally aborted (e.g. timeout), 
                # following commands will fail. We should rollback the whole batch.
                if "InFailedSQLTransactionError" in str(e) or "QueryCanceledError" in str(e):
                    logger.error("Database transaction aborted (likely timeout). Rolling back entire batch.")
                    await self.db.rollback()
                    return {
                        "processed": len(companies),
                        "success": success_count,
                        "failed": len(companies) - success_count,
                        "remaining": await self.count_companies_needing_geocoding(),
                        "duration_seconds": round((datetime.now() - start_time).total_seconds(), 1),
                        "error": "Transaction aborted"
                    }
                fail_count += 1

        # Commit all updates
        try:
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to commit batch updates: {e}")
            await self.db.rollback()
            raise

        # Get remaining count
        remaining = await self.count_companies_needing_geocoding()
        total_geocoded = await self.count_geocoded_companies()

        duration = (datetime.now() - start_time).total_seconds()

        stats = {
            "processed": len(companies),
            "success": success_count,
            "failed": fail_count,
            "remaining": remaining,
            "total_geocoded": total_geocoded,
            "duration_seconds": round(duration, 1),
        }

        logger.info(
            f"Geocoding batch complete: {success_count}/{len(companies)} success, "
            f"{remaining:,} remaining, {total_geocoded:,} total geocoded. "
            f"Duration: {stats['duration_seconds']}s ({len(companies)/duration:.1f} comp/s)"
        )

        return stats
    async def run_postal_code_backfill(self) -> dict:
        """
        Fast-fill coordinates based on postal codes from local CSV file.
        Updates companies where latitude is NULL.

        This is MUCH faster than API geocoding (seconds vs days)
        and covers ~99% of companies.
        """
        import csv
        import os


        # Find the CSV file
        possible_paths = [
            "/app/backend/data/postnummer.csv",
            "backend/data/postnummer.csv",
            "data/postnummer.csv",
            "./postnummer.csv"
        ]

        file_path = None
        for path in possible_paths:
            if os.path.exists(path):
                file_path = path
                break

        if not file_path:
            logger.error(f"Postnummer file not found. Checked: {possible_paths}")
            return {"error": "File not found", "checked_paths": possible_paths}

        logger.info(f"Starting postal code backfill from {file_path}")
        start_time = datetime.now()

        try:
            # Load postal codes into a dictionary for fast lookup
            def load_postal_codes():
                postal_map = {}
                with open(file_path, encoding='utf-8') as f:
                    reader = csv.reader(f, delimiter='\t')
                    next(reader)  # Skip header
                    for row in reader:
                        if len(row) >= 11:
                            postnr = row[0]
                            try:
                                lat = float(row[9])
                                lon = float(row[10])
                                postal_map[postnr] = (lat, lon)
                            except (ValueError, IndexError):
                                continue
                return postal_map

            # Run blocking I/O in a separate thread
            postal_map = await asyncio.to_thread(load_postal_codes)

            if not postal_map:
                return {"error": "No valid postal codes found in file"}

            logger.info(f"Loaded {len(postal_map)} postal codes. Updating DB via batch streaming...")

            # Match postal codes using keyset pagination to handle large dataset safely
            from sqlalchemy import bindparam

            updated_count = 0
            updates = []
            updates_batch_size = 2000
            fetch_size = 10000
            last_orgnr = ""

            while True:
                # Keyset pagination: Fetch next chunk of companies
                stmt = (
                    select(Company.orgnr, Company.forretningsadresse)
                    .where(and_(
                        Company.latitude.is_(None),
                        Company.forretningsadresse.isnot(None),
                        Company.orgnr > last_orgnr
                    ))
                    .order_by(Company.orgnr.asc())
                    .limit(fetch_size)
                )

                result = await self.db.execute(stmt)
                rows = result.all()

                if not rows:
                    break

                # Process the chunk
                for row in rows:
                    orgnr = row.orgnr
                    addr = row.forretningsadresse

                    if not addr or not isinstance(addr, dict):
                        continue

                    postnr = addr.get("postnummer")

                    if postnr and postnr in postal_map:
                        lat, lon = postal_map[postnr]
                        updates.append({
                            "b_orgnr": orgnr,
                            "lat": lat,
                            "lon": lon
                        })

                # Update DB if we have enough updates
                if len(updates) >= updates_batch_size:
                    await self.db.execute(
                        update(Company.__table__)
                        .where(Company.orgnr == bindparam("b_orgnr"))
                        .values(latitude=bindparam("lat"), longitude=bindparam("lon")),
                        updates
                    )
                    updated_count += len(updates)
                    updates = []
                    await self.db.commit() # Commit partial work

                # Advance cursor
                last_orgnr = rows[-1].orgnr

            # Flush remaining updates
            if updates:
                await self.db.execute(
                    update(Company.__table__)
                    .where(Company.orgnr == bindparam("b_orgnr"))
                    .values(latitude=bindparam("lat"), longitude=bindparam("lon")),
                    updates
                )
                updated_count += len(updates)

            await self.db.commit()

            duration = (datetime.now() - start_time).total_seconds()

            logger.info(f"Backfill complete. Updated {updated_count} companies in {duration:.1f}s")

            return {
                "updated": updated_count,
                "duration_seconds": round(duration, 1),
                "postal_codes_loaded": len(postal_map)
            }

        except Exception as e:
            logger.exception("Failed during postal code backfill")
            return {"error": str(e)}
