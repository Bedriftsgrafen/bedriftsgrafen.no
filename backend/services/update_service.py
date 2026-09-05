import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from typing import Any

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
from schemas.brreg import BrregUpdateChange, FetchResult, SubunitFetchResult, UpdateBatchResult
from services.base_external_service import CircuitOpenException, ExternalApiException
from services.brreg_api_service import BrregApiService
from services.brreg_mappers import map_role_from_api, map_subunit_from_api
from utils.logging_config import sanitize_log
from utils.metrics import SYNC_BATCH_PAGES_TOTAL, SYNC_LATENCY, SYNC_OPERATIONS_TOTAL

logger = logging.getLogger(__name__)

DB_COMMIT_CHUNK_SIZE = 100  # Commit every X records for efficiency
UPDATE_PAGE_SIZE = 1000  # Max size allowed by API
BRREG_COMPANY_EVENT_SOURCE = "Enhetsregisteret via Brreg"
BRREG_SUBUNIT_EVENT_SOURCE = "Underenhetsregisteret via Brreg"
BRREG_ROLE_EVENT_SOURCE = "Enhetsregisteret roller via Brreg"
BRREG_UPDATE_TIME_SEMANTICS = "Tidspunkt fra Brregs oppdateringsstrøm når tilgjengelig."
BRREG_COMPANY_CHANGE_EVENT_PATHS: dict[str, tuple[str, ...]] = {
    "name_changed": ("/navn",),
    "address_changed": ("/postadresse", "/forretningsadresse"),
    "industry_changed": (
        "/naeringskode1",
        "/naeringskode2",
        "/naeringskode3",
        "/hjelpeenhetskode",
        "/aktivitet",
    ),
    "status_changed": (
        "/konkurs",
        "/konkursdato",
        "/underAvvikling",
        "/underTvangsavvikling",
        "/underTvangsavviklingEllerTvangsopplosning",
        "/slettedato",
    ),
}
BRREG_SUBUNIT_CHANGE_EVENT_PATHS: dict[str, tuple[str, ...]] = {
    "subunit_address_changed": ("/beliggenhetsadresse", "/postadresse"),
    "subunit_industry_changed": (
        "/naeringskode1",
        "/naeringskode2",
        "/naeringskode3",
        "/hjelpeenhetskode",
        "/aktivitet",
    ),
    "subunit_employee_count_changed": ("/antallAnsatte", "/harRegistrertAntallAnsatte"),
}
BRREG_EMPLOYEE_CHANGE_PATHS = ("/antallAnsatte", "/harRegistrertAntallAnsatte")
FINANCIAL_POLL_RETRY_BASE_SECONDS = 60 * 60
FINANCIAL_POLL_RETRY_JITTER_SECONDS = 30 * 60
FINANCIAL_POLL_QUARANTINE_AFTER_FAILURES = 6
FINANCIAL_POLL_QUARANTINE_SECONDS = 30 * 24 * 60 * 60


class FinancialPollOutcome(StrEnum):
    """Result of one financial poll, including whether it is safe to advance freshness state."""

    COMPLETED = "completed"
    TERMINAL_FAILURE = "terminal_failure"
    RETRY_LATER = "retry_later"
    CIRCUIT_OPEN = "circuit_open"


@dataclass(frozen=True)
class ParentCompanyResolution:
    """Classify parents that can be persisted separately from terminal Brreg absences."""

    verified: frozenset[str]
    terminally_unavailable: frozenset[str]


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
    def _financial_poll_retry_delay(orgnr: str, failure_count: int) -> timedelta:
        """Return exponential backoff followed by durable long-term quarantine."""
        jitter_seconds = sum((index + 1) * ord(char) for index, char in enumerate(orgnr))
        jitter_seconds %= FINANCIAL_POLL_RETRY_JITTER_SECONDS
        if failure_count >= FINANCIAL_POLL_QUARANTINE_AFTER_FAILURES:
            return timedelta(seconds=FINANCIAL_POLL_QUARANTINE_SECONDS + jitter_seconds)

        exponent = max(failure_count - 1, 0)
        exponential_seconds = FINANCIAL_POLL_RETRY_BASE_SECONDS * (2**exponent)
        return timedelta(seconds=exponential_seconds + jitter_seconds)

    async def _defer_financial_poll(self, orgnr: str) -> None:
        current_failure_count = await self.company_repo.get_financial_poll_failure_count_for_update(orgnr)
        failure_count = current_failure_count + 1
        retry_after = datetime.now(UTC) + self._financial_poll_retry_delay(orgnr, failure_count)
        await self.company_repo.defer_financial_poll(orgnr, failure_count, retry_after)
        logger.warning(
            "Deferred financial poll after transient Brreg failure",
            extra={"orgnr": orgnr, "failure_count": failure_count, "retry_after": retry_after.isoformat()},
        )

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

    @staticmethod
    def _source_change_path(change: BrregUpdateChange) -> str | None:
        return change.path

    @classmethod
    def _change_matches_path_prefixes(cls, change: BrregUpdateChange, prefixes: tuple[str, ...]) -> bool:
        path = cls._source_change_path(change)
        if not path:
            return False
        return any(path == prefix or path.startswith(f"{prefix}/") for prefix in prefixes)

    @classmethod
    def _matching_change_paths(cls, changes: list[BrregUpdateChange], prefixes: tuple[str, ...]) -> list[str]:
        paths: list[str] = []
        for change in changes:
            if cls._change_matches_path_prefixes(change, prefixes):
                path = cls._source_change_path(change)
                if path and path not in paths:
                    paths.append(path)
        return paths

    @classmethod
    def _company_update_event_types(cls, changes: list[BrregUpdateChange]) -> list[str]:
        return [
            event_type
            for event_type, prefixes in BRREG_COMPANY_CHANGE_EVENT_PATHS.items()
            if cls._matching_change_paths(changes, prefixes)
        ]

    @classmethod
    def _subunit_update_event_types(cls, changes: list[BrregUpdateChange]) -> list[str]:
        return [
            event_type
            for event_type, prefixes in BRREG_SUBUNIT_CHANGE_EVENT_PATHS.items()
            if cls._matching_change_paths(changes, prefixes)
        ]

    @staticmethod
    def _compact_code_value(value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        compacted = {key: value.get(key) for key in ("kode", "beskrivelse") if value.get(key) is not None}
        return compacted or None

    @staticmethod
    def _date_to_iso(value: Any) -> Any:
        return value.isoformat() if isinstance(value, date) else value

    @staticmethod
    def _parse_oppdateringsid(source_update_id: str | int | None) -> int | None:
        if source_update_id is None:
            return None
        try:
            return int(source_update_id)
        except TypeError, ValueError:
            return None

    @classmethod
    def _mark_latest_oppdateringsid(cls, result: UpdateBatchResult, source_update_id: str | int | None) -> None:
        update_id = cls._parse_oppdateringsid(source_update_id)
        if update_id is None:
            return
        if result.latest_oppdateringsid is None or update_id > result.latest_oppdateringsid:
            result.latest_oppdateringsid = update_id

    @classmethod
    def _publish_contiguous_update_ids(
        cls,
        result: UpdateBatchResult,
        committed_update_ids: list[int],
        failed_update_ids: list[int],
    ) -> None:
        if not committed_update_ids:
            return

        eligible_update_ids = committed_update_ids
        if failed_update_ids:
            first_failed_update_id = min(failed_update_ids)
            eligible_update_ids = [
                update_id for update_id in committed_update_ids if update_id < first_failed_update_id
            ]

        for update_id in eligible_update_ids:
            cls._mark_latest_oppdateringsid(result, update_id)

    @staticmethod
    def _extract_next_link(data: dict[str, Any]) -> str | None:
        links = data.get("_links") or {}
        next_link = links.get("next") or {}
        if not isinstance(next_link, dict):
            return None

        href = next_link.get("href")
        return href if isinstance(href, str) and href else None

    @classmethod
    def _previous_company_event_value(cls, event_type: str, snapshot: dict[str, Any]) -> dict[str, Any]:
        raw_data = snapshot.get("raw_data") or {}

        if event_type == "name_changed":
            return {"navn": snapshot.get("navn")}
        if event_type == "address_changed":
            return {
                "postadresse": snapshot.get("postadresse"),
                "forretningsadresse": snapshot.get("forretningsadresse"),
            }
        if event_type == "industry_changed":
            return {
                "naeringskode1": cls._compact_code_value(raw_data.get("naeringskode1"))
                or {"kode": snapshot.get("naeringskode")},
                "naeringskode2": cls._compact_code_value(raw_data.get("naeringskode2")),
                "naeringskode3": cls._compact_code_value(raw_data.get("naeringskode3")),
                "hjelpeenhetskode": cls._compact_code_value(raw_data.get("hjelpeenhetskode")),
                "aktivitet": raw_data.get("aktivitet"),
            }
        if event_type == "status_changed":
            return {
                "konkurs": snapshot.get("konkurs"),
                "konkursdato": cls._date_to_iso(snapshot.get("konkursdato")),
                "under_avvikling": snapshot.get("under_avvikling"),
                "under_tvangsavvikling": snapshot.get("under_tvangsavvikling"),
            }

        return {}

    @classmethod
    def _new_company_event_value(cls, event_type: str, company_data: dict[str, Any]) -> dict[str, Any]:
        if event_type == "name_changed":
            return {"navn": company_data.get("navn")}
        if event_type == "address_changed":
            return {
                "postadresse": company_data.get("postadresse"),
                "forretningsadresse": company_data.get("forretningsadresse"),
            }
        if event_type == "industry_changed":
            return {
                "naeringskode1": cls._compact_code_value(company_data.get("naeringskode1")),
                "naeringskode2": cls._compact_code_value(company_data.get("naeringskode2")),
                "naeringskode3": cls._compact_code_value(company_data.get("naeringskode3")),
                "hjelpeenhetskode": cls._compact_code_value(company_data.get("hjelpeenhetskode")),
                "aktivitet": company_data.get("aktivitet"),
            }
        if event_type == "status_changed":
            return {
                "konkurs": company_data.get("konkurs", False),
                "konkursdato": company_data.get("konkursdato"),
                "under_avvikling": company_data.get("underAvvikling", False),
                "under_tvangsavvikling": company_data.get(
                    "underTvangsavvikling",
                    company_data.get("underTvangsavviklingEllerTvangsopplosning", False),
                ),
            }

        return {}

    @classmethod
    def _build_brreg_update_payload(
        cls,
        *,
        event_type: str,
        source_change_type: str | None,
        source_changes: list[BrregUpdateChange],
    ) -> dict[str, Any]:
        if event_type in {"employee_count_changed", "subunit_employee_count_changed"}:
            matching_paths = cls._matching_change_paths(source_changes, BRREG_EMPLOYEE_CHANGE_PATHS)
        else:
            matching_paths = cls._matching_change_paths(
                source_changes,
                BRREG_COMPANY_CHANGE_EVENT_PATHS.get(event_type)
                or BRREG_SUBUNIT_CHANGE_EVENT_PATHS.get(event_type, ()),
            )

        payload: dict[str, Any] = {"time_semantics": BRREG_UPDATE_TIME_SEMANTICS}
        if source_change_type:
            payload["source_change_type"] = source_change_type
        if matching_paths:
            payload["brreg_change_paths"] = matching_paths
            payload["brreg_change_count"] = len(source_changes)

        return payload

    @classmethod
    def _previous_subunit_event_value(cls, event_type: str, snapshot: dict[str, Any]) -> dict[str, Any]:
        raw_data = snapshot.get("raw_data") or {}

        if event_type == "subunit_address_changed":
            return {
                "beliggenhetsadresse": snapshot.get("beliggenhetsadresse"),
                "postadresse": snapshot.get("postadresse"),
            }
        if event_type == "subunit_industry_changed":
            return {
                "naeringskode1": cls._compact_code_value(raw_data.get("naeringskode1"))
                or {"kode": snapshot.get("naeringskode")},
                "naeringskode2": cls._compact_code_value(raw_data.get("naeringskode2")),
                "naeringskode3": cls._compact_code_value(raw_data.get("naeringskode3")),
                "hjelpeenhetskode": cls._compact_code_value(raw_data.get("hjelpeenhetskode")),
                "aktivitet": raw_data.get("aktivitet"),
            }
        if event_type == "subunit_employee_count_changed":
            return {"antall_ansatte": snapshot.get("antall_ansatte")}

        return {
            "orgnr": snapshot.get("orgnr"),
            "navn": snapshot.get("navn"),
            "parent_orgnr": snapshot.get("parent_orgnr"),
            "organisasjonsform": snapshot.get("organisasjonsform"),
            "naeringskode": snapshot.get("naeringskode"),
            "antall_ansatte": snapshot.get("antall_ansatte"),
        }

    @classmethod
    def _new_subunit_event_value(
        cls, event_type: str, subunit_data: dict[str, Any], parent_orgnr: str
    ) -> dict[str, Any]:
        if event_type == "subunit_address_changed":
            return {
                "beliggenhetsadresse": subunit_data.get("beliggenhetsadresse"),
                "postadresse": subunit_data.get("postadresse"),
            }
        if event_type == "subunit_industry_changed":
            return {
                "naeringskode1": cls._compact_code_value(subunit_data.get("naeringskode1")),
                "naeringskode2": cls._compact_code_value(subunit_data.get("naeringskode2")),
                "naeringskode3": cls._compact_code_value(subunit_data.get("naeringskode3")),
                "hjelpeenhetskode": cls._compact_code_value(subunit_data.get("hjelpeenhetskode")),
                "aktivitet": subunit_data.get("aktivitet"),
            }
        if event_type == "subunit_employee_count_changed":
            return {"antall_ansatte": subunit_data.get("antallAnsatte")}

        organisasjonsform = subunit_data.get("organisasjonsform")
        return {
            "orgnr": subunit_data.get("organisasjonsnummer"),
            "navn": subunit_data.get("navn"),
            "parent_orgnr": parent_orgnr,
            "organisasjonsform": organisasjonsform.get("kode") if isinstance(organisasjonsform, dict) else None,
            "naeringskode1": cls._compact_code_value(subunit_data.get("naeringskode1")),
            "antall_ansatte": subunit_data.get("antallAnsatte"),
        }

    def _build_subunit_event_payload(
        self,
        *,
        event_type: str,
        fetch_result: SubunitFetchResult,
        parent_orgnr: str | None,
    ) -> dict[str, Any]:
        payload = self._build_brreg_update_payload(
            event_type=event_type,
            source_change_type=fetch_result.source_change_type,
            source_changes=fetch_result.source_changes,
        )
        if parent_orgnr:
            payload["parent_orgnr"] = parent_orgnr
        payload["entity_type"] = "subunit"
        return payload

    @staticmethod
    def _role_event_sort_key(event: dict[str, Any]) -> tuple[int, str]:
        event_id = str(event.get("id") or "")
        try:
            return int(event_id), event_id
        except ValueError:
            return -1, event_id

    @classmethod
    def _latest_role_events_by_orgnr(cls, events: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        latest_by_orgnr: dict[str, dict[str, Any]] = {}

        for event in events:
            orgnr = event.get("data", {}).get("organisasjonsnummer")
            if not orgnr:
                continue

            current = latest_by_orgnr.get(orgnr)
            if current is None or cls._role_event_sort_key(event) > cls._role_event_sort_key(current):
                latest_by_orgnr[orgnr] = event

        return latest_by_orgnr

    async def _record_roles_changed_event(
        self,
        *,
        orgnr: str,
        source_event: dict[str, Any] | None,
        role_count: int,
    ) -> None:
        if source_event is None:
            return

        source_update_id = str(source_event.get("id")) if source_event.get("id") is not None else None
        payload = {
            "entity_type": "role_update",
            "time_semantics": "Tidspunkt fra Brregs rolleoppdateringsstrøm når tilgjengelig.",
        }
        for source_key, payload_key in (
            ("type", "cloud_event_type"),
            ("source", "cloud_event_source"),
            ("subject", "cloud_event_subject"),
        ):
            if source_event.get(source_key):
                payload[payload_key] = source_event[source_key]

        await self._record_company_event_safe(
            orgnr=orgnr,
            event_type="roles_changed",
            source=BRREG_ROLE_EVENT_SOURCE,
            source_update_id=source_update_id,
            occurred_at=self._parse_brreg_datetime(source_event.get("time")),
            new_value={"role_count": role_count},
            payload=payload,
        )

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

    async def _persist_sync_error_reports(
        self,
        reports: list[tuple[str, str, str, int | None]],
    ) -> None:
        """Persist retry records after the caller's data transaction is settled."""
        if not reports:
            return

        try:
            for orgnr, entity_type, error_message, status_code in reports:
                await self.report_sync_error(
                    orgnr=orgnr,
                    entity_type=entity_type,
                    error_message=error_message,
                    status_code=status_code,
                )
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            logger.exception("Failed to persist sync error reports")

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
        self.brreg_api._record_brreg_logical_operation("updates_company")
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
            f"{BRREG_UPDATES_URL}?oppdateringsid={start_id}&includeChanges=true&size={min(page_size, 10000)}"
            if start_id is not None
            else f"{BRREG_UPDATES_URL}?dato={since_iso}&includeChanges=true&size={min(page_size, 10000)}"
        )

        while next_url:
            try:
                page_result = await self._process_single_page(
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
        url: str,
        page_size: int,
        result: UpdateBatchResult,
    ) -> str | None:
        """Process a single page of updates."""
        SYNC_BATCH_PAGES_TOTAL.labels(entity_type="company").inc()
        with SYNC_LATENCY.labels(entity_type="company").time():
            logger.info(f"Fetching updates page {result.pages_fetched + 1}...")

            response = await self.brreg_api._get(url, context="updates_company")

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
            cursor_gap_detected = await self._persist_chunk(fetch_results, result)

            # Metadata tracking
            result.pages_fetched += 1

            if cursor_gap_detected:
                logger.warning("Stopping company update pagination at the first uncommitted update ID")
                return None

            return self._extract_next_link(data)

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
            source_changes = [BrregUpdateChange.model_validate(change) for change in entity.get("endringer") or []]

            # Validate orgnr format before making API calls
            if not orgnr or len(orgnr) != 9 or not orgnr.isdigit():
                return FetchResult(
                    orgnr=orgnr,
                    success=False,
                    error=f"Invalid orgnr format: {orgnr}",
                    source_update_id=source_update_id,
                    source_event_time=source_event_time,
                    source_change_type=endringstype,
                    source_changes=source_changes,
                )

            # Mark deletions/removals for processing in _persist_chunk
            if endringstype in {"Sletting", "Fjernet"}:
                return FetchResult(
                    orgnr=orgnr,
                    success=True,
                    company_data=None,  # None signals deletion/removal to _persist_chunk
                    source_update_id=source_update_id,
                    source_event_time=source_event_time,
                    source_change_type=endringstype,
                    source_changes=source_changes,
                )

            async with semaphore:
                try:
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
                        source_changes=source_changes,
                    )
                except Exception as exc:
                    return FetchResult(
                        orgnr=orgnr,
                        success=False,
                        error=str(exc),
                        source_update_id=source_update_id,
                        source_event_time=source_event_time,
                        source_change_type=endringstype,
                        source_changes=source_changes,
                    )

        tasks = [fetch_single(entity) for entity in entities]
        return list(await asyncio.gather(*tasks))

    async def _persist_chunk(
        self,
        fetch_results: list[FetchResult],
        result: UpdateBatchResult,
    ) -> bool:
        """Persist a chunk of fetched data to the database.

        This is Phase 2 - sequential database operations with proper transactions.
        Uses chunk-based commits (every DB_COMMIT_CHUNK_SIZE records) for efficiency.

        Args:
            fetch_results: Results from the fetch phase
            result: Aggregate result tracker to update
        """
        records_since_commit = 0
        pending_update_ids: list[int] = []
        committed_update_ids: list[int] = []
        failed_update_ids: list[int] = []
        sync_error_reports: list[tuple[str, str, str, int | None]] = []
        cursor_gap_detected = False
        cursor_gap_without_id = False

        def remember_committed_update_ids() -> None:
            committed_update_ids.extend(pending_update_ids)
            pending_update_ids.clear()

        def remember_failed_update_id(source_update_id: str | int | None) -> None:
            nonlocal cursor_gap_detected, cursor_gap_without_id
            cursor_gap_detected = True
            result.cursor_gap_detected = True
            update_id = self._parse_oppdateringsid(source_update_id)
            if update_id is None:
                cursor_gap_without_id = True
            else:
                failed_update_ids.append(update_id)

        sorted_results = sorted(fetch_results, key=lambda item: item.orgnr)
        existing_company_snapshots = await self._get_existing_company_event_snapshots(
            [item.orgnr for item in sorted_results if item.success and item.company_data is not None]
        )

        for fetch_result in sorted_results:
            result.companies_processed += 1

            if not fetch_result.success:
                remember_failed_update_id(fetch_result.source_update_id)
                if "Skipped" in (fetch_result.error or ""):
                    result.companies_skipped += 1
                else:
                    result.api_errors += 1
                    if fetch_result.error and "Invalid" not in fetch_result.error:
                        result.errors.append(f"{fetch_result.orgnr}: {fetch_result.error}")
                        sync_error_reports.append((fetch_result.orgnr, "company", fetch_result.error, None))
                continue

            try:
                # Handle deleted companies (None returned from API)
                if fetch_result.company_data is None:
                    deleted_count = await self.company_repo.delete_by_orgnr(fetch_result.orgnr)
                    if deleted_count:
                        event_type = (
                            "company_removed_from_open_data"
                            if fetch_result.source_change_type == "Fjernet"
                            else "company_deleted"
                        )
                        await self._record_company_event_safe(
                            orgnr=fetch_result.orgnr,
                            event_type=event_type,
                            source=BRREG_COMPANY_EVENT_SOURCE,
                            source_update_id=fetch_result.source_update_id,
                            occurred_at=fetch_result.source_event_time,
                            payload=self._build_brreg_update_payload(
                                event_type=event_type,
                                source_change_type=fetch_result.source_change_type,
                                source_changes=fetch_result.source_changes,
                            ),
                        )
                        result.companies_deleted += 1
                        SYNC_OPERATIONS_TOTAL.labels(entity_type="company", operation_type="deleted").inc()
                    update_id = self._parse_oppdateringsid(fetch_result.source_update_id)
                    if update_id is not None:
                        pending_update_ids.append(update_id)
                    records_since_commit += 1
                    if records_since_commit >= DB_COMMIT_CHUNK_SIZE:
                        await self.db.commit()
                        remember_committed_update_ids()
                        records_since_commit = 0
                        logger.debug(f"Committed chunk of {DB_COMMIT_CHUNK_SIZE} records")
                    continue

                previous_snapshot = existing_company_snapshots.get(fetch_result.orgnr)
                previous_employee_count = previous_snapshot.get("antall_ansatte") if previous_snapshot else None
                new_employee_count = fetch_result.company_data.get("antallAnsatte")

                # Persist company data
                company = await self.company_repo.create_or_update(fetch_result.company_data)

                # Check if this is a new company (never polled for financials)
                is_new = company.last_polled_regnskap is None

                if fetch_result.source_change_type == "Ny":
                    await self._record_company_event_safe(
                        orgnr=fetch_result.orgnr,
                        event_type="company_registered",
                        source=BRREG_COMPANY_EVENT_SOURCE,
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

                    await self._record_company_update_events_from_changes(fetch_result, previous_snapshot)

                    if (
                        previous_employee_count is not None
                        and new_employee_count is not None
                        and previous_employee_count != new_employee_count
                    ):
                        await self._record_company_event_safe(
                            orgnr=fetch_result.orgnr,
                            event_type="employee_count_changed",
                            source=BRREG_COMPANY_EVENT_SOURCE,
                            source_update_id=fetch_result.source_update_id,
                            occurred_at=fetch_result.source_event_time,
                            previous_value={"antall_ansatte": previous_employee_count},
                            new_value={"antall_ansatte": new_employee_count},
                            payload=self._build_brreg_update_payload(
                                event_type="employee_count_changed",
                                source_change_type=fetch_result.source_change_type,
                                source_changes=fetch_result.source_changes,
                            ),
                        )

                records_since_commit += 1
                update_id = self._parse_oppdateringsid(fetch_result.source_update_id)
                if update_id is not None:
                    pending_update_ids.append(update_id)

                # Commit in chunks for efficiency (reduces transaction overhead)
                if records_since_commit >= DB_COMMIT_CHUNK_SIZE:
                    await self.db.commit()
                    remember_committed_update_ids()
                    records_since_commit = 0
                    logger.debug(f"Committed chunk of {DB_COMMIT_CHUNK_SIZE} records")

            except Exception as e:
                # The rollback discards every uncommitted item in this chunk, not
                # only the item that raised. They must all become cursor barriers.
                cursor_gap_detected = True
                failed_update_ids.extend(pending_update_ids)
                remember_failed_update_id(fetch_result.source_update_id)
                result.db_errors += 1
                result.errors.append(f"DB error {fetch_result.orgnr}: {e!s}")
                logger.error(f"Database error persisting {fetch_result.orgnr}: {e}")
                # Rollback the failed transaction
                await self.db.rollback()
                pending_update_ids.clear()
                records_since_commit = 0  # Reset counter after rollback

        # Final commit for remaining records
        if records_since_commit > 0:
            await self.db.commit()
            remember_committed_update_ids()
            logger.debug(f"Committed final chunk of {records_since_commit} records")

        if not cursor_gap_without_id:
            self._publish_contiguous_update_ids(result, committed_update_ids, failed_update_ids)
        await self._persist_sync_error_reports(sync_error_reports)
        return cursor_gap_detected

    async def _get_existing_company_event_snapshots(self, orgnrs: list[str]) -> dict[str, dict[str, Any]]:
        if not orgnrs:
            return {}

        result = await self.db.execute(
            select(
                models.Company.orgnr,
                models.Company.navn,
                models.Company.naeringskode,
                models.Company.antall_ansatte,
                models.Company.postadresse,
                models.Company.forretningsadresse,
                models.Company.konkurs,
                models.Company.konkursdato,
                models.Company.under_avvikling,
                models.Company.under_tvangsavvikling,
                models.Company.raw_data.label("raw_data"),
            ).where(models.Company.orgnr.in_(orgnrs))
        )
        return {row["orgnr"]: dict(row) for row in result.mappings().all()}

    async def _record_company_update_events_from_changes(
        self,
        fetch_result: FetchResult,
        previous_snapshot: dict[str, Any] | None,
    ) -> None:
        if previous_snapshot is None or fetch_result.company_data is None:
            return

        for event_type in self._company_update_event_types(fetch_result.source_changes):
            previous_value = self._previous_company_event_value(event_type, previous_snapshot)
            new_value = self._new_company_event_value(event_type, fetch_result.company_data)
            if previous_value == new_value:
                continue

            await self._record_company_event_safe(
                orgnr=fetch_result.orgnr,
                event_type=event_type,
                source=BRREG_COMPANY_EVENT_SOURCE,
                source_update_id=fetch_result.source_update_id,
                occurred_at=fetch_result.source_event_time,
                previous_value=previous_value,
                new_value=new_value,
                payload=self._build_brreg_update_payload(
                    event_type=event_type,
                    source_change_type=fetch_result.source_change_type,
                    source_changes=fetch_result.source_changes,
                ),
            )

    async def _fetch_subunit_update_details(self, entities: list[dict[str, Any]]) -> list[SubunitFetchResult]:
        semaphore = asyncio.Semaphore(API_CONCURRENCY_LIMIT)

        async def fetch_one(entity: dict[str, Any], _semaphore: asyncio.Semaphore = semaphore) -> SubunitFetchResult:
            orgnr = entity.get("organisasjonsnummer") or "unknown"
            source_update_id = str(entity["oppdateringsid"]) if entity.get("oppdateringsid") is not None else None
            source_event_time = self._parse_brreg_datetime(entity.get("dato"))
            source_change_type = entity.get("endringstype")
            source_changes = [BrregUpdateChange.model_validate(change) for change in entity.get("endringer") or []]

            if orgnr == "unknown":
                return SubunitFetchResult(
                    orgnr=orgnr,
                    success=False,
                    error="Missing subunit orgnr",
                    source_update_id=source_update_id,
                    source_event_time=source_event_time,
                    source_change_type=source_change_type,
                    source_changes=source_changes,
                )

            if source_change_type in {"Sletting", "Fjernet"}:
                return SubunitFetchResult(
                    orgnr=orgnr,
                    success=True,
                    subunit_data=None,
                    source_update_id=source_update_id,
                    source_event_time=source_event_time,
                    source_change_type=source_change_type,
                    source_changes=source_changes,
                )

            async with _semaphore:
                try:
                    subunit_data = await self.brreg_api.fetch_subunit(orgnr)
                    if subunit_data is None:
                        return SubunitFetchResult(
                            orgnr=orgnr,
                            success=True,
                            subunit_data=None,
                            source_update_id=source_update_id,
                            source_event_time=source_event_time,
                            source_change_type=source_change_type,
                            source_changes=source_changes,
                        )
                    return SubunitFetchResult(
                        orgnr=orgnr,
                        success=True,
                        subunit_data=subunit_data,
                        source_update_id=source_update_id,
                        source_event_time=source_event_time,
                        source_change_type=source_change_type,
                        source_changes=source_changes,
                    )
                except Exception as ex:
                    logger.warning(f"Failed to fetch subunit details for {orgnr}: {ex}", extra={"orgnr": orgnr})
                    return SubunitFetchResult(
                        orgnr=orgnr,
                        success=False,
                        error=str(ex),
                        source_update_id=source_update_id,
                        source_event_time=source_event_time,
                        source_change_type=source_change_type,
                        source_changes=source_changes,
                    )

        tasks = [fetch_one(entity) for entity in entities]
        return list(await asyncio.gather(*tasks))

    async def _get_existing_subunit_event_snapshots(self, orgnrs: list[str]) -> dict[str, dict[str, Any]]:
        if not orgnrs:
            return {}

        result = await self.db.execute(
            select(
                models.SubUnit.orgnr,
                models.SubUnit.parent_orgnr,
                models.SubUnit.navn,
                models.SubUnit.organisasjonsform,
                models.SubUnit.naeringskode,
                models.SubUnit.antall_ansatte,
                models.SubUnit.beliggenhetsadresse,
                models.SubUnit.postadresse,
                models.SubUnit.registreringsdato_enhetsregisteret,
                models.SubUnit.raw_data.label("raw_data"),
            ).where(models.SubUnit.orgnr.in_(orgnrs))
        )
        return {row["orgnr"]: dict(row) for row in result.mappings().all()}

    async def _record_subunit_opened_event(
        self,
        fetch_result: SubunitFetchResult,
        parent_orgnr: str,
    ) -> None:
        if fetch_result.subunit_data is None:
            return

        await self._record_company_event_safe(
            orgnr=fetch_result.orgnr,
            event_type="subunit_opened",
            source=BRREG_SUBUNIT_EVENT_SOURCE,
            source_update_id=fetch_result.source_update_id,
            occurred_at=self._parse_brreg_date_as_datetime(
                fetch_result.subunit_data.get("registreringsdatoEnhetsregisteret")
            )
            or fetch_result.source_event_time,
            new_value=self._new_subunit_event_value("subunit_opened", fetch_result.subunit_data, parent_orgnr),
            payload=self._build_subunit_event_payload(
                event_type="subunit_opened",
                fetch_result=fetch_result,
                parent_orgnr=parent_orgnr,
            ),
        )

    async def _record_subunit_update_events_from_changes(
        self,
        fetch_result: SubunitFetchResult,
        previous_snapshot: dict[str, Any] | None,
        parent_orgnr: str,
    ) -> None:
        if previous_snapshot is None or fetch_result.subunit_data is None:
            return

        event_types = self._subunit_update_event_types(fetch_result.source_changes)
        previous_employee_count = previous_snapshot.get("antall_ansatte")
        new_employee_count = fetch_result.subunit_data.get("antallAnsatte")
        if (
            previous_employee_count is not None
            and new_employee_count is not None
            and previous_employee_count != new_employee_count
            and "subunit_employee_count_changed" not in event_types
        ):
            event_types.append("subunit_employee_count_changed")

        for event_type in event_types:
            previous_value = self._previous_subunit_event_value(event_type, previous_snapshot)
            new_value = self._new_subunit_event_value(event_type, fetch_result.subunit_data, parent_orgnr)
            if previous_value == new_value:
                continue

            await self._record_company_event_safe(
                orgnr=fetch_result.orgnr,
                event_type=event_type,
                source=BRREG_SUBUNIT_EVENT_SOURCE,
                source_update_id=fetch_result.source_update_id,
                occurred_at=fetch_result.source_event_time,
                previous_value=previous_value,
                new_value=new_value,
                payload=self._build_subunit_event_payload(
                    event_type=event_type,
                    fetch_result=fetch_result,
                    parent_orgnr=parent_orgnr,
                ),
            )

    async def _delete_subunit_from_update(
        self,
        fetch_result: SubunitFetchResult,
        previous_snapshot: dict[str, Any] | None,
        result: UpdateBatchResult,
    ) -> None:
        deleted_count = await self.subunit_repo.delete_by_orgnr(fetch_result.orgnr)
        if not deleted_count:
            return

        subunit_data = fetch_result.subunit_data or {}
        parent_orgnr = subunit_data.get("overordnetEnhet") or (previous_snapshot or {}).get("parent_orgnr")
        await self._record_company_event_safe(
            orgnr=fetch_result.orgnr,
            event_type="subunit_closed",
            source=BRREG_SUBUNIT_EVENT_SOURCE,
            source_update_id=fetch_result.source_update_id,
            occurred_at=self._parse_brreg_date_as_datetime(subunit_data.get("slettedato"))
            or fetch_result.source_event_time,
            previous_value=self._previous_subunit_event_value("subunit_closed", previous_snapshot)
            if previous_snapshot
            else None,
            new_value={"slettedato": subunit_data.get("slettedato")} if subunit_data.get("slettedato") else None,
            payload=self._build_subunit_event_payload(
                event_type="subunit_closed",
                fetch_result=fetch_result,
                parent_orgnr=str(parent_orgnr) if parent_orgnr else None,
            ),
        )
        result.companies_deleted += 1
        SYNC_OPERATIONS_TOTAL.labels(entity_type="subunit", operation_type="deleted").inc()

    async def _persist_subunit_update_page(
        self,
        fetch_results: list[SubunitFetchResult],
        result: UpdateBatchResult,
    ) -> bool:
        sorted_results = sorted(fetch_results, key=lambda item: item.orgnr)
        committed_update_ids: list[int] = []
        failed_update_ids: list[int] = []
        cursor_gap_detected = False
        cursor_gap_without_id = False

        def remember_failed_update_id(source_update_id: str | int | None) -> None:
            nonlocal cursor_gap_detected, cursor_gap_without_id
            cursor_gap_detected = True
            result.cursor_gap_detected = True
            update_id = self._parse_oppdateringsid(source_update_id)
            if update_id is None:
                cursor_gap_without_id = True
            else:
                failed_update_ids.append(update_id)

        def publish_safe_update_ids() -> None:
            if not cursor_gap_without_id:
                self._publish_contiguous_update_ids(result, committed_update_ids, failed_update_ids)

        existing_subunit_snapshots = (
            await self._get_existing_subunit_event_snapshots([item.orgnr for item in sorted_results if item.success])
            if self.event_ledger_enabled
            else {}
        )
        persist_candidates: list[tuple[SubunitFetchResult, dict[str, Any], str, dict[str, Any] | None]] = []

        for fetch_result in sorted_results:
            if not fetch_result.success:
                remember_failed_update_id(fetch_result.source_update_id)
                result.api_errors += 1
                if fetch_result.error:
                    result.errors.append(f"{fetch_result.orgnr}: {fetch_result.error}")
                continue

            previous_snapshot = existing_subunit_snapshots.get(fetch_result.orgnr)
            subunit_data = fetch_result.subunit_data
            if subunit_data is None:
                try:
                    await self._delete_subunit_from_update(fetch_result, previous_snapshot, result)
                except Exception as e:
                    remember_failed_update_id(fetch_result.source_update_id)
                    result.db_errors += 1
                    result.errors.append(f"DB error {fetch_result.orgnr}: {e!s}")
                    logger.error("Database error deleting subunit %s: %s", fetch_result.orgnr, e)
                    continue
                update_id = self._parse_oppdateringsid(fetch_result.source_update_id)
                if update_id is not None:
                    committed_update_ids.append(update_id)
                continue

            parent_orgnr = subunit_data.get("overordnetEnhet")
            orgnr = subunit_data.get("organisasjonsnummer")

            if not parent_orgnr:
                is_deleted = (
                    subunit_data.get("respons_klasse") == "SlettetUnderEnhet"
                    or subunit_data.get("slettedato") is not None
                )
                if is_deleted:
                    try:
                        await self._delete_subunit_from_update(fetch_result, previous_snapshot, result)
                    except Exception as e:
                        remember_failed_update_id(fetch_result.source_update_id)
                        result.db_errors += 1
                        result.errors.append(f"DB error {fetch_result.orgnr}: {e!s}")
                        logger.error("Database error deleting subunit %s: %s", fetch_result.orgnr, e)
                        continue
                    update_id = self._parse_oppdateringsid(fetch_result.source_update_id)
                    if update_id is not None:
                        committed_update_ids.append(update_id)
                    continue

                logger.warning(f"Skipping subunit {orgnr} because it has no parent_orgnr (overordnetEnhet is missing).")
                remember_failed_update_id(fetch_result.source_update_id)
                continue

            parent_orgnr = str(parent_orgnr)
            persist_candidates.append((fetch_result, subunit_data, parent_orgnr, previous_snapshot))

        if not persist_candidates:
            publish_safe_update_ids()
            return cursor_gap_detected

        parent_resolution = await self._ensure_parent_companies_exist(
            [candidate[1] for candidate in persist_candidates]
        )
        subunits_to_save: list[models.SubUnit] = []
        event_candidates: list[tuple[SubunitFetchResult, str, dict[str, Any] | None]] = []

        for fetch_result, subunit_data, parent_orgnr, previous_snapshot in persist_candidates:
            if parent_orgnr not in parent_resolution.verified:
                if parent_orgnr in parent_resolution.terminally_unavailable:
                    logger.warning(
                        "Skipping subunit %s because parent %s is deleted or unavailable in Brreg",
                        subunit_data.get("organisasjonsnummer"),
                        parent_orgnr,
                    )
                    update_id = self._parse_oppdateringsid(fetch_result.source_update_id)
                    if update_id is not None:
                        committed_update_ids.append(update_id)
                    result.companies_skipped += 1
                    SYNC_OPERATIONS_TOTAL.labels(entity_type="subunit", operation_type="skipped").inc()
                    continue

                logger.warning(
                    f"Skipping subunit {subunit_data.get('organisasjonsnummer')} "
                    f"because parent {parent_orgnr} is missing and could not be fetched."
                )
                remember_failed_update_id(fetch_result.source_update_id)
                continue

            subunits_to_save.append(map_subunit_from_api(subunit_data, parent_orgnr))
            event_candidates.append((fetch_result, parent_orgnr, previous_snapshot))

        if not subunits_to_save:
            publish_safe_update_ids()
            return cursor_gap_detected

        saved_count = await self.subunit_repo.create_batch(subunits_to_save, commit=True)
        if not saved_count:
            for fetch_result, _, _ in event_candidates:
                remember_failed_update_id(fetch_result.source_update_id)
            publish_safe_update_ids()
            return cursor_gap_detected

        for fetch_result, parent_orgnr, previous_snapshot in event_candidates:
            update_id = self._parse_oppdateringsid(fetch_result.source_update_id)
            if update_id is not None:
                committed_update_ids.append(update_id)
            result.companies_updated += 1
            SYNC_OPERATIONS_TOTAL.labels(entity_type="subunit", operation_type="updated").inc()

            if fetch_result.source_change_type == "Ny" and previous_snapshot is None:
                await self._record_subunit_opened_event(fetch_result, parent_orgnr)
            else:
                await self._record_subunit_update_events_from_changes(fetch_result, previous_snapshot, parent_orgnr)

        publish_safe_update_ids()
        return cursor_gap_detected

    async def _fetch_and_persist_financials(
        self,
        orgnr: str,
        result: UpdateBatchResult,
    ) -> FinancialPollOutcome:
        """Fetch and persist financial statements for a company.

        Advance last_polled_regnskap only after a valid upstream response or a
        non-retryable client error. Transient failures must remain eligible for retry.
        """
        outcome = FinancialPollOutcome.COMPLETED
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
            if isinstance(e, CircuitOpenException):
                return FinancialPollOutcome.CIRCUIT_OPEN
            if not isinstance(e, ExternalApiException) or e.status_code is None or e.status_code == 429:
                await self._defer_financial_poll(orgnr)
                return FinancialPollOutcome.RETRY_LATER
            if e.status_code >= 500:
                await self._defer_financial_poll(orgnr)
                return FinancialPollOutcome.RETRY_LATER
            outcome = FinancialPollOutcome.TERMINAL_FAILURE

        await self.company_repo.update_last_polled_regnskap(orgnr)
        return outcome

    async def fetch_subunit_updates(
        self,
        since_date: date | None = None,
        page_size: int = 100,
        start_id: int | None = None,
    ) -> dict[str, Any]:
        """Process incremental updates for subunits (underenheter)."""
        self.brreg_api._record_brreg_logical_operation("updates_subunit")
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
            f"{BRREG_SUBUNIT_UPDATES_URL}?oppdateringsid={start_id}&includeChanges=true&size={min(page_size, 10000)}"
            if start_id is not None
            else f"{BRREG_SUBUNIT_UPDATES_URL}?dato={since_iso}&includeChanges=true&size={min(page_size, 10000)}"
        )

        pages_processed = 0
        while next_url:
            SYNC_BATCH_PAGES_TOTAL.labels(entity_type="subunit").inc()
            with SYNC_LATENCY.labels(entity_type="subunit").time():
                try:
                    response = await self.brreg_api._get(next_url, context="updates_subunit")
                    if response.status_code != 200:
                        logger.error(f"API error {response.status_code} for subunits: {next_url}")
                        break

                    data = response.json()
                    entities = data.get("_embedded", {}).get("oppdaterteUnderenheter", [])

                    fetch_results = await self._fetch_subunit_update_details(entities)
                    cursor_gap_detected = await self._persist_subunit_update_page(fetch_results, result)

                    result.companies_processed += len(entities)
                    result.pages_fetched += 1
                    pages_processed += 1
                    logger.info(
                        f"Processed page {pages_processed} with {len(entities)} subunit updates",
                        extra={"batch_size": len(entities)},
                    )
                    if cursor_gap_detected:
                        logger.warning("Stopping subunit update pagination at the first uncommitted update ID")
                        break
                    next_url = self._extract_next_link(data)

                except Exception as e:
                    logger.exception(f"Error in subunit updates: {e}")
                    # Rollback any partial transaction to allow recovery
                    await self.db.rollback()
                    break

        return result.model_dump()

    async def _ensure_parent_companies_exist(self, subunits_data: list[dict[str, Any]]) -> ParentCompanyResolution:
        """Ensure all parent companies for a batch of subunits exist in the database.

        Fetches missing parents from Brreg API if necessary.
        Returns verified parents and definitive Brreg 404/410/deleted parents separately.
        """
        # Collect unique parent orgnrs
        parent_orgnrs: set[str] = {str(s["overordnetEnhet"]) for s in subunits_data if s.get("overordnetEnhet")}
        if not parent_orgnrs:
            return ParentCompanyResolution(frozenset(), frozenset())

        # Check which parents already exist
        existing_orgnrs = await self.company_repo.get_existing_orgnrs(list(parent_orgnrs))
        missing_orgnrs = parent_orgnrs - existing_orgnrs

        if not missing_orgnrs:
            return ParentCompanyResolution(frozenset(existing_orgnrs), frozenset())

        logger.info(f"Found {len(missing_orgnrs)} missing parent companies. Fetching from Brreg...")

        # Concurrent fetch missing parents
        semaphore = asyncio.Semaphore(API_CONCURRENCY_LIMIT)

        async def fetch_parent(orgnr: str) -> dict[str, Any] | None:
            async with semaphore:
                return await self.brreg_api.fetch_company(orgnr)

        # Gather and filter
        sorted_missing_orgnrs = sorted(missing_orgnrs)
        tasks = [fetch_parent(orgnr) for orgnr in sorted_missing_orgnrs]
        results = await asyncio.gather(*tasks)
        fetched_parents = dict(zip(sorted_missing_orgnrs, results, strict=True))
        terminally_unavailable = {
            orgnr
            for orgnr, parent_data in fetched_parents.items()
            if parent_data is None or parent_data.get("slettedato")
        }
        valid_parent_data = [
            parent_data
            for parent_data in fetched_parents.values()
            if parent_data is not None and not parent_data.get("slettedato")
        ]

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
        verified = await self.company_repo.get_existing_orgnrs(list(parent_orgnrs))
        return ParentCompanyResolution(frozenset(verified), frozenset(terminally_unavailable))

    async def fetch_role_updates(
        self,
        since_date: date | None = None,
        after_id: int | None = None,
        page_size: int = 100,
    ) -> dict[str, Any]:
        """Fetch and process ALL role updates using CloudEvents batches."""
        self.brreg_api._record_brreg_logical_operation("updates_role")
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

        while True:
            SYNC_BATCH_PAGES_TOTAL.labels(entity_type="role").inc()
            with SYNC_LATENCY.labels(entity_type="role").time():
                try:
                    response = await self.brreg_api._get(
                        BRREG_ROLE_UPDATES_URL,
                        params=params,
                        context="updates_role",
                    )
                    if response.status_code != 200:
                        logger.error(f"API error {response.status_code} for roles: {response.text}")
                        break

                    events = response.json()
                    if not events or not isinstance(events, list):
                        break

                    logger.info(f"Processing batch of {len(events)} role updates...")

                    # Extract unique orgnrs from the event batch
                    orgnrs_to_sync = set()
                    event_update_ids_by_orgnr: dict[str, list[int]] = {}
                    committed_update_ids: list[int] = []
                    failed_update_ids: list[int] = []
                    latest_role_events_by_orgnr = self._latest_role_events_by_orgnr(events)
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
                            if orgnr:
                                event_update_ids_by_orgnr.setdefault(orgnr, []).append(current_id)
                            else:
                                committed_update_ids.append(current_id)
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
                    onboarding_failed_orgnrs: set[str] = set()

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
                                # fetch_company returns None only for a confirmed 404/410.
                                return await self.brreg_api.fetch_company(org_no)

                        fetch_tasks = [fetch_missing_main_unit(o) for o in unknown_list]
                        fetched_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

                        new_companies_onboarded = 0
                        for target_orgnr, company_data in zip(unknown_list, fetched_results, strict=True):
                            if isinstance(company_data, BaseException):
                                if isinstance(company_data, asyncio.CancelledError):
                                    raise company_data
                                onboarding_failed_orgnrs.add(target_orgnr)
                                failed_update_ids.extend(event_update_ids_by_orgnr.get(target_orgnr, []))
                                error_msg = f"Failed to onboard company during role sync: {company_data!s}"
                                logger.error("%s for %s", error_msg, target_orgnr)
                                status_code = getattr(company_data, "status_code", None)
                                await self.report_sync_error(
                                    target_orgnr,
                                    "company",
                                    error_msg,
                                    status_code=status_code,
                                )
                                continue

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
                                    await self.db.commit()
                                    existing_orgnrs.add(target_orgnr)
                                    new_companies_onboarded += 1
                                except Exception as e:
                                    await self.db.rollback()
                                    onboarding_failed_orgnrs.add(target_orgnr)
                                    failed_update_ids.extend(event_update_ids_by_orgnr.get(target_orgnr, []))
                                    error_msg = f"Failed to persist onboarded company: {e!s}"
                                    logger.error("%s for %s", error_msg, target_orgnr)
                                    await self.report_sync_error(target_orgnr, "company", error_msg)
                            else:
                                # Mark as failed/subunit to avoid redundant API calls in this execution
                                failed_this_run.add(target_orgnr)

                        if onboarding_failed_orgnrs:
                            # Persist retry records even when every item in the
                            # batch failed before the role transaction starts.
                            await self.db.commit()

                        if new_companies_onboarded > 0:
                            logger.info(
                                f"Successfully onboarded {new_companies_onboarded} missing main companies during role sync."
                            )

                    # Phase 1: Collect all roles for companies that exist in the database
                    all_batch_roles: list[models.Role] = []
                    role_counts_by_orgnr: dict[str, int] = {}
                    processed_orgnrs: set[str] = set()
                    role_sync_error_reports: list[tuple[str, str, str, int | None]] = []

                    # Sort orgnrs to ensure consistent lock acquisition order and prevent deadlocks
                    sorted_orgnrs_to_sync = sorted(orgnrs_to_sync)

                    for orgnr in sorted_orgnrs_to_sync:
                        if orgnr in onboarding_failed_orgnrs:
                            continue

                        # Skip companies that still don't exist (couldn't be fetched)
                        if orgnr not in existing_orgnrs:
                            logger.warning(f"Skipping role sync for {orgnr}: company not found in bedrifter table")
                            committed_update_ids.extend(event_update_ids_by_orgnr.get(orgnr, []))
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
                                all_batch_roles.append(map_role_from_api(r, orgnr))
                            role_counts_by_orgnr[orgnr] = len(roles_data)
                            result.companies_updated += 1
                            SYNC_OPERATIONS_TOTAL.labels(entity_type="role", operation_type="updated").inc()
                            processed_orgnrs.add(orgnr)
                            committed_update_ids.extend(event_update_ids_by_orgnr.get(orgnr, []))

                        except Exception as e:
                            failed_update_ids.extend(event_update_ids_by_orgnr.get(orgnr, []))
                            error_msg = f"Failed to sync roles: {e!s}"
                            logger.error(f"{error_msg} for {orgnr}")
                            status_code = getattr(e, "status_code", None) if hasattr(e, "status_code") else None
                            role_sync_error_reports.append((orgnr, "role", error_msg, status_code))

                    # Phase 2: Transactional database update
                    if processed_orgnrs:
                        # 1. Delete old roles for successfully processed companies
                        from sqlalchemy import delete

                        await self.db.execute(delete(models.Role).where(models.Role.orgnr.in_(processed_orgnrs)))

                        # 2. Bulk insert new roles
                        if all_batch_roles:
                            await self.role_repo.create_batch(all_batch_roles, commit=False)

                        for orgnr in sorted(processed_orgnrs):
                            await self._record_roles_changed_event(
                                orgnr=orgnr,
                                source_event=latest_role_events_by_orgnr.get(orgnr),
                                role_count=role_counts_by_orgnr.get(orgnr, 0),
                            )

                        # 3. Final commit for this batch
                        await self.db.commit()

                    await self._persist_sync_error_reports(role_sync_error_reports)
                    self._publish_contiguous_update_ids(result, committed_update_ids, failed_update_ids)
                    if result.latest_oppdateringsid:
                        await self.system_repo.set_state("role_update_latest_id", str(result.latest_oppdateringsid))

                    result.companies_processed += len(events)
                    if failed_update_ids:
                        result.cursor_gap_detected = True
                        logger.warning(
                            "Role updates had sync errors; advanced cursor only through contiguous successes"
                        )
                        break

                    # If we got a full batch, continue to next batch
                    if len(events) >= params["size"]:
                        params["afterId"] = result.latest_oppdateringsid or last_seen_id
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
