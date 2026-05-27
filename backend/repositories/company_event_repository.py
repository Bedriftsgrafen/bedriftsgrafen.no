"""Repository for the durable company event ledger."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

import models


class CompanyEventRepository:
    """Write and read idempotent company events."""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def build_event_key(
        *,
        orgnr: str,
        event_type: str,
        source: str,
        source_update_id: str | None = None,
        occurred_at: datetime | None = None,
        payload: dict[str, Any] | None = None,
    ) -> str:
        identity = {
            "orgnr": orgnr,
            "event_type": event_type,
            "source": source,
            "source_update_id": source_update_id,
            "occurred_at": occurred_at.isoformat() if occurred_at else None,
            "payload": payload or {},
        }
        digest = hashlib.sha256(json.dumps(identity, sort_keys=True, default=str).encode("utf-8")).hexdigest()
        return f"{event_type}:{orgnr}:{digest[:32]}"

    async def record_event(
        self,
        *,
        orgnr: str,
        event_type: str,
        source: str,
        source_update_id: str | None = None,
        occurred_at: datetime | None = None,
        observed_at: datetime | None = None,
        previous_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        payload: dict[str, Any] | None = None,
        notes: str | None = None,
        event_key: str | None = None,
    ) -> models.CompanyEvent:
        resolved_event_key = event_key or self.build_event_key(
            orgnr=orgnr,
            event_type=event_type,
            source=source,
            source_update_id=source_update_id,
            occurred_at=occurred_at,
            payload=payload,
        )

        insert_stmt = (
            insert(models.CompanyEvent)
            .values(
                orgnr=orgnr,
                event_type=event_type,
                source=source,
                source_update_id=source_update_id,
                event_key=resolved_event_key,
                occurred_at=occurred_at,
                observed_at=observed_at or datetime.now(UTC),
                previous_value=previous_value,
                new_value=new_value,
                payload=payload,
                notes=notes,
            )
            .on_conflict_do_nothing(index_elements=["event_key"])
            .returning(models.CompanyEvent)
        )

        result = await self.db.execute(insert_stmt)
        inserted = result.scalar_one_or_none()
        if inserted is not None:
            return inserted

        existing_result = await self.db.execute(
            select(models.CompanyEvent).where(models.CompanyEvent.event_key == resolved_event_key)
        )
        return existing_result.scalar_one()

    async def get_events_for_company(self, orgnr: str, *, limit: int, offset: int = 0) -> list[models.CompanyEvent]:
        stmt = (
            select(models.CompanyEvent)
            .where(models.CompanyEvent.orgnr == orgnr)
            .order_by(models.CompanyEvent.observed_at.desc(), models.CompanyEvent.id.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
