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
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx


from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.accounting_repository import AccountingRepository
from repositories.company import CompanyRepository
from repositories.role_repository import RoleRepository
from repositories.subunit_repository import SubUnitRepository
from repositories.system_repository import SystemRepository
import models
from schemas.brreg import FetchResult, UpdateBatchResult
from services.brreg_api_service import BrregApiService
from services.rate_limits import BRREG_RATE_LIMITER

logger = logging.getLogger(__name__)

# Concurrency limit for parallel API fetching
CONCURRENCY_LIMIT = 10

# Chunk size for database commits (commit after N records)
DB_COMMIT_CHUNK_SIZE = 25


class UpdateService:
    """Service for fetching incremental updates from Brønnøysund.

    Uses the oppdateringer (updates) endpoint to get daily changes.
    Implements phased processing for safety and performance.
    """

    UPDATES_BASE_URL = "https://data.brreg.no/enhetsregisteret/api/oppdateringer/enheter"
    SUBUNIT_UPDATES_BASE_URL = "https://data.brreg.no/enhetsregisteret/api/oppdateringer/underenheter"
    ROLE_UPDATES_BASE_URL = "https://data.brreg.no/enhetsregisteret/api/oppdateringer/roller"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.brreg_api = BrregApiService()
        self.company_repo = CompanyRepository(db)
        self.subunit_repo = SubUnitRepository(db)
        self.role_repo = RoleRepository(db)
        self.accounting_repo = AccountingRepository(db)
        self.system_repo = SystemRepository(db)

    async def report_sync_error(
        self,
        orgnr: str,
        entity_type: str,
        error_message: str,
        status: models.SyncErrorStatus = models.SyncErrorStatus.PENDING,
        status_code: int | None = None,
    ) -> None:
        """Report a synchronization error.

        Smart Filtering:
        - Ignores 404s for 'accounting' (expected missing data).
        - Ignores 404s for 'role' (some small companies have no roles).
        """
        # Skip expected missing records (data reality, not a technical sync error)
        if status_code == 404 and entity_type in ("accounting", "role"):
            return

        try:
            from sqlalchemy import select

            # Check if an unresolved error already exists to avoid duplicates
            # Use no_autoflush to prevent premature flushes if the session has dirty objects
            # which might cause a rollback exception here.
            with self.db.no_autoflush:
                stmt = select(models.SyncError).where(
                    models.SyncError.orgnr == orgnr,
                    models.SyncError.entity_type == entity_type,
                    models.SyncError.status.in_(
                        [models.SyncErrorStatus.PENDING.value, models.SyncErrorStatus.RETRYING.value]
                    ),
                )
                result = await self.db.execute(stmt)
                existing = result.scalar_one_or_none()

            if existing:
                existing.error_message = error_message
                existing.attempt_count += 1
                existing.last_retry_at = datetime.now(timezone.utc)
            else:
                new_error = models.SyncError(
                    orgnr=orgnr,
                    entity_type=entity_type,
                    error_message=error_message,
                    status=status.value if hasattr(status, "value") else status,
                    attempt_count=1,
                )
                self.db.add(new_error)

            # We don't commit here; we rely on the caller's transaction context
            # or the next sequential commit in the batch flow.
        except Exception as e:
            logger.error(f"Failed to report sync error for {orgnr}: {e}")

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
                    # Rollback any partial transaction to allow recovery
                    await self.db.rollback()
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
            async with BRREG_RATE_LIMITER:
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

        sorted_results = sorted(fetch_results, key=lambda item: item.orgnr)

        for fetch_result in sorted_results:
            result.companies_processed += 1

            if not fetch_result.success:
                if "Skipped" in (fetch_result.error or ""):
                    result.companies_skipped += 1
                else:
                    result.api_errors += 1
                    if fetch_result.error and "Invalid" not in fetch_result.error:
                        result.errors.append(f"{fetch_result.orgnr}: {fetch_result.error}")
                        # Report to SyncError for later retry by repair worker
                        await self.report_sync_error(
                            orgnr=fetch_result.orgnr,
                            entity_type="company",
                            error_message=fetch_result.error,
                        )
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

    async def _refresh_materialized_view(self, result: Any) -> None:
        """Refresh the latest_accountings materialized view."""
        try:
            logger.info("Refreshing materialized view 'latest_accountings'...")
            from sqlalchemy import text

            await self.db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY latest_accountings"))
            await self.db.commit()
            logger.info("Materialized view refreshed successfully.")
        except Exception as e:
            logger.error(f"Failed to refresh materialized view: {e}")
            if hasattr(result, "errors"):
                result.errors.append(f"Failed to refresh materialized view: {e}")
            await self.db.rollback()

    async def fetch_subunit_updates(
        self,
        since_date: date | None = None,
        page_size: int = 1000,
        start_id: int | None = None,
    ) -> dict[str, Any]:
        """Fetch and process ALL subunit updates since the given date or ID."""
        if since_date is None:
            since_date = date.today() - timedelta(days=1)

        since_datetime = datetime.combine(since_date, datetime.min.time())
        since_iso = since_datetime.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        result = UpdateBatchResult(since_date=since_date, since_iso=since_iso)
        logger.info(f"Starting subunit updates metadata sync. Date: {since_iso}, ID: {start_id}")

        next_url: str | None = (
            f"{self.SUBUNIT_UPDATES_BASE_URL}?oppdateringsid={start_id}&size={min(page_size, 10000)}"
            if start_id is not None
            else f"{self.SUBUNIT_UPDATES_BASE_URL}?dato={since_iso}&size={min(page_size, 10000)}"
        )

        pages_processed = 0
        async with httpx.AsyncClient(timeout=self.brreg_api.timeout) as http_client:
            while next_url:
                try:
                    response = await http_client.get(next_url)
                    if response.status_code != 200:
                        logger.error(f"API error {response.status_code} for subunits: {next_url}")
                        break

                    data = response.json()
                    entities = data.get("_embedded", {}).get("oppdaterteUnderenheter", [])

                    # Phase 1: Concurrent fetch subunit details
                    semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

                    async def fetch_one(entity: dict[str, Any]) -> dict[str, Any] | None:
                        orgnr = entity.get("organisasjonsnummer")
                        if not orgnr:
                            return None
                        async with semaphore:
                            try:
                                return await self.brreg_api.fetch_subunit(orgnr)
                            except Exception as ex:
                                logger.warning(
                                    f"Failed to fetch subunit details for {orgnr}: {ex}", extra={"orgnr": orgnr}
                                )
                                return None

                    fetch_tasks = [fetch_one(entity) for entity in entities]
                    fetch_results = await asyncio.gather(*fetch_tasks)

                    # Phase 2: Sequential persist
                    all_subunits_data = [res for res in fetch_results if res]

                    if all_subunits_data:
                        # Ensure parents exist before saving subunits
                        verified_parents = await self._ensure_parent_companies_exist(all_subunits_data)

                        all_subunits = []
                        for subunit_data in all_subunits_data:
                            parent_orgnr = subunit_data.get("overordnetEnhet")

                            # Skip subunits without parent_orgnr (required field)
                            if not parent_orgnr:
                                logger.warning(
                                    f"Skipping subunit {subunit_data.get('organisasjonsnummer')} "
                                    f"because it has no parent_orgnr (overordnetEnhet is missing)."
                                )
                                continue

                            # Convert to string for comparison
                            parent_orgnr = str(parent_orgnr)

                            if parent_orgnr not in verified_parents:
                                logger.warning(
                                    f"Skipping subunit {subunit_data.get('organisasjonsnummer')} "
                                    f"because parent {parent_orgnr} is missing and could not be fetched."
                                )
                                continue

                            orgnr = subunit_data.get("organisasjonsnummer")
                            all_subunits.append(
                                models.SubUnit(
                                    orgnr=orgnr,
                                    navn=subunit_data.get("navn"),
                                    parent_orgnr=parent_orgnr,
                                    organisasjonsform=subunit_data.get("organisasjonsform", {}).get("kode"),
                                    naeringskode=subunit_data.get("naeringskode1", {}).get("kode"),
                                    antall_ansatte=subunit_data.get("antallAnsatte", 0),
                                    beliggenhetsadresse=subunit_data.get("beliggenhetsadresse"),
                                    postadresse=subunit_data.get("postadresse"),
                                    stiftelsesdato=self._parse_date(subunit_data.get("stiftelsesdato")),
                                    registreringsdato_enhetsregisteret=self._parse_date(
                                        subunit_data.get("registreringsdatoEnhetsregisteret")
                                    ),
                                    raw_data=subunit_data,
                                )
                            )
                            result.companies_updated += 1

                        if all_subunits:
                            await self.subunit_repo.create_batch(all_subunits, commit=True)

                    # Update latest ID from original entities
                    for entity in entities:
                        oppdateringsid = entity.get("oppdateringsid")
                        if oppdateringsid:
                            if result.latest_oppdateringsid is None:
                                result.latest_oppdateringsid = oppdateringsid
                            else:
                                result.latest_oppdateringsid = max(result.latest_oppdateringsid, oppdateringsid)

                    result.companies_processed += len(entities)
                    pages_processed += 1
                    logger.info(
                        f"Processed page {pages_processed} with {len(entities)} subunit updates",
                        extra={"batch_size": len(entities)},
                    )
                    next_url = data.get("_links", {}).get("next", {}).get("href")

                except Exception as e:
                    logger.exception(f"Error in subunit updates: {e}")
                    # Rollback any partial transaction to allow recovery
                    await self.db.rollback()
                    break

        return result.model_dump()

    async def _ensure_parent_companies_exist(self, subunits_data: list[dict[str, Any]]) -> set[str]:
        """Ensure all parent companies for a batch of subunits exist in the database.

        Fetches missing parents from Brreg API if necessary.
        Returns the set of all verified (existing or created) parent orgnrs.
        """
        # Collect unique parent orgnrs
        parent_orgnrs: set[str] = {str(s["overordnetEnhet"]) for s in subunits_data if s.get("overordnetEnhet")}
        if not parent_orgnrs:
            return set()

        # Check which parents already exist
        existing_orgnrs = await self.company_repo.get_existing_orgnrs(list(parent_orgnrs))
        missing_orgnrs = parent_orgnrs - existing_orgnrs

        if not missing_orgnrs:
            return existing_orgnrs

        logger.info(f"Found {len(missing_orgnrs)} missing parent companies. Fetching from Brreg...")

        # Concurrent fetch missing parents
        semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

        async def fetch_parent(orgnr: str) -> dict[str, Any] | None:
            async with semaphore:
                try:
                    return await self.brreg_api.fetch_company(orgnr)
                except Exception as e:
                    error_msg = f"Failed to fetch missing parent: {e!s}"
                    logger.warning(f"{error_msg} for {orgnr}")
                    await self.report_sync_error(orgnr, "company", error_msg)
                    return None

        missing_orgnr_list = sorted(missing_orgnrs)
        fetch_tasks = [fetch_parent(orgnr) for orgnr in missing_orgnr_list]
        fetched_parents = await asyncio.gather(*fetch_tasks)

        # Sequential persist
        count = 0
        for parent_data in fetched_parents:
            if parent_data:
                # Skip onboarding if the company is already deleted (has slettedato)
                if parent_data.get("slettedato"):
                    logger.debug(
                        f"Skipping onboarding of deleted parent company {parent_data.get('organisasjonsnummer')} "
                        f"(slettedato: {parent_data.get('slettedato')})"
                    )
                    continue

                try:
                    await self.company_repo.create_or_update(parent_data)
                    count += 1
                except Exception as e:
                    error_msg = f"Failed to persist parent: {e!s}"
                    logger.error(f"{error_msg} for {parent_data.get('organisasjonsnummer')}")
                    await self.report_sync_error(str(parent_data.get("organisasjonsnummer")), "company", error_msg)

        if count > 0:
            await self.db.commit()
            logger.info(f"Saved {count} missing parent companies to database")

        # Re-check existence to get final set of verified parents
        # (Alternatively, we could track which ones succeeded above)
        return await self.company_repo.get_existing_orgnrs(list(parent_orgnrs))

    async def fetch_role_updates(
        self,
        since_date: date | None = None,
        after_id: int | None = None,
        page_size: int = 100,
    ) -> dict[str, Any]:
        """Fetch and process ALL role updates using CloudEvents batches."""
        if since_date is None:
            since_date = date.today() - timedelta(days=1)

        since_iso = since_date.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        result = UpdateBatchResult(since_date=since_date, since_iso=since_iso)

        logger.info(f"Starting role updates sync. Date: {since_iso}, afterId: {after_id}")

        params: dict[str, Any] = {"size": min(page_size, 1000)}
        if after_id:
            params["afterId"] = after_id
        else:
            params["afterTime"] = since_iso

        # To avoid re-fetching dead or subunit orgnrs in the same execution
        failed_this_run: set[str] = set()

        async with httpx.AsyncClient(timeout=self.brreg_api.timeout) as http_client:
            while True:
                try:
                    response = await http_client.get(self.ROLE_UPDATES_BASE_URL, params=params)
                    if response.status_code != 200:
                        logger.error(f"API error {response.status_code} for roles: {response.text}")
                        break

                    events = response.json()
                    if not events or not isinstance(events, list):
                        break

                    logger.info(f"Processing batch of {len(events)} role updates...")

                    # Extract unique orgnrs from the event batch
                    orgnrs_to_sync = set()
                    last_seen_id = after_id
                    for event in events:
                        orgnr = event.get("data", {}).get("organisasjonsnummer")
                        if orgnr:
                            orgnrs_to_sync.add(orgnr)
                        try:
                            # IMPORTANT: Track progress even if we fail later in this batch
                            current_id = int(event.get("id"))
                            if last_seen_id is None or current_id > last_seen_id:
                                last_seen_id = current_id
                        except (ValueError, TypeError):
                            pass

                    await self.db.commit()

                    # Phase 0: Smart Onboarding.
                    # Ensure all companies for which we're syncing roles exist in the database.
                    # We check both 'bedrifter' (main units) and 'underenheter' (subunits).
                    # Subunits are skipped because they have no roles in Brreg.
                    existing_orgnrs = await self.company_repo.get_existing_orgnrs(list(orgnrs_to_sync))
                    existing_subunits = await self.subunit_repo.get_existing_orgnrs(list(orgnrs_to_sync))

                    # Identify truly unknown orgnrs (not in main units, not in subunits, not failed yet)
                    unknown_orgnrs = orgnrs_to_sync - existing_orgnrs - existing_subunits - failed_this_run

                    if unknown_orgnrs:
                        unknown_list = sorted(unknown_orgnrs)
                        logger.info(
                            f"Checking {len(unknown_list)} unknown orgnrs from role feed for missing main companies..."
                        )

                        semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

                        async def fetch_missing_main_unit(org_no: str) -> dict[str, Any] | None:
                            async with semaphore:
                                try:
                                    # Use main unit endpoint. Subunits return 404 here.
                                    return await self.brreg_api.fetch_company(org_no)
                                except Exception as e:
                                    # 404/410 are common for subunits or deleted entities
                                    logger.debug(f"Orgnr {org_no} is likely a subunit or deleted (404 on enheter): {e}")
                                    return None

                        fetch_tasks = [fetch_missing_main_unit(o) for o in unknown_list]
                        fetched_results = await asyncio.gather(*fetch_tasks)

                        new_companies_onboarded = 0
                        for i, company_data in enumerate(fetched_results):
                            target_orgnr = unknown_list[i]
                            if company_data:
                                # Skip onboarding if the company is already deleted (has slettedato)
                                if company_data.get("slettedato"):
                                    logger.debug(
                                        f"Skipping onboarding of deleted company {target_orgnr} "
                                        f"(slettedato: {company_data.get('slettedato')})"
                                    )
                                    failed_this_run.add(target_orgnr)
                                    continue

                                try:
                                    await self.company_repo.create_or_update(company_data)
                                    existing_orgnrs.add(target_orgnr)
                                    new_companies_onboarded += 1
                                except Exception as e:
                                    logger.error(f"Failed to persist onboarded company {target_orgnr}: {e}")
                            else:
                                # Mark as failed/subunit to avoid redundant API calls in this execution
                                failed_this_run.add(target_orgnr)

                        if new_companies_onboarded > 0:
                            await self.db.commit()
                            logger.info(
                                f"Successfully onboarded {new_companies_onboarded} missing main companies during role sync."
                            )

                    # Phase 1: Collect all roles for companies that exist in the database
                    all_batch_roles: list[models.Role] = []
                    processed_orgnrs: set[str] = set()

                    for orgnr in orgnrs_to_sync:
                        # Skip companies that still don't exist (couldn't be fetched)
                        if orgnr not in existing_orgnrs:
                            logger.warning(f"Skipping role sync for {orgnr}: company not found in bedrifter table")
                            continue

                        try:
                            # Use Brreg API directly to fetch current roles
                            roles_data = await self.brreg_api.fetch_roles(orgnr)

                            # Ensure any companies mentioned in the roles exist as parents
                            potential_parents = [
                                {"overordnetEnhet": r.get("enhet_orgnr")} for r in roles_data if r.get("enhet_orgnr")
                            ]
                            if potential_parents:
                                await self._ensure_parent_companies_exist(potential_parents)

                            # Create Role models
                            for r in roles_data:
                                all_batch_roles.append(
                                    models.Role(
                                        orgnr=orgnr,
                                        type_kode=r.get("type_kode"),
                                        type_beskrivelse=r.get("type_beskrivelse"),
                                        person_navn=r.get("person_navn"),
                                        foedselsdato=self._parse_date(r.get("foedselsdato")),
                                        enhet_navn=r.get("enhet_navn"),
                                        enhet_orgnr=r.get("enhet_orgnr"),
                                        fratraadt=r.get("fratraadt", False),
                                        rekkefoelge=r.get("rekkefoelge"),
                                    )
                                )
                            result.companies_updated += 1
                            processed_orgnrs.add(orgnr)

                        except Exception as e:
                            error_msg = f"Failed to sync roles: {e!s}"
                            logger.error(f"{error_msg} for {orgnr}")
                            status_code = getattr(e, "status_code", None) if hasattr(e, "status_code") else None
                            await self.report_sync_error(orgnr, "role", error_msg, status_code=status_code)

                    # Phase 2: Transactional database update
                    if processed_orgnrs:
                        # 1. Delete old roles for successfully processed companies
                        from sqlalchemy import delete

                        await self.db.execute(delete(models.Role).where(models.Role.orgnr.in_(processed_orgnrs)))

                        # 2. Bulk insert new roles
                        if all_batch_roles:
                            await self.role_repo.create_batch(all_batch_roles, commit=False)

                        # 3. Final commit for this batch
                        await self.db.commit()

                        # Save progress to prevent repeating if next batch fails or run times out
                        if last_seen_id:
                            await self.system_repo.set_state("role_update_latest_id", str(last_seen_id))

                    result.companies_processed += len(events)
                    result.latest_oppdateringsid = last_seen_id
                    # If we got a full batch, continue to next batch
                    if len(events) >= params["size"]:
                        params["afterId"] = last_seen_id
                        if "afterTime" in params:
                            del params["afterTime"]
                    else:
                        break

                except Exception as e:
                    logger.exception(f"Error in role updates batch: {e}")
                    # Rollback any partial transaction to allow recovery
                    await self.db.rollback()
                    break

            # If we processed roles, update DB statistics to keep sitemap seek planner fast
            if result.companies_updated > 0:
                logger.info("Updating database statistics for 'roller' table...")
                try:
                    await self.db.execute(text("ANALYZE roller;"))
                except Exception as e:
                    logger.warning(f"Failed to run ANALYZE roller: {e}")

        return result.model_dump()

    def _parse_date(self, date_str: Any) -> date | None:
        """Safely parse a date string from Brreg API into a Python date object."""
        if not date_str or not isinstance(date_str, str):
            return None
        try:
            # Handle YYYY-MM-DD or ISO with time
            return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError, IndexError):
            logger.debug(f"Failed to parse date string: {date_str}")
            return None
