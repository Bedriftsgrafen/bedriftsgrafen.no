"""Repository for SubUnit database operations"""

import asyncio
import logging
import os
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.concurrency import SUBUNIT_SEARCH_SEMAPHORE_SIZE
from utils.logging_config import sanitize_log

logger = logging.getLogger(__name__)

# Limit concurrent trigram searches to avoid overwhelming DB (expensive operation)
SEARCH_SEMAPHORE = asyncio.Semaphore(SUBUNIT_SEARCH_SEMAPHORE_SIZE)

# BESLUTNING: No Brreg source defines a subunit cache TTL. Default matches the
# existing role cache policy and is configurable.
DEFAULT_SUBUNIT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60


def _int_from_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def subunit_cache_ttl_seconds() -> int:
    return max(0, _int_from_env("SUBUNIT_CACHE_TTL_SECONDS", DEFAULT_SUBUNIT_CACHE_TTL_SECONDS))


class SubUnitRepository:
    """Repository for managing subunit (underenheter) data"""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _ensure_utc(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return value if value.tzinfo else value.replace(tzinfo=UTC)

    async def get_by_parent_orgnr(self, parent_orgnr: str) -> list[models.SubUnit]:
        """Fetch all subunits for a parent company, sorted by name."""
        try:
            stmt = (
                select(models.SubUnit).where(models.SubUnit.parent_orgnr == parent_orgnr).order_by(models.SubUnit.navn)
            )
            result = await self.db.execute(stmt)
            subunits = list(result.scalars().all())
            logger.debug(f"Fetched {len(subunits)} subunits for parent {parent_orgnr}")
            return subunits
        except Exception as e:
            logger.error(f"Failed to fetch subunits for {parent_orgnr}: {e}")
            return []

    async def get_cache_timestamp(self, parent_orgnr: str) -> datetime | None:
        """Return newest local subunit row timestamp for a non-empty cache."""
        try:
            stmt = select(func.max(models.SubUnit.updated_at)).where(models.SubUnit.parent_orgnr == parent_orgnr)
            result = await self.db.execute(stmt)
            return self._ensure_utc(result.scalar_one_or_none())
        except Exception as e:
            logger.error("Error getting subunit cache timestamp for %s: %s", sanitize_log(parent_orgnr), e)
            return None

    async def get_refresh_timestamp(self, parent_orgnr: str) -> datetime | None:
        """Return the newest successful subunit refresh marker for a parent.

        Subunit rows can prove a non-empty cache. ``Company.last_polled_subunits``
        proves successful polling even when Brreg returned an empty list.
        """
        row_timestamp = await self.get_cache_timestamp(parent_orgnr)

        try:
            stmt = select(models.Company.last_polled_subunits).where(models.Company.orgnr == parent_orgnr)
            result = await self.db.execute(stmt)
            last_polled = self._ensure_utc(result.scalar_one_or_none())
        except Exception as e:
            logger.error("Error getting subunit poll marker for %s: %s", sanitize_log(parent_orgnr), e)
            last_polled = None

        timestamps = [ts for ts in [row_timestamp, last_polled] if ts is not None]
        return max(timestamps) if timestamps else None

    async def is_cache_valid(self, parent_orgnr: str, ttl_seconds: int | None = None) -> bool:
        """Return whether the subunit cache is still fresh for this parent."""
        last_updated = await self.get_refresh_timestamp(parent_orgnr)
        if not last_updated:
            return False
        ttl = subunit_cache_ttl_seconds() if ttl_seconds is None else max(0, ttl_seconds)
        return datetime.now(UTC) < last_updated + timedelta(seconds=ttl)

    async def parent_company_exists(self, parent_orgnr: str) -> bool:
        """Return whether a subunit refresh can be cached for this parent.

        A database failure fails closed so public traffic cannot turn this
        endpoint into an unrestricted Brreg proxy.
        """
        try:
            stmt = select(models.Company.orgnr).where(models.Company.orgnr == parent_orgnr)
            result = await self.db.execute(stmt)
            return result.scalar_one_or_none() is not None
        except Exception as e:
            logger.error("Error checking parent company for subunit refresh %s: %s", sanitize_log(parent_orgnr), e)
            return False

    async def mark_cache_refreshed(self, parent_orgnr: str, commit: bool = True) -> int:
        """Persist a successful subunit refresh marker, including empty sets."""
        stmt = (
            update(models.Company)
            .where(models.Company.orgnr == parent_orgnr)
            .values(last_polled_subunits=datetime.now(UTC))
        )
        result = await self.db.execute(stmt)
        if commit:
            await self.db.commit()
        rowcount = getattr(result, "rowcount", 0)
        return rowcount if isinstance(rowcount, int) else 0

    async def get_by_orgnr(self, orgnr: str) -> models.SubUnit | None:
        """
        Get a specific subunit by its organization number.

        Args:
            orgnr: Subunit organization number

        Returns:
            SubUnit model or None if not found
        """
        try:
            stmt = select(models.SubUnit).where(models.SubUnit.orgnr == orgnr)
            result = await self.db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching subunit {orgnr}: {e}")
            return None

    async def search_by_name(self, query: str, limit: int = 50) -> list[models.SubUnit]:
        """
        Fuzzy search for subunits by name using trigram similarity.

        Args:
            query: Search query (minimum 2 characters)
            limit: Maximum number of results (default 50, max 500)

        Returns:
            List of SubUnit objects matching the query, sorted by similarity
        """
        if not query or len(query) < 2:
            return []

        try:
            # Use semaphore to limit concurrent expensive trigram searches
            async with SEARCH_SEMAPHORE:
                limit = min(limit, 500)  # Cap at 500
                similarity = func.similarity(models.SubUnit.navn, query)

                stmt = (
                    select(models.SubUnit)
                    .where(similarity > 0.3)  # Trigram similarity threshold
                    .order_by(similarity.desc(), models.SubUnit.navn.asc())
                    .limit(limit)
                )

                result = await self.db.execute(stmt)
                return list(result.scalars().all())
        except Exception as e:
            logger.error(f"Error searching subunits for '{query}': {e}")
            return []

    async def create_batch(self, subunits: list[models.SubUnit], commit: bool = True) -> int:
        """
        Batch create subunits (more efficient than one-by-one).
        Automatically deduplicates by orgnr before insert (last occurrence wins).
        Uses PostgreSQL UPSERT for atomic updates on conflict.

        Args:
            subunits: List of SubUnit models to create/update
            commit: Whether to commit the transaction (default True)

        Returns:
            Number of distinct subunits successfully saved (after deduplication)

        Note:
            If multiple subunits with the same orgnr exist in the batch,
            the last one in the list will be used ("last wins" strategy).
        """
        if not subunits:
            return 0

        # Filter out subunits without parent_orgnr (required by DB constraint)
        valid_subunits = [s for s in subunits if s.parent_orgnr]
        if not valid_subunits:
            logger.warning(f"All {len(subunits)} subunits filtered out due to missing parent_orgnr")
            return 0

        try:
            # Prepare values for bulk insert - Use a dict to deduplicate by orgnr
            # If multiple subunits with same orgnr exist in batch, the last one wins
            values_map = {}
            for s in valid_subunits:
                values_map[s.orgnr] = {
                    "orgnr": s.orgnr,
                    "navn": s.navn,
                    "parent_orgnr": s.parent_orgnr,
                    "organisasjonsform": s.organisasjonsform,
                    "naeringskode": s.naeringskode,
                    "antall_ansatte": s.antall_ansatte,
                    "beliggenhetsadresse": s.beliggenhetsadresse,
                    "postadresse": s.postadresse,
                    "stiftelsesdato": s.stiftelsesdato,
                    "registreringsdato_enhetsregisteret": s.registreringsdato_enhetsregisteret,
                    "data": s.raw_data,
                }

            values = list(values_map.values())

            # Warn if duplicates were found (indicates upstream data quality issue)
            if len(values) < len(valid_subunits):
                duplicate_count = len(valid_subunits) - len(values)
                logger.warning(
                    f"Deduplicated {duplicate_count} duplicate subunit(s) in batch. "
                    f"Original: {len(valid_subunits)}, Unique: {len(values)}"
                )

            stmt = insert(models.SubUnit).values(values)

            # Upsert: Update fields on conflict
            stmt = stmt.on_conflict_do_update(
                index_elements=[models.SubUnit.orgnr],
                set_={
                    "navn": stmt.excluded.navn,
                    "parent_orgnr": stmt.excluded.parent_orgnr,
                    "organisasjonsform": stmt.excluded.organisasjonsform,
                    "naeringskode": stmt.excluded.naeringskode,
                    "antall_ansatte": stmt.excluded.antall_ansatte,
                    "beliggenhetsadresse": stmt.excluded.beliggenhetsadresse,
                    "postadresse": stmt.excluded.postadresse,
                    "stiftelsesdato": stmt.excluded.stiftelsesdato,
                    "registreringsdato_enhetsregisteret": stmt.excluded.registreringsdato_enhetsregisteret,
                    "data": stmt.excluded.data,
                    "updated_at": func.now(),
                },
            )

            await self.db.execute(stmt)

            if commit:
                await self.db.commit()
            logger.info(f"Saved {len(values)} subunits to database (deduplicated from {len(valid_subunits)})")
            return len(values)

        except Exception as e:
            logger.error(f"Error saving subunits batch: {e}", exc_info=True)
            if commit:
                await self.db.rollback()
            return 0

    async def delete_by_parent_orgnr(self, parent_orgnr: str, commit: bool = True) -> int:
        """
        Delete all subunits for a parent company.
        Useful for re-syncing data.

        Args:
            parent_orgnr: Parent company organization number
            commit: Whether to commit the transaction (default True)

        Returns:
            Number of subunits deleted
        """
        try:
            stmt = delete(models.SubUnit).where(models.SubUnit.parent_orgnr == parent_orgnr)
            result = await self.db.execute(stmt)
            if commit:
                await self.db.commit()
            deleted: int = result.rowcount  # type: ignore[attr-defined]
            logger.info(f"Deleted {deleted} subunits for {parent_orgnr}")
            return deleted
        except Exception as e:
            logger.error(f"Failed to delete subunits for {parent_orgnr}: {e}")
            if commit:
                await self.db.rollback()
            return 0

    async def delete_by_orgnr(self, orgnr: str, commit: bool = True) -> int:
        """
        Delete a specific subunit.

        Args:
            orgnr: Subunit organization number
            commit: Whether to commit the transaction (default True)

        Returns:
            Number of subunits deleted (0 or 1)
        """
        try:
            stmt = delete(models.SubUnit).where(models.SubUnit.orgnr == orgnr)
            result = await self.db.execute(stmt)
            if commit:
                await self.db.commit()
            deleted: int = result.rowcount  # type: ignore[attr-defined]
            if deleted:
                logger.info(f"Deleted subunit {orgnr} (marked as deleted in API)")
            return deleted
        except Exception as e:
            logger.error(f"Failed to delete subunit {orgnr}: {e}")
            if commit:
                await self.db.rollback()
            raise

    async def count_by_parent(self, parent_orgnr: str) -> int:
        """Efficiently count subunits for a parent company."""
        try:
            stmt = select(func.count(models.SubUnit.orgnr)).where(models.SubUnit.parent_orgnr == parent_orgnr)
            result = await self.db.execute(stmt)
            return result.scalar_one() or 0
        except Exception as e:
            logger.error(f"Failed to count subunits for {parent_orgnr}: {e}")
            return 0

    async def get_existing_orgnrs(self, orgnrs: list[str]) -> set[str]:
        """Check which of the given orgnrs exist in the underenheter table.

        Args:
            orgnrs: List of organization numbers to check

        Returns:
            Set of existing organization numbers
        """
        if not orgnrs:
            return set()

        try:
            stmt = select(models.SubUnit.orgnr).where(models.SubUnit.orgnr.in_(orgnrs))
            result = await self.db.execute(stmt)
            return {row[0] for row in result.fetchall()}
        except Exception as e:
            logger.error(f"Database error checking existing subunits: {e}")
            return set()
