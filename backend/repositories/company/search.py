"""Full-text search functionality for companies.

Contains search_by_name and related search methods.
"""

import asyncio
import logging

from sqlalchemy import func, or_, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

import models
from exceptions import DatabaseException
from repositories.company.base import LIST_VIEW_OPTIONS, SEARCH_SEMAPHORE, SEARCH_SEMAPHORE_TIMEOUT

logger = logging.getLogger(__name__)


class SearchMixin:
    """Mixin providing search functionality for CompanyRepository."""

    db: AsyncSession  # Type hint for mixin

    async def search_by_name(self, name: str, limit: int = 20) -> list[models.Company]:
        """
        Search companies by name or organization number using Full-Text Search.
        Falls back to ILIKE for very short queries (< 3 chars).
        Rate-limited by asyncio.Semaphore with timeout protection.
        """
        try:
            async with asyncio.timeout(SEARCH_SEMAPHORE_TIMEOUT):
                async with SEARCH_SEMAPHORE:
                    return await self._search_by_name_impl(name, limit)
        except TimeoutError:
            logger.warning(f"Search semaphore timeout for query: {name}")
            raise DatabaseException("Search timed out", details="Too many concurrent searches")

    async def _search_by_name_impl(self, name: str, limit: int) -> list[models.Company]:
        """Implementation of search logic. Called under semaphore protection."""
        # For very short queries, use ILIKE for prefix matching
        if len(name) < 3:
            try:
                result = await self.db.execute(
                    select(models.Company)
                    .options(*LIST_VIEW_OPTIONS)
                    .filter(or_(models.Company.navn.ilike(f"{name}%"), models.Company.orgnr.like(f"{name}%")))
                    .limit(limit)
                )
                return list(result.scalars().all())
            except DBAPIError as e:
                logger.error(f"DB error during short ILIKE search: {e}")
                raise DatabaseException(f"Search failed for query: {name}", original_error=e)

        # Check for exact orgnr match (fastest)
        if name.isdigit() and len(name) == 9:
            try:
                exact_result = await self.db.execute(
                    select(models.Company).options(*LIST_VIEW_OPTIONS).filter(models.Company.orgnr == name).limit(1)
                )
                exact_match = exact_result.scalar_one_or_none()
                if exact_match:
                    return [exact_match]
            except DBAPIError:
                pass  # Fall through to FTS search

        # Use Full-Text Search with websearch_to_tsquery
        search_query = func.websearch_to_tsquery("norwegian", name)
        query = (
            select(models.Company)
            .options(*LIST_VIEW_OPTIONS)
            .filter(models.Company.search_vector.op("@@")(search_query))
            .limit(limit)
        )

        try:
            result = await self.db.execute(query)
            return list(result.scalars().all())
        except DBAPIError as e:
            logger.error(f"DB error during full-text search: {e}")
            raise DatabaseException(f"Full-text search failed for query: {name}", original_error=e)
