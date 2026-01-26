"""Query operations for companies.

Contains get_all, stream_all, and related query methods with optimization logic.
"""

import logging
from typing import cast
from sqlalchemy import select, Select, func
from sqlalchemy.ext.asyncio import AsyncSession

import models
from repositories.company.base import (
    LIST_VIEW_OPTIONS,
    SORT_COLUMN_MAP,
    CompanyWithFinancials,
    LATEST_FINANCIAL_COLUMNS,
)
from repositories.company_filter_builder import CompanyFilterBuilder, FilterParams


logger = logging.getLogger(__name__)


class QueryMixin:
    """Mixin providing query operations for CompanyRepository."""

    db: AsyncSession  # Type hint for mixin

    async def get_all(
        self,
        filters: FilterParams,
        skip: int = 0,
        limit: int = 100,
        sort_by: str = "navn",
        sort_order: str = "asc",
    ) -> list[CompanyWithFinancials]:
        """
        Get companies with optional filters, including latest financial data.
        Uses optimized two-phase query for non-financial sorts to leverage indexes.
        """
        # Check if we need financial data for filtering/sorting
        financial_sort = sort_by in ("revenue", "profit", "operating_profit", "operating_margin")

        # Check for financial filters presence
        needs_financial_join_for_filter = financial_sort or filters.has_financial_filters()

        if needs_financial_join_for_filter:
            return await self._get_all_with_financial_join(
                filters=filters,
                skip=skip,
                limit=limit,
                sort_by=sort_by,
                sort_order=sort_order,
            )
        else:
            return await self._get_all_optimized(
                filters=filters,
                skip=skip,
                limit=limit,
                sort_by=sort_by,
                sort_order=sort_order,
            )

    async def stream_all(
        self,
        filters: FilterParams,
        skip: int = 0,
        limit: int = 100,
        sort_by: str = "navn",
        sort_order: str = "asc",
    ):
        """
        Stream companies one by one efficiently.
        Uses LEFT JOIN for export to include companies without financials.
        """
        query = (
            select(
                models.Company,
                *LATEST_FINANCIAL_COLUMNS,
            )
            .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            .options(*LIST_VIEW_OPTIONS)
        )

        # Apply filters
        query, _ = self._apply_filters_no_join(query, filters=filters)

        # Apply sorting - extend base map with financial columns
        extended_sort_map = {
            **SORT_COLUMN_MAP,
            "revenue": models.LatestFinancials.salgsinntekter,
            "profit": models.LatestFinancials.aarsresultat,
            "operating_profit": models.LatestFinancials.driftsresultat,
            "operating_margin": models.LatestFinancials.operating_margin,
            "equity_ratio": models.LatestFinancials.egenkapitalandel,
        }
        sort_column = extended_sort_map.get(sort_by, models.Company.navn)

        if sort_order == "desc":
            query = query.order_by(sort_column.desc().nullslast())
        else:
            query = query.order_by(sort_column.asc().nullslast())

        query = query.offset(skip).limit(limit)
        query = query.execution_options(yield_per=100)

        result = await self.db.stream(query)
        async for row in result:
            yield CompanyWithFinancials(
                company=row[0],
                latest_revenue=row[1],
                latest_profit=row[2],
                latest_operating_profit=row[3],
                latest_operating_margin=row[4],
                latest_equity_ratio=row[5],
            )

    async def _get_all_optimized(
        self,
        filters: FilterParams,
        skip: int,
        limit: int,
        sort_by: str,
        sort_order: str,
    ) -> list[CompanyWithFinancials]:
        """
        Optimized query for non-financial sorts.
        Phase 1: Get paginated orgnrs using indexes (very fast)
        Phase 2: Fetch full company data for those orgnrs
        Phase 3: Fetch financial data only for the returned companies

        SECURITY: Uses SQLAlchemy exclusively to prevent SQL injection.
        """
        from sqlalchemy import case, func

        sort_column_obj = SORT_COLUMN_MAP.get(sort_by, models.Company.navn)

        # Phase 1: Build query using CompanyFilterBuilder (SECURE: parameterized)
        builder = CompanyFilterBuilder(filters)
        builder.apply_all(include_financial=False)

        base_query = select(models.Company.orgnr)
        base_query = builder.apply_to_query(base_query)

        # Apply ordering
        if filters.name and len(filters.name) >= 3 and not filters.name.isdigit():
            # Search relevance ordering for text queries
            base_query = base_query.order_by(
                case(
                    (func.lower(models.Company.navn) == filters.name.lower(), 0),
                    (func.lower(models.Company.navn).like(f"{filters.name.lower()}%"), 1),
                    else_=2,
                ),
                func.ts_rank(models.Company.search_vector, func.websearch_to_tsquery("norwegian", filters.name)).desc(),
                sort_column_obj.desc() if sort_order == "desc" else sort_column_obj.asc(),
            )
        else:
            # Standard ordering
            if sort_order == "desc":
                base_query = base_query.order_by(
                    sort_column_obj.desc().nullslast(),
                    models.Company.stiftelsesdato.desc().nullslast(),
                    models.Company.navn.asc(),
                )
            else:
                base_query = base_query.order_by(
                    sort_column_obj.asc().nullslast(),
                    models.Company.stiftelsesdato.asc().nullslast(),
                    models.Company.navn.asc(),
                )

        base_query = base_query.limit(limit).offset(skip)

        result = await self.db.execute(base_query)
        rows = result.fetchall()
        orgnrs = [row[0] for row in rows]
        if not orgnrs:
            return []

        # Phase 2: Fetch full company data
        query = select(models.Company).options(*LIST_VIEW_OPTIONS).filter(models.Company.orgnr.in_(orgnrs))
        result = await self.db.execute(query)
        fetched_companies = cast(list[models.Company], result.scalars().all())
        companies_dict: dict[str, models.Company] = {c.orgnr: c for c in fetched_companies}
        companies: list[models.Company] = [companies_dict[orgnr] for orgnr in orgnrs if orgnr in companies_dict]

        if not companies:
            return []

        # Phase 3: Get financial data
        fin_query = select(
            models.LatestFinancials.orgnr,
            *LATEST_FINANCIAL_COLUMNS,
        ).filter(models.LatestFinancials.orgnr.in_(orgnrs))

        fin_result = await self.db.execute(fin_query)
        fin_data = {row[0]: (row[1], row[2], row[3], row[4], row[5]) for row in fin_result.all()}

        return [
            CompanyWithFinancials(
                company=c,
                latest_revenue=fin_data[c.orgnr][0] if c.orgnr in fin_data else None,
                latest_profit=fin_data[c.orgnr][1] if c.orgnr in fin_data else None,
                latest_operating_profit=fin_data[c.orgnr][2] if c.orgnr in fin_data else None,
                latest_operating_margin=fin_data[c.orgnr][3] if c.orgnr in fin_data else None,
                latest_equity_ratio=fin_data[c.orgnr][4] if c.orgnr in fin_data else None,
            )
            for c in companies
        ]

    async def get_paginated_orgnrs(
        self, offset: int = 0, limit: int = 50000, after_orgnr: str | None = None
    ) -> list[tuple[str, str | None]]:
        """
        Fetch paginated orgnrs and their update timestamps from raw_data.
        Optimized for sitemap generation to avoid large object overhead.
        Supports both OFFSET (slow) and Keyset (fast) pagination.
        """
        stmt = select(
            models.Company.orgnr,
            models.Company.raw_data["oppdatert"].astext.label("updated_at"),
        ).order_by(models.Company.orgnr)

        if after_orgnr:
            stmt = stmt.where(models.Company.orgnr > after_orgnr)
        else:
            stmt = stmt.offset(offset)

        stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return [(row.orgnr, row.updated_at) for row in result]

    async def get_sitemap_anchors(self, page_size: int = 50000, first_page_offset: int = 0) -> list[str]:
        """
        Fetch the starting orgnr for each sitemap page.
        Allows 'jumping' to a specific page using keyset pagination.

        NOTE: This is the legacy O(n) implementation. Use get_sitemap_anchors_optimized instead.
        """
        # Get total count first
        count_stmt = select(func.count(models.Company.orgnr))
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        anchors = []
        # Page 1 contains (page_size - first_page_offset) companies.
        # Its last company is at index (page_size - first_page_offset - 1).
        # We use the LAST company of page N as the anchor for page N+1.
        # This allows using WHERE orgnr > anchor for the next page.
        start_offset = page_size - first_page_offset - 1

        for offset in range(start_offset, total, page_size):
            if offset < 0:
                continue
            anchor_stmt = select(models.Company.orgnr).order_by(models.Company.orgnr).offset(offset).limit(1)
            anchor_result = await self.db.execute(anchor_stmt)
            anchor = anchor_result.scalar()
            if anchor:
                anchors.append(anchor)

        return anchors

    async def get_sitemap_anchors_optimized(self, page_size: int = 50000, first_page_offset: int = 0) -> list[str]:
        """
        Fetch all sitemap page anchors in a single query using window functions.

        This is O(1) queries instead of O(n) where n = number of pages.
        Uses ROW_NUMBER() to identify page boundaries efficiently.

        Args:
            page_size: Number of URLs per sitemap page (default 50000)
            first_page_offset: Number of non-company URLs on page 1 (static routes + municipalities)

        Returns:
            List of orgnr values that start each page (page 2 onwards)
        """
        from sqlalchemy import text

        # Calculate the position of the last item on each page
        # Page 1 ends at position (page_size - first_page_offset)
        # Page 2 ends at position (page_size - first_page_offset + page_size)
        # etc.

        # We want the LAST orgnr of each page as the anchor for the NEXT page
        # Using modulo arithmetic to find page boundaries
        first_page_size = page_size - first_page_offset

        query = text("""
            WITH numbered AS (
                SELECT 
                    orgnr,
                    ROW_NUMBER() OVER (ORDER BY orgnr) as rn
                FROM bedrifter
            ),
            page_boundaries AS (
                SELECT 
                    orgnr,
                    rn,
                    CASE 
                        WHEN rn <= :first_page_size THEN 1
                        ELSE 1 + CEIL(CAST(rn - :first_page_size AS numeric) / CAST(:page_size AS numeric))
                    END as page_num
                FROM numbered
            )
            SELECT orgnr
            FROM page_boundaries
            WHERE rn = :first_page_size 
               OR (rn > :first_page_size AND MOD(rn - :first_page_size, :page_size) = 0)
            ORDER BY rn
        """)

        result = await self.db.execute(query, {"page_size": page_size, "first_page_size": first_page_size})
        return [row[0] for row in result]

    async def _get_all_with_financial_join(
        self,
        filters: FilterParams,
        skip: int,
        limit: int,
        sort_by: str,
        sort_order: str,
    ) -> list[CompanyWithFinancials]:
        """
        Query with financial join - used when filtering/sorting by financial data.
        Uses INNER JOIN so only companies with financial data are returned.
        """
        query = select(
            models.Company,
            *LATEST_FINANCIAL_COLUMNS,
        ).options(*LIST_VIEW_OPTIONS)

        query = query.join(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)

        query, _ = self._apply_filters_no_join(query, filters=filters)

        extended_sort_map = {
            **SORT_COLUMN_MAP,
            "revenue": models.LatestFinancials.salgsinntekter,
            "profit": models.LatestFinancials.aarsresultat,
            "operating_profit": models.LatestFinancials.driftsresultat,
            "operating_margin": models.LatestFinancials.operating_margin,
            "equity_ratio": models.LatestFinancials.egenkapitalandel,
        }
        sort_column = extended_sort_map.get(sort_by, models.Company.navn)

        # Apply stable ordering
        if sort_order == "desc":
            query = query.order_by(
                sort_column.desc().nullslast(),
                models.Company.stiftelsesdato.desc().nullslast(),
                models.Company.navn.asc(),
            )
        else:
            query = query.order_by(
                sort_column.asc().nullslast(),
                models.Company.stiftelsesdato.asc().nullslast(),
                models.Company.navn.asc(),
            )

        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            CompanyWithFinancials(
                company=row[0],
                latest_revenue=row[1],
                latest_profit=row[2],
                latest_operating_profit=row[3],
                latest_operating_margin=row[4],
                latest_equity_ratio=row[5],
            )
            for row in rows
        ]

    def _apply_filters_no_join(self, query: Select, filters: FilterParams) -> tuple[Select, bool]:
        """Apply filters using CompanyFilterBuilder (no financial join)."""
        builder = CompanyFilterBuilder(filters)
        builder.apply_all(include_financial=True)
        query = builder.apply_to_query(query)
        return query, builder.needs_financial_join

    def _apply_filters(self, query: Select, filters: FilterParams) -> tuple[Select, bool]:
        """Apply filters using CompanyFilterBuilder (with optional financial join)."""
        builder = CompanyFilterBuilder(filters)
        builder.apply_all(include_financial=False)

        if builder._has_financial_filters():
            query = query.join(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            builder.apply_financial_filters()

        query = builder.apply_to_query(query)
        return query, builder.needs_financial_join
