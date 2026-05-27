"""Service layer for public activity and freshness feeds."""

import os
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from repositories.activity_repository import ActivityRepository
from repositories.company_event_repository import CompanyEventRepository
from schemas.activity import (
    ActivityCompanyItem,
    ActivityDeferredFeed,
    ActivityFeed,
    ActivityOverviewResponse,
    ActivityStatusItem,
    CompanyEventItem,
    CompanyEventListResponse,
)
from utils.redis_cache import RedisCache

ACTIVITY_CACHE_TTL_SECONDS = 120
EVENT_CACHE_TTL_SECONDS = 300

EVENT_TYPE_TITLES: dict[str, str] = {
    "company_registered": "Virksomhet registrert",
    "company_deleted": "Virksomhet slettet",
    "accounting_added": "Regnskap lagt til",
}

SYSTEM_STATE_LABELS: dict[str, dict[str, str]] = {
    "company_update_last_sync_date": {
        "title": "Enhetsregisteret",
        "description": "Siste dato Bedriftsgrafen har synket fra Brregs oppdateringsstrøm.",
        "source": "Brreg oppdateringsstrøm",
    },
    "company_update_latest_id": {
        "title": "Virksomhetsoppdateringer",
        "description": "Importcursor for virksomheter er oppdatert hos Bedriftsgrafen.",
        "source": "Bedriftsgrafen importjobb",
    },
    "subunit_update_latest_id": {
        "title": "Underenheter",
        "description": "Importcursor for underenheter er oppdatert hos Bedriftsgrafen.",
        "source": "Bedriftsgrafen importjobb",
    },
    "role_update_latest_id": {
        "title": "Roller",
        "description": "Importcursor for roller er oppdatert hos Bedriftsgrafen.",
        "source": "Bedriftsgrafen importjobb",
    },
}


class ActivityService:
    """Build activity hub payloads from indexed and event-backed queries."""

    def __init__(self, db: AsyncSession):
        self.repository = ActivityRepository(db)
        self.event_repository = CompanyEventRepository(db)
        self.cache = RedisCache(prefix="activity", ttl=ACTIVITY_CACHE_TTL_SECONDS)
        self.event_ledger_enabled = os.getenv("ENABLE_COMPANY_EVENT_LEDGER", "").lower() in {"1", "true", "yes"}

    async def get_overview(self, limit: int) -> ActivityOverviewResponse:
        cache_key = f"overview:{limit}"
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return ActivityOverviewResponse.model_validate(cached)

        registered_rows = await self.repository.get_latest_registered_companies(limit)
        bankruptcy_rows = await self.repository.get_latest_bankruptcies(limit)
        status_rows = await self.repository.get_system_state(list(SYSTEM_STATE_LABELS.keys()))
        accounting_rows = (
            await self.event_repository.get_latest_events_by_type_with_company("accounting_added", limit=limit)
            if self.event_ledger_enabled
            else []
        )

        overview = ActivityOverviewResponse(
            generated_at=datetime.now(UTC),
            cache_ttl_seconds=ACTIVITY_CACHE_TTL_SECONDS,
            new_companies=ActivityFeed(
                id="new_companies",
                title="Nye virksomheter",
                description="Nyeste registreringer i Enhetsregisteret som finnes hos Bedriftsgrafen.",
                source="Enhetsregisteret via Brreg",
                time_label="Registreringsdato",
                items=self._build_company_items(
                    registered_rows,
                    event_label="Registrert i Enhetsregisteret",
                    source="Enhetsregisteret via Brreg",
                    time_semantics="Kildedato fra Enhetsregisteret, ikke Bedriftsgrafens importtidspunkt.",
                ),
            ),
            bankruptcies=ActivityFeed(
                id="bankruptcies",
                title="Konkurser og avvikling",
                description="Virksomheter med konkursdato registrert i datagrunnlaget.",
                source="Enhetsregisteret via Brreg",
                time_label="Konkursdato",
                items=self._build_company_items(
                    bankruptcy_rows,
                    event_label="Konkurs registrert",
                    source="Enhetsregisteret via Brreg",
                    time_semantics="Kildedato fra Brreg. Status bør kontrolleres mot Brreg ved juridisk bruk.",
                ),
            ),
            accounting_updates=ActivityFeed(
                id="accounting_updates",
                title="Nye regnskap hos Bedriftsgrafen",
                description="Regnskapshendelser skrevet til Bedriftsgrafens eventlogg ved import eller kontrollert backfill.",
                source="Bedriftsgrafen eventlogg",
                time_label="Lagt til hos Bedriftsgrafen",
                items=self._build_accounting_event_items(accounting_rows),
            ),
            data_status=self._build_status_items(status_rows),
            deferred_feeds=[
                ActivityDeferredFeed(
                    id="employee_changes",
                    title="Endringer i ansatte",
                    reason="Antall ansatte er foreløpig bare nåverdi i selskapsdataene.",
                    requirement="Skriv forrige og ny verdi til eventloggen under Brreg-oppdateringer før dette blir en offentlig feed.",
                ),
                ActivityDeferredFeed(
                    id="brreg_announcements",
                    title="Brreg-kunngjøringer",
                    reason="Kunngjøringer må hentes fra en godkjent kilde og normaliseres før publisering.",
                    requirement="Ingest via offisiell XML/subscription eller annen godkjent kilde, med GDPR-vurdering før indeksering.",
                ),
            ],
        )

        await self.cache.set(cache_key, overview.model_dump(mode="json"))
        return overview

    async def get_company_events(self, orgnr: str, *, limit: int, offset: int) -> CompanyEventListResponse:
        cache_key = f"events:{orgnr}:{limit}:{offset}"
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return CompanyEventListResponse.model_validate(cached)

        rows = await self.event_repository.get_events_for_company(orgnr, limit=limit + 1, offset=offset)
        has_more = len(rows) > limit
        visible_rows = rows[:limit]

        response = CompanyEventListResponse(
            generated_at=datetime.now(UTC),
            cache_ttl_seconds=EVENT_CACHE_TTL_SECONDS,
            orgnr=orgnr,
            limit=limit,
            offset=offset,
            has_more=has_more,
            events=self._build_event_items(visible_rows),
        )

        await self.cache.set(cache_key, response.model_dump(mode="json"), ttl=EVENT_CACHE_TTL_SECONDS)
        return response

    @staticmethod
    def _build_company_items(
        rows: list[dict[str, Any]],
        *,
        event_label: str,
        source: str,
        time_semantics: str,
    ) -> list[ActivityCompanyItem]:
        return [
            ActivityCompanyItem(
                orgnr=row["orgnr"],
                navn=row.get("navn"),
                organisasjonsform=row.get("organisasjonsform"),
                naeringskode=row.get("naeringskode"),
                antall_ansatte=row.get("antall_ansatte"),
                event_date=row.get("event_date"),
                event_label=event_label,
                source=source,
                time_semantics=time_semantics,
            )
            for row in rows
        ]

    @staticmethod
    def _build_status_items(rows: list[dict[str, Any]]) -> list[ActivityStatusItem]:
        rows_by_key = {row["key"]: row for row in rows}
        items: list[ActivityStatusItem] = []

        for key, metadata in SYSTEM_STATE_LABELS.items():
            row = rows_by_key.get(key)
            if row is None:
                continue

            items.append(
                ActivityStatusItem(
                    key=key,
                    title=metadata["title"],
                    description=metadata["description"],
                    value=row.get("value") if key == "company_update_last_sync_date" else "Cursor oppdatert",
                    updated_at=row.get("updated_at"),
                    source=metadata["source"],
                )
            )

        return items

    @staticmethod
    def _build_accounting_event_items(rows: list[dict[str, Any]]) -> list[ActivityCompanyItem]:
        items: list[ActivityCompanyItem] = []

        for row in rows:
            new_value = row.get("new_value") or {}
            payload = row.get("payload") or {}
            year = new_value.get("aar") or payload.get("aar")
            observed_at = row.get("observed_at")

            items.append(
                ActivityCompanyItem(
                    orgnr=row["orgnr"],
                    navn=row.get("navn"),
                    organisasjonsform=row.get("organisasjonsform"),
                    naeringskode=row.get("naeringskode"),
                    antall_ansatte=row.get("antall_ansatte"),
                    event_date=observed_at.date() if observed_at else None,
                    event_label=f"Regnskap {year} lagt til" if year else "Regnskap lagt til",
                    source=row.get("source") or "Bedriftsgrafen eventlogg",
                    time_semantics=(
                        "Datoen viser når Bedriftsgrafen observerte eller importerte regnskapet, "
                        "ikke offisiell innsendingsdato hos Brreg."
                    ),
                )
            )

        return items

    @staticmethod
    def _build_event_items(rows: list[Any]) -> list[CompanyEventItem]:
        return [
            CompanyEventItem(
                id=row.id,
                orgnr=row.orgnr,
                event_type=row.event_type,
                title=EVENT_TYPE_TITLES.get(row.event_type, "Hendelse registrert"),
                source=row.source,
                source_update_id=row.source_update_id,
                occurred_at=row.occurred_at,
                observed_at=row.observed_at,
                time_semantics=(
                    "Kildetidspunkt når kilden oppgir det; ellers tidspunktet Bedriftsgrafen observerte hendelsen."
                ),
                previous_value=row.previous_value,
                new_value=row.new_value,
                payload=row.payload,
            )
            for row in rows
        ]
