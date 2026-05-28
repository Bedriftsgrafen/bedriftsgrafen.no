import asyncio
import logging
import os
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.concurrency import API_CONCURRENCY_LIMIT
from constants.urls import BRREG_ROLE_UPDATES_URL, BRREG_SUBUNIT_UPDATES_URL, BRREG_UPDATES_URL
from repositories.accounting_repository import AccountingRepository
from repositories.company.repository import CompanyRepository
from repositories.company_event_repository import CompanyEventRepository
from repositories.role_repository import RoleRepository
from repositories.subunit_repository import SubUnitRepository
from repositories.system_repository import SystemRepository
from schemas.brreg import FetchResult, UpdateBatchResult
from services.brreg_api_service import BrregApiService
from services.brreg_mappers import map_role_from_api, map_subunit_from_api
from services.rate_limits import BRREG_RATE_LIMITER
from utils.logging_config import sanitize_log
from utils.metrics import SYNC_BATCH_PAGES_TOTAL, SYNC_LATENCY, SYNC_OPERATIONS_TOTAL

logger = logging.getLogger(__name__)

DB_COMMIT_CHUNK_SIZE = 100  # Commit every X records for efficiency
UPDATE_PAGE_SIZE = 1000  # Max size allowed by API


class UpdateService:
    """Service for handling incremental updates from Brønnøysundregistrene."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.brreg_api = BrregApiService()
        self.company_repo = CompanyRepository(db)
        self.subunit_repo = SubUnitRepository(db)
        self.role_repo = RoleRepository(db)
        self.system_repo = SystemRepository(db)
        self.accounting_repo = AccountingRepository(db)
        self.event_repo = CompanyEventRepository(db)
        self.event_ledger_enabled = os.getenv("ENABLE_COMPANY_EVENT_LEDGER", "").lower() in {"1", "true", "yes"}

    @staticmethod
    def _parse_brreg_datetime(value: Any) -> datetime | None:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(str(value))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)

    @staticmethod
    def _parse_brreg_date_as_datetime(value: Any) -> datetime | None:
        if not value:
            return None
        try:
            parsed_date = date.fromisoformat(str(value))
        except ValueError:
            return None
        return datetime.combine(parsed_date, datetime.min.time(), tzinfo=UTC)

    async def _record_company_event_safe(
        self,
        *,
        orgnr: str,
        event_type: str,
        source: str,
        source_update_id: str | None = None,
        occurred_at: datetime | None = None,
        previous_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        if not self.event_ledger_enabled:
            return

        try:
            async with self.db.begin_nested():
                await self.event_repo.record_event(
                    orgnr=orgnr,
                    event_type=event_type,
                    source=source,
                    source_update_id=source_update_id,
                    occurred_at=occurred_at,
                    previous_value=previous_value,
                    new_value=new_value,
                    payload=payload,
                )
        except Exception:
            logger.exception(
                "Failed to record company event",
                extra={"orgnr": sanitize_log(orgnr), "event_type": sanitize_log(event_type)},
            )

    async def report_sync_error(
        self,
        orgnr: str,
        entity_type: str,
        error_message: str,
        status_code: int | None = None,
    ) -> None:
        """Report a synchronization error for later analysis and repair.

        Args:
            orgnr: Organization number that failed to sync
            entity_type: Type of entity (company, subunit, accounting, role)
            error_message: Error description
            status_code: Optional HTTP status code from API
        """
        # Special filtering: 404 for roles/accounting often means they just don't exist yet
        # (e.g. new company without first year filed). We don't need to alert on these.
        if status_code == 404 and entity_type in ("accounting", "role"):
            return

        try:
            # Check if an unresolved error already exists for this orgnr/type
            # Use no_autoflush to prevent premature flushes if the session has dirty objects
            # which might cause a rollback exception here.
            with self.db.no_autoflush:
                from sqlalchemy import select

                stmt = select(models.SyncError).where(
                    models.SyncError.orgnr == orgnr,
                    models.SyncError.entity_type == entity_type,
                    models.SyncError.status != models.SyncErrorStatus.RESOLVED,
                )
                result = await self.db.execute(stmt)
                existing = result.scalar_one_or_none()

            if existing:
                existing.error_message = error_message
                existing.last_retry_at = datetime.now(UTC)
                existing.attempt_count += 1
                existing.status = models.SyncErrorStatus.RETRYING
            else:
                new_error = models.SyncError(
                    orgnr=orgnr,
                    entity_type=entity_type,
                    error_message=error_message,
                    status=models.SyncErrorStatus.PENDING,
                )
                self.db.add(new_error)

            # Note: We don't commit here, relying on the caller's transaction context
            # unless we're in an isolated reporting call.
        except Exception as e:
            logger.error(f"Failed to report sync error for {orgnr}: {e}")

    async def fetch_updates(
        self,
        since_date: date | None = None,
        page_size: int = UPDATE_PAGE_SIZE,
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
            "Starting update sync. Start ID: %s, Date: %s. Batch size: %s, Concurrency: %s",
            sanitize_log(start_id),
            sanitize_log(since_iso),
            page_size,
            API_CONCURRENCY_LIMIT,
        )

        # Initial URL determination
        # Priority: start_id > since_date
        next_url: str | None = (
            f"{BRREG_UPDATES_URL}?oppdateringsid={start_id}&size={min(page_size, 10000)}"
            if start_id is not None
            else f"{BRREG_UPDATES_URL}?dato={since_iso}&size={min(page_size, 10000)}"
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
        """Process a single page of updates."""
        SYNC_BATCH_PAGES_TOTAL.labels(entity_type="company").inc()
        with SYNC_LATENCY.labels(entity_type="company").time():
            logger.info(f"Fetching updates page {result.pages_fetched + 1}...")

            response = await http_client.get(url)

            if response.status_code != 200:
                error_msg = f"API returned status {response.status_code} for URL: {url}"
                logger.error(error_msg)
                result.errors.append(error_msg)
                return None

            data = response.json()
            entities = data.get("_embedded", {}).get("oppdaterteEnheter", [])

            if not entities:
                logger.info("No new updates found.")
                return None

            # Phase 1: Concurrent Fetch
            fetch_results = await self._fetch_chunk_details(entities)

            # Phase 2: Sequential Persistence
            await self._persist_chunk(fetch_results, result)

            # Metadata tracking
            result.pages_fetched += 1
            for entity in entities:
                oppdateringsid = entity.get("oppdateringsid")
                if oppdateringsid:
                    if result.latest_oppdateringsid is None:
                        result.latest_oppdateringsid = oppdateringsid
                    else:
                        result.latest_oppdateringsid = max(result.latest_oppdateringsid, oppdateringsid)

            return data.get("_links", {}).get("next", {}).get("href")

    async def _fetch_chunk_details(self, entities: list[dict[str, Any]]) -> list[FetchResult]:
        """Fetch details for a chunk of companies concurrently.

        Uses a semaphore to respect concurrency limits and avoid overwhelming the API.
        """
        semaphore = asyncio.Semaphore(API_CONCURRENCY_LIMIT)

        async def fetch_single(entity: dict[str, Any]) -> FetchResult:
            orgnr = entity.get("organisasjonsnummer", "unknown")
            endringstype = entity.get("endringstype", "")
            source_update_id = str(entity["oppdateringsid"]) if entity.get("oppdateringsid") is not None else None
            source_event_time = self._parse_brreg_datetime(entity.get("dato"))

            # Validate orgnr format before making API calls
            if not orgnr or len(orgnr) != 9 or not orgnr.isdigit():
                return FetchResult(
                    orgnr=orgnr,
                    success=False,
                    error=f"Invalid orgnr format: {orgnr}",
                    source_update_id=source_update_id,
                    source_event_time=source_event_time,
                    source_change_type=endringstype,
                )

            # Mark deletions for processing in _persist_chunk
            if endringstype == "Sletting":
                return FetchResult(
                    orgnr=orgnr,
                    success=True,
                    company_data=None,  # None signals deletion to _persist_chunk
                    source_update_id=source_update_id,
                    source_event_time=source_event_time,
                    source_change_type=endringstype,
                )

            async with semaphore:
                try:
                    async with BRREG_RATE_LIMITER:
                        company_data = await self.brreg_api.fetch_company(orgnr)

                        # We don't fetch financials here anymore - it's too slow.
                        # Financials are now synced in a separate background job.
                        return FetchResult(
                            orgnr=orgnr,
                            success=True,
                            company_data=company_data,
                            source_update_id=source_update_id,
                            source_event_time=source_event_time,
                            source_change_type=endringstype,
                        )
                except Exception as exc:
                    return FetchResult(
                        orgnr=orgnr,
                        success=False,
                        error=str(exc),
                        source_update_id=source_update_id,
                        source_event_time=source_event_time,
                        source_change_type=endringstype,
                    )

        tasks = [fetch_single(entity) for entity in entities]
        return list(await asyncio.gather(*tasks))

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
        existing_employee_counts = await self._get_existing_employee_counts(
            [item.orgnr for item in sorted_results if item.success and item.company_data is not None]
        )

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
                # Handle deleted companies (None returned from API)
                if fetch_result.company_data is None:
                    deleted_count = await self.company_repo.delete_by_orgnr(fetch_result.orgnr)
                    if deleted_count:
                        await self._record_company_event_safe(
                            orgnr=fetch_result.orgnr,
                            event_type="company_deleted",
                            source="Enhetsregisteret via Brreg",
                            source_update_id=fetch_result.source_update_id,
                            occurred_at=fetch_result.source_event_time,
                            payload={
                                "time_semantics": "Tidspunkt fra Brregs oppdateringsstrøm når tilgjengelig.",
                            },
                        )
                        result.companies_deleted += 1
                        SYNC_OPERATIONS_TOTAL.labels(entity_type="company", operation_type="deleted").inc()
                    continue

                previous_employee_count = existing_employee_counts.get(fetch_result.orgnr)
                new_employee_count = fetch_result.company_data.get("antallAnsatte")

                # Persist company data
                company = await self.company_repo.create_or_update(fetch_result.company_data)

                # Check if this is a new company (never polled for financials)
                is_new = company.last_polled_regnskap is None

                if is_new and fetch_result.source_change_type == "Ny":
                    await self._record_company_event_safe(
                        orgnr=fetch_result.orgnr,
                        event_type="company_registered",
                        source="Enhetsregisteret via Brreg",
                        source_update_id=fetch_result.source_update_id,
                        occurred_at=self._parse_brreg_date_as_datetime(
                            fetch_result.company_data.get("registreringsdatoEnhetsregisteret")
                        )
                        or fetch_result.source_event_time,
                        new_value={
                            "navn": fetch_result.company_data.get("navn"),
                            "organisasjonsform": fetch_result.company_data.get("organisasjonsform", {}).get("kode")
                            if isinstance(fetch_result.company_data.get("organisasjonsform"), dict)
                            else None,
                            "antall_ansatte": fetch_result.company_data.get("antallAnsatte"),
                        },
                        payload={
                            "registreringsdato_enhetsregisteret": fetch_result.company_data.get(
                                "registreringsdatoEnhetsregisteret"
                            ),
                            "time_semantics": "Kildedato fra Enhetsregisteret når tilgjengelig; ellers Brregs oppdateringsstrøm.",
                        },
                    )
                if is_new:
                    result.companies_created += 1
                    SYNC_OPERATIONS_TOTAL.labels(entity_type="company", operation_type="created").inc()
                    # Fetch and persist financials for new companies
                    await self._fetch_and_persist_financials(fetch_result.orgnr, result)
                else:
                    result.companies_updated += 1
                    SYNC_OPERATIONS_TOTAL.labels(entity_type="company", operation_type="updated").inc()

                    if (
                        previous_employee_count is not None
                        and new_employee_count is not None
                        and previous_employee_count != new_employee_count
                    ):
                        await self._record_company_event_safe(
                            orgnr=fetch_result.orgnr,
                            event_type="employee_count_changed",
                            source="Enhetsregisteret via Brreg",
                            source_update_id=fetch_result.source_update_id,
                            occurred_at=fetch_result.source_event_time,
                            previous_value={"antall_ansatte": previous_employee_count},
                            new_value={"antall_ansatte": new_employee_count},
                            payload={
                                "time_semantics": "Tidspunkt fra Brregs oppdateringsstrøm når tilgjengelig.",
                            },
                        )

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

    async def _get_existing_employee_counts(self, orgnrs: list[str]) -> dict[str, int | None]:
        if not orgnrs:
            return {}

        result = await self.db.execute(
            select(models.Company.orgnr, models.Company.antall_ansatte).where(models.Company.orgnr.in_(orgnrs))
        )
        return {row.orgnr: row.antall_ansatte for row in result.all()}

    async def _fetch_and_persist_financials(
        self,
        orgnr: str,
        result: UpdateBatchResult,
    ) -> None:
        """Fetch and persist financial statements for a company.

        Called only for newly discovered companies.
        Always marks last_polled_regnskap afterwards (even on failure)
        to prevent infinite retry loops for companies whose financials
        consistently return server errors from Brønnøysund.
        """
        try:
            statements = await self.brreg_api.fetch_financial_statements(orgnr)

            for statement in statements:
                try:
                    parsed = await self.brreg_api.parse_financial_data(statement)
                    if parsed.get("aar"):
                        await self.accounting_repo.create_or_update(orgnr, parsed, statement)
                        await self._record_company_event_safe(
                            orgnr=orgnr,
                            event_type="accounting_added",
                            source="Regnskapsregisteret via Brreg",
                            source_update_id=str(
                                statement.get("id")
                                or statement.get("journalnr")
                                or f"{orgnr}:{parsed.get('aar')}:{parsed.get('periode_til')}"
                            ),
                            occurred_at=self._parse_brreg_date_as_datetime(parsed.get("periode_til")),
                            new_value={
                                "aar": parsed.get("aar"),
                                "periode_til": parsed.get("periode_til"),
                            },
                            payload={
                                "journalnr": statement.get("journalnr"),
                                "time_semantics": "Regnskapsperiode når tilgjengelig; observert tidspunkt er Bedriftsgrafens importtid.",
                            },
                        )
                        result.financials_updated += 1
                except ValidationError as e:
                    logger.warning(f"Validation error parsing financials for {orgnr}: {e}")
                except Exception as e:
                    logger.warning(f"Error persisting financial for {orgnr}: {e}")

        except Exception as e:
            error_msg = f"Failed to fetch financials for {orgnr}: {e}"
            logger.warning(error_msg)
            result.errors.append(error_msg)
        finally:
            # Always mark as polled to prevent infinite retry loops.
            # Companies with persistent API errors will be retried after
            # the 30-day cutoff in sync_accounting_batch.
            try:
                await self.company_repo.update_last_polled_regnskap(orgnr)
            except Exception as e:
                logger.error(f"Failed to update last_polled_regnskap for {orgnr}: {e}")
                await self.db.rollback()

    async def fetch_subunit_updates(
        self,
        since_date: date | None = None,
        page_size: int = 100,
        start_id: int | None = None,
    ) -> dict[str, Any]:
        """Process incremental updates for subunits (underenheter)."""
        if since_date is None and start_id is None:
            since_date = date.today() - timedelta(days=1)

        since_iso = since_date.strftime("%Y-%m-%dT%H:%M:%S.000Z") if since_date else ""
        result = UpdateBatchResult(since_date=since_date or date.today(), since_iso=since_iso)

        logger.info(
            "Starting subunit update sync. Date: %s, startId: %s",
            sanitize_log(since_iso),
            sanitize_log(start_id),
        )

        next_url: str | None = (
            f"{BRREG_SUBUNIT_UPDATES_URL}?oppdateringsid={start_id}&size={min(page_size, 10000)}"
            if start_id is not None
            else f"{BRREG_SUBUNIT_UPDATES_URL}?dato={since_iso}&size={min(page_size, 10000)}"
        )

        pages_processed = 0
        async with httpx.AsyncClient(timeout=self.brreg_api.timeout) as http_client:
            while next_url:
                SYNC_BATCH_PAGES_TOTAL.labels(entity_type="subunit").inc()
                with SYNC_LATENCY.labels(entity_type="subunit").time():
                    try:
                        response = await http_client.get(next_url)
                        if response.status_code != 200:
                            logger.error(f"API error {response.status_code} for subunits: {next_url}")
                            break

                        data = response.json()
                        entities = data.get("_embedded", {}).get("oppdaterteUnderenheter", [])

                        # Phase 1: Concurrent fetch subunit details
                        semaphore = asyncio.Semaphore(API_CONCURRENCY_LIMIT)

                        async def fetch_one(
                            entity: dict[str, Any], _semaphore: asyncio.Semaphore = semaphore
                        ) -> dict[str, Any] | None:
                            orgnr = entity.get("organisasjonsnummer")
                            if not orgnr:
                                return None
                            async with _semaphore:
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
                                orgnr = subunit_data.get("organisasjonsnummer")

                                # Handle deleted subunits
                                if not parent_orgnr:
                                    # Brreg omits overordnetEnhet for deleted subunits
                                    is_deleted = (
                                        subunit_data.get("respons_klasse") == "SlettetUnderEnhet"
                                        or subunit_data.get("slettedato") is not None
                                    )

                                    if is_deleted:
                                        if orgnr:
                                            deleted_count = await self.subunit_repo.delete_by_orgnr(orgnr)
                                            if deleted_count:
                                                result.companies_deleted += 1
                                                SYNC_OPERATIONS_TOTAL.labels(
                                                    entity_type="subunit", operation_type="deleted"
                                                ).inc()
                                        continue

                                    logger.warning(
                                        f"Skipping subunit {orgnr} "
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

                                all_subunits.append(map_subunit_from_api(subunit_data, parent_orgnr))
                                result.companies_updated += 1
                                SYNC_OPERATIONS_TOTAL.labels(entity_type="subunit", operation_type="updated").inc()

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
        semaphore = asyncio.Semaphore(API_CONCURRENCY_LIMIT)

        async def fetch_parent(orgnr: str) -> dict[str, Any] | None:
            async with semaphore:
                try:
                    return await self.brreg_api.fetch_company(orgnr)
                except Exception as e:
                    error_msg = f"Failed to fetch missing parent: {e!s}"
                    logger.warning(f"{error_msg} for {orgnr}")
                    await self.report_sync_error(orgnr, "company", error_msg)
                    return None

        # Gather and filter
        tasks = [fetch_parent(orgnr) for orgnr in sorted(missing_orgnrs)]
        results = await asyncio.gather(*tasks)
        valid_parent_data = [r for r in results if r and not r.get("slettedato")]

        # Persist new parents
        count = 0
        for company_data in valid_parent_data:
            try:
                await self.company_repo.create_or_update(company_data)
                count += 1
            except Exception as e:
                logger.error(f"Failed to persist parent company {company_data.get('organisasjonsnummer')}: {e}")
                await self.db.rollback()

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
                SYNC_BATCH_PAGES_TOTAL.labels(entity_type="role").inc()
                with SYNC_LATENCY.labels(entity_type="role").time():
                    try:
                        response = await http_client.get(BRREG_ROLE_UPDATES_URL, params=params)
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
                            except ValueError, TypeError:  # Non-integer event ID — skip tracking
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

                            semaphore = asyncio.Semaphore(API_CONCURRENCY_LIMIT)

                            async def fetch_missing_main_unit(
                                org_no: str, _semaphore: asyncio.Semaphore = semaphore
                            ) -> dict[str, Any] | None:
                                async with _semaphore:
                                    try:
                                        # Use main unit endpoint. Subunits return 404 here.
                                        return await self.brreg_api.fetch_company(org_no)
                                    except Exception as e:
                                        # 404/410 are common for subunits or deleted entities
                                        logger.debug(
                                            f"Orgnr {org_no} is likely a subunit or deleted (404 on enheter): {e}"
                                        )
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

                        # Sort orgnrs to ensure consistent lock acquisition order and prevent deadlocks
                        sorted_orgnrs_to_sync = sorted(orgnrs_to_sync)

                        for orgnr in sorted_orgnrs_to_sync:
                            # Skip companies that still don't exist (couldn't be fetched)
                            if orgnr not in existing_orgnrs:
                                logger.warning(f"Skipping role sync for {orgnr}: company not found in bedrifter table")
                                continue

                            try:
                                # Use Brreg API directly to fetch current roles
                                roles_data = await self.brreg_api.fetch_roles(orgnr)

                                # Ensure any companies mentioned in the roles exist as parents
                                potential_parents = [
                                    {"overordnetEnhet": r.get("enhet_orgnr")}
                                    for r in roles_data
                                    if r.get("enhet_orgnr")
                                ]
                                if potential_parents:
                                    await self._ensure_parent_companies_exist(potential_parents)

                                # Create Role models
                                for r in roles_data:
                                    all_batch_roles.append(map_role_from_api(r, orgnr))
                                result.companies_updated += 1
                                SYNC_OPERATIONS_TOTAL.labels(entity_type="role", operation_type="updated").inc()
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
                            params.pop("afterTime", None)
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
