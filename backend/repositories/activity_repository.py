"""Repository for public activity and freshness feeds."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models


class ActivityRepository:
    """Read optimized, public-safe activity queries."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_latest_registered_companies(self, limit: int) -> list[dict[str, Any]]:
        stmt = (
            select(
                models.Company.orgnr,
                models.Company.navn,
                models.Company.organisasjonsform,
                models.Company.naeringskode,
                models.Company.antall_ansatte,
                models.Company.registreringsdato_enhetsregisteret.label("event_date"),
            )
            .where(models.Company.registreringsdato_enhetsregisteret.is_not(None))
            .order_by(models.Company.registreringsdato_enhetsregisteret.desc().nulls_last())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def get_latest_bankruptcies(self, limit: int) -> list[dict[str, Any]]:
        stmt = (
            select(
                models.Company.orgnr,
                models.Company.navn,
                models.Company.organisasjonsform,
                models.Company.naeringskode,
                models.Company.antall_ansatte,
                models.Company.konkursdato.label("event_date"),
            )
            .where(models.Company.konkursdato.is_not(None))
            .order_by(models.Company.konkursdato.desc().nulls_last())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def get_system_state(self, keys: list[str]) -> list[dict[str, Any]]:
        stmt = select(models.SystemState.key, models.SystemState.value, models.SystemState.updated_at).where(
            models.SystemState.key.in_(keys)
        )
        result = await self.db.execute(stmt)
        return [dict(row) for row in result.mappings().all()]
