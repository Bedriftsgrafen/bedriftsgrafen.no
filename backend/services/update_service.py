"""UpdateService - Fetches incremental updates from Brønnøysund.

Architecture:
- Phase 1 (Fetch): Concurrently fetch API data with bounded concurrency
- Phase 2 (Persist): Sequentially write to database with proper transactions

This separation ensures:
1. No shared AsyncSession access during concurrent operations
2. Bounded memory usage (process one page at a time)
3. Clear error handling semantics per phase
"""

import asyncio
import logging
import os
from datetime import date, datetime, timedelta
from typing import Any

import httpx
from aiolimiter import AsyncLimiter
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.accounting_repository import AccountingRepository
from repositories.company import CompanyRepository
from repositories.system_repository import SystemRepository
from schemas.brreg import FetchResult, UpdateBatchResult
from services.brreg_api_service import BrregApiService

logger = logging.getLogger(__name__)

# Concurrency limit for parallel API fetching
CONCURRENCY_LIMIT = 10

# Chunk size for database commits (commit after N records)
DB_COMMIT_CHUNK_SIZE = 50

# Rate limiting for Brreg API (requests per second)
# Conservative default to avoid triggering their rate limiter
API_RATE_LIMIT = int(os.getenv("BRREG_API_RATE_LIMIT", "5"))
rate_limiter = AsyncLimiter(API_RATE_LIMIT, 1)


class UpdateService:
    """Service for fetching incremental updates from Brønnøysund.

    Uses the oppdateringer (updates) endpoint to get daily changes.
    Implements phased processing for safety and performance.
    """

    UPDATES_BASE_URL = "https://data.brreg.no/enhetsregisteret/api/oppdateringer/enheter"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.brreg_api = BrregApiService()
        self.company_repo = CompanyRepository(db)
        self.accounting_repo = AccountingRepository(db)
        self.system_repo = SystemRepository(db)

    async def fetch_updates(
        self,
        since_date: date | None = None,
        page_size: int = 1000,
        start_id: int | None = None,
    ) -> dict[str, Any]:
        """Fetch and process ALL company updates since the given date or ID.

        Handles pagination automatically. Uses phased processing:
        1. Fetch page of updates from API
        2. Concurrently fetch company details for each update
        3. Sequentially persist to database
        4. Repeat for next page

        Args:
            since_date: Fetch updates after this date (defaults to yesterday)
            page_size: Number of updates per API call (max 10000)
            start_id: If provided, fetch updates strictly AFTER this ID (ignoring date)

        Returns:
            Dictionary with total processing results
        """
        if since_date is None:
            since_date = date.today() - timedelta(days=1)

        # Format date as ISO 8601 timestamp for the API
        since_datetime = datetime.combine(since_date, datetime.min.time())
        since_iso = since_datetime.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        # Initialize result tracking
        result = UpdateBatchResult(
            since_date=since_date,
            since_iso=since_iso,
        )

        logger.info(
            f"Starting update sync. Start ID: {start_id}, Date: {since_iso}. "
            f"Batch size: {page_size}, Concurrency: {CONCURRENCY_LIMIT}"
        )

        # Initial URL determination
        # Priority: start_id > since_date
        next_url: str | None = (
            f"{self.UPDATES_BASE_URL}?oppdateringsid={start_id}&size={min(page_size, 10000)}"
            if start_id is not None
            else f"{self.UPDATES_BASE_URL}?dato={since_iso}&size={min(page_size, 10000)}"
        )

        async with httpx.AsyncClient(timeout=self.brreg_api.timeout) as http_client:
            while next_url:
                try:
                    page_result = await self._process_single_page(
                        http_client=http_client,
                        url=next_url,
                        page_size=page_size,
                        result=result,
                    )
                    next_url = page_result

                except Exception as e:
                    error_msg = f"Critical error during update loop: {e!s}"
                    logger.exception(error_msg)
                    result.errors.append(error_msg)
                    break

        # Refresh materialized view after all updates
        await self._refresh_materialized_view(result)

        logger.info(
            f"Update summary: {result.companies_processed} processed "
            f"({result.companies_created} new, {result.companies_updated} updated, "
            f"{result.api_errors} API errors, {result.db_errors} DB errors)"
        )

        return result.model_dump()

    async def _process_single_page(
        self,
        http_client: httpx.AsyncClient,
        url: str,
        page_size: int,
        result: UpdateBatchResult,
    ) -> str | None:
        """Process a single page of updates.

        Returns:
            URL for next page, or None if no more pages
        """
        logger.info(f"Fetching updates page {result.pages_fetched + 1}...")

        response = await http_client.get(url)

        if response.status_code != 200:
            error_msg = f"API returned status {response.status_code} for URL: {url}"
            logger.error(error_msg)
            result.errors.append(error_msg)
            return None

        data = response.json()
        result.pages_fetched += 1

        # Extract entities from embedded HAL response
        entities = data.get("_embedded", {}).get("oppdaterteEnheter", [])
        batch_count = len(entities)
        logger.info(f"Processing batch of {batch_count} updates...")

        if batch_count == 0:
            return None

        # Track last seen ID for keyset pagination
        last_seen_id: int | None = None

        # Process in chunks to bound memory and enable incremental commits
        for chunk_start in range(0, len(entities), CONCURRENCY_LIMIT):
            chunk = entities[chunk_start : chunk_start + CONCURRENCY_LIMIT]

            # Phase 1: Concurrent API fetch
            fetch_results = await self._fetch_chunk_details(chunk)

            # Phase 2: Sequential DB persist with transaction
            await self._persist_chunk(fetch_results, result)

            # Update pagination tracking
            for entity in chunk:
                oppdateringsid = entity.get("oppdateringsid")
                if oppdateringsid is not None:
                    last_seen_id = oppdateringsid
                    if result.latest_oppdateringsid is None:
                        result.latest_oppdateringsid = oppdateringsid
                    else:
                        result.latest_oppdateringsid = max(result.latest_oppdateringsid, oppdateringsid)

        # Determine next URL using keyset pagination
        if last_seen_id:
            next_url = f"{self.UPDATES_BASE_URL}?oppdateringsid={last_seen_id}&size={min(page_size, 10000)}"
            logger.info(f"Preparing next batch starting after ID {last_seen_id}...")
        else:
            next_url = data.get("_links", {}).get("next", {}).get("href")

        # If batch was smaller than requested, we're likely done
        if batch_count < page_size and not data.get("_links", {}).get("next"):
            logger.info("No more pages (batch < size). Update sync complete.")
            return None

        return next_url

    async def _fetch_chunk_details(self, entities: list[dict[str, Any]]) -> list[FetchResult]:
        """Concurrently fetch company details for a chunk of updates.

        This is Phase 1 - pure IO with no database access.

        Args:
            entities: List of update entities from Brreg API

        Returns:
            List of FetchResult objects (success or failure for each)
        """
        semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

        async def fetch_single(entity: dict[str, Any]) -> FetchResult:
            orgnr = entity.get("organisasjonsnummer", "")
            endringstype = entity.get("endringstype", "")

            # Validate orgnr format
            if not orgnr or len(orgnr) != 9 or not orgnr.isdigit():
                return FetchResult(
                    orgnr=orgnr or "unknown",
                    success=False,
                    error=f"Invalid orgnr format: {orgnr}",
                )

            # Skip deletions
            if endringstype == "Sletting":
                return FetchResult(
                    orgnr=orgnr,
                    success=False,
                    error="Skipped (deletion)",
                )

            # Rate limit first, then acquire semaphore for concurrency control
            async with rate_limiter:
                async with semaphore:
                    try:
                        company_data = await self.brreg_api.fetch_company(orgnr)

                        if not company_data:
                            return FetchResult(
                                orgnr=orgnr,
                                success=False,
                                error="Company not found in API",
                            )

                        # Fetch financial statements for new companies
                        # We'll determine "is_new" in the persist phase
                        return FetchResult(
                            orgnr=orgnr,
                            success=True,
                            company_data=company_data,
                        )

                    except Exception as e:
                        logger.warning(f"API error fetching {orgnr}: {e}")
                        return FetchResult(
                            orgnr=orgnr,
                            success=False,
                            error=f"API error: {e!s}",
                        )

        tasks = [fetch_single(entity) for entity in entities]
        return await asyncio.gather(*tasks)

    async def _persist_chunk(
        self,
        fetch_results: list[FetchResult],
        result: UpdateBatchResult,
    ) -> None:
        """Persist a chunk of fetched data to the database.

        This is Phase 2 - sequential database operations with proper transactions.
        Uses chunk-based commits (every DB_COMMIT_CHUNK_SIZE records) for efficiency.

        Args:
            fetch_results: Results from the fetch phase
            result: Aggregate result tracker to update
        """
        records_since_commit = 0

        for fetch_result in fetch_results:
            result.companies_processed += 1

            if not fetch_result.success:
                if "Skipped" in (fetch_result.error or ""):
                    result.companies_skipped += 1
                else:
                    result.api_errors += 1
                    if fetch_result.error and "Invalid" not in fetch_result.error:
                        result.errors.append(f"{fetch_result.orgnr}: {fetch_result.error}")
                continue

            try:
                # Persist company data
                company = await self.company_repo.create_or_update(
                    fetch_result.company_data  # type: ignore[arg-type]
                )

                # Check if this is a new company (never polled for financials)
                is_new = company.last_polled_regnskap is None

                if is_new:
                    result.companies_created += 1

                    # Fetch and persist financials for new companies
                    await self._fetch_and_persist_financials(fetch_result.orgnr, result)
                else:
                    result.companies_updated += 1

                records_since_commit += 1

                # Commit in chunks for efficiency (reduces transaction overhead)
                if records_since_commit >= DB_COMMIT_CHUNK_SIZE:
                    await self.db.commit()
                    records_since_commit = 0
                    logger.debug(f"Committed chunk of {DB_COMMIT_CHUNK_SIZE} records")

            except Exception as e:
                result.db_errors += 1
                result.errors.append(f"DB error {fetch_result.orgnr}: {e!s}")
                logger.error(f"Database error persisting {fetch_result.orgnr}: {e}")
                # Rollback the failed transaction
                await self.db.rollback()
                records_since_commit = 0  # Reset counter after rollback

        # Final commit for remaining records
        if records_since_commit > 0:
            await self.db.commit()
            logger.debug(f"Committed final chunk of {records_since_commit} records")

    async def _fetch_and_persist_financials(
        self,
        orgnr: str,
        result: UpdateBatchResult,
    ) -> None:
        """Fetch and persist financial statements for a company.

        Called only for newly discovered companies.
        """
        try:
            statements = await self.brreg_api.fetch_financial_statements(orgnr)

            for statement in statements:
                try:
                    parsed = await self.brreg_api.parse_financial_data(statement)
                    if parsed.get("aar"):
                        await self.accounting_repo.create_or_update(orgnr, parsed, statement)
                        result.financials_updated += 1
                except ValidationError as e:
                    logger.warning(f"Validation error parsing financials for {orgnr}: {e}")
                except Exception as e:
                    logger.warning(f"Error persisting financial for {orgnr}: {e}")

            # Mark as polled regardless of success
            await self.company_repo.update_last_polled_regnskap(orgnr)

        except Exception as e:
            logger.warning(f"Error fetching financials for {orgnr}: {e}")
            result.errors.append(f"Financials error {orgnr}: {e!s}")

    async def _refresh_materialized_view(self, result: UpdateBatchResult) -> None:
        """Refresh the latest_accountings materialized view."""
        try:
            logger.info("Refreshing materialized view 'latest_accountings'...")
            from sqlalchemy import text

            await self.db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY latest_accountings"))
            await self.db.commit()
            logger.info("Materialized view refreshed successfully.")
        except Exception as e:
            logger.error(f"Failed to refresh materialized view: {e}")
            result.errors.append(f"Failed to refresh materialized view: {e}")
            await self.db.rollback()
