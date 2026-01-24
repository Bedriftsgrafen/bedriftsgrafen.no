"""Full-text search functionality for companies.

Contains search_by_name and related search methods.
"""

import asyncio
import logging

from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

import models
from exceptions import DatabaseException
from repositories.company.base import (
    LIST_VIEW_OPTIONS,
    SEARCH_SEMAPHORE,
    SEARCH_SEMAPHORE_TIMEOUT,
    LATEST_FINANCIAL_COLUMNS,
    CompanyWithFinancials,
)

logger = logging.getLogger(__name__)


class SearchMixin:
    """Mixin providing search functionality for CompanyRepository."""

    db: AsyncSession  # Type hint for mixin

    async def search_by_name(self, name: str, limit: int = 20) -> list[CompanyWithFinancials]:
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
            raise DatabaseException("Search timed out - too many concurrent searches")

    async def _search_by_name_impl(self, name: str, limit: int) -> list[CompanyWithFinancials]:
        """Implementation of search logic. Called under semaphore protection."""
        # For very short queries, use ILIKE for prefix matching
        if len(name) < 3:
            try:
                query = (
                    select(
                        models.Company,
                        *LATEST_FINANCIAL_COLUMNS,
                    )
                    .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
                    .options(*LIST_VIEW_OPTIONS)
                    .filter(or_(models.Company.navn.ilike(f"{name}%"), models.Company.orgnr.like(f"{name}%")))
                    .limit(limit)
                )
                result = await self.db.execute(query)
                return [
                    CompanyWithFinancials(
                        company=row[0],
                        latest_revenue=row[1],
                        latest_profit=row[2],
                        latest_operating_profit=row[3],
                        latest_operating_margin=row[4],
                        latest_equity_ratio=row[5],
                    )
                    for row in result.all()
                ]
            except DBAPIError as e:
                logger.error(f"DB error during short ILIKE search: {e}")
                raise DatabaseException(f"Search failed for query: {name}", original_error=e)

        # Check for exact orgnr match (fastest)
        if name.isdigit() and len(name) == 9:
            try:
                query = (
                    select(
                        models.Company,
                        *LATEST_FINANCIAL_COLUMNS,
                    )
                    .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
                    .options(*LIST_VIEW_OPTIONS)
                    .filter(models.Company.orgnr == name)
                    .limit(1)
                )
                exact_result = await self.db.execute(query)
                row = exact_result.first()
                if row:
                    return [
                        CompanyWithFinancials(
                            company=row[0],
                            latest_revenue=row[1],
                            latest_profit=row[2],
                            latest_operating_profit=row[3],
                            latest_operating_margin=row[4],
                            latest_equity_ratio=row[5],
                        )
                    ]
            except DBAPIError:
                pass  # Fall through to FTS search

        # Use Full-Text Search with websearch_to_tsquery
        search_query = func.websearch_to_tsquery("norwegian", name)
        query = (
            select(
                models.Company,
                *LATEST_FINANCIAL_COLUMNS,
            )
            .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            .options(*LIST_VIEW_OPTIONS)
            .filter(models.Company.search_vector.op("@@")(search_query))
        )

        # Apply relevance ordering (matching logic from QueryMixin._get_all_optimized)
        query = query.order_by(
            case(
                (func.lower(models.Company.navn) == name.lower(), 0),
                (func.lower(models.Company.navn).like(f"{name.lower()}%"), 1),
                else_=2,
            ),
            func.ts_rank(models.Company.search_vector, search_query).desc(),
            models.Company.navn.asc(),
        ).limit(limit)

        try:
            result = await self.db.execute(query)
            return [
                CompanyWithFinancials(
                    company=row[0],
                    latest_revenue=row[1],
                    latest_profit=row[2],
                    latest_operating_profit=row[3],
                    latest_operating_margin=row[4],
                    latest_equity_ratio=row[5],
                )
                for row in result.all()
            ]
        except DBAPIError as e:
            logger.error(f"DB error during full-text search: {e}")
            raise DatabaseException(f"Full-text search failed for query: {name}", original_error=e)
