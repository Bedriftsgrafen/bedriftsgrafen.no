"""Repository for SubUnit database operations"""

import asyncio
import logging

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models

logger = logging.getLogger(__name__)

# Limit concurrent trigram searches to avoid overwhelming DB (expensive operation)
SEARCH_SEMAPHORE = asyncio.Semaphore(4)


class SubUnitRepository:
    """Repository for managing subunit (underenheter) data"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_parent_orgnr(self, parent_orgnr: str) -> list[models.SubUnit]:
        """
        Get all subunits for a parent company.

        Args:
            parent_orgnr: Parent company organization number

        Returns:
            List of SubUnit models
        """
        try:
            stmt = (
                select(models.SubUnit).where(models.SubUnit.parent_orgnr == parent_orgnr).order_by(models.SubUnit.navn)
            )
            result = await self.db.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"Error fetching subunits for {parent_orgnr}: {e}")
            return []

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

    async def create_batch(self, subunits: list[models.SubUnit]) -> int:
        """
        Batch create subunits (more efficient than one-by-one).
        Uses merge to handle duplicates gracefully.

        Args:
            subunits: List of SubUnit models to create/update

        Returns:
            Number of subunits successfully saved
        """
        if not subunits:
            return 0

        try:
            # Use merge for upsert behavior (update if exists, insert if new)
            for subunit in subunits:
                await self.db.merge(subunit)

            await self.db.commit()
            logger.info(f"Saved {len(subunits)} subunits to database")
            return len(subunits)

        except Exception as e:
            logger.error(f"Error saving subunits batch: {e}")
            await self.db.rollback()
            return 0

    async def delete_by_parent_orgnr(self, parent_orgnr: str) -> int:
        """
        Delete all subunits for a parent company.
        Useful for re-syncing data.

        Args:
            parent_orgnr: Parent company organization number

        Returns:
            Number of subunits deleted
        """
        try:
            stmt = delete(models.SubUnit).where(models.SubUnit.parent_orgnr == parent_orgnr)
            result = await self.db.execute(stmt)
            await self.db.commit()
            deleted: int = result.rowcount  # type: ignore[attr-defined]
            logger.info(f"Deleted {deleted} subunits for {parent_orgnr}")
            return deleted
        except Exception as e:
            logger.error(f"Error deleting subunits for {parent_orgnr}: {e}")
            await self.db.rollback()
            return 0

    async def count_by_parent(self, parent_orgnr: str) -> int:
        """
        Count subunits for a parent company.

        Args:
            parent_orgnr: Parent company organization number

        Returns:
            Count of subunits
        """
        try:
            stmt = select(models.SubUnit).where(models.SubUnit.parent_orgnr == parent_orgnr)
            result = await self.db.execute(stmt)
            return len(result.scalars().all())
        except Exception as e:
            logger.error(f"Error counting subunits for {parent_orgnr}: {e}")
            return 0
