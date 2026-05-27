"""Service layer for public activity and freshness feeds."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from repositories.activity_repository import ActivityRepository
from schemas.activity import (
    ActivityCompanyItem,
    ActivityDeferredFeed,
    ActivityFeed,
    ActivityOverviewResponse,
    ActivityStatusItem,
)
from utils.redis_cache import RedisCache

ACTIVITY_CACHE_TTL_SECONDS = 120

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
    """Build activity hub payloads from index-backed repository queries."""

    def __init__(self, db: AsyncSession):
        self.repository = ActivityRepository(db)
        self.cache = RedisCache(prefix="activity", ttl=ACTIVITY_CACHE_TTL_SECONDS)

    async def get_overview(self, limit: int) -> ActivityOverviewResponse:
        cache_key = f"overview:{limit}"
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return ActivityOverviewResponse.model_validate(cached)

        registered_rows = await self.repository.get_latest_registered_companies(limit)
        bankruptcy_rows = await self.repository.get_latest_bankruptcies(limit)
        status_rows = await self.repository.get_system_state(list(SYSTEM_STATE_LABELS.keys()))

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
            data_status=self._build_status_items(status_rows),
            deferred_feeds=[
                ActivityDeferredFeed(
                    id="accounting_updates",
                    title="Nye regnskap hos Bedriftsgrafen",
                    reason="Regnskapstabellen mangler i dag en trygg indeks for siste oppdatering.",
                    requirement="Legg til indeks eller skriv regnskapshendelser til eventloggen før dette blir en offentlig live-feed.",
                )
            ],
        )

        await self.cache.set(cache_key, overview.model_dump(mode="json"))
        return overview

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
