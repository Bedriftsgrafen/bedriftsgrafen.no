"""Query operations for companies.

Contains get_all, stream_all, and related query methods with optimization logic.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from repositories.company.base import (
    LIST_VIEW_OPTIONS,
    SORT_COLUMN_MAP,
    CompanyWithFinancials,
)
from repositories.company_filter_builder import CompanyFilterBuilder, FilterParams


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
        financial_filters_present = any(
            [
                filters.min_revenue,
                filters.max_revenue,
                filters.min_profit,
                filters.max_profit,
                filters.min_equity,
                filters.max_equity,
                filters.min_operating_profit,
                filters.max_operating_profit,
                filters.min_liquidity_ratio,
                filters.max_liquidity_ratio,
                filters.min_equity_ratio,
                filters.max_equity_ratio,
            ]
        )

        needs_financial_join_for_filter = financial_sort or financial_filters_present

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
                models.LatestFinancials.salgsinntekter.label("latest_revenue"),
                models.LatestFinancials.aarsresultat.label("latest_profit"),
                models.LatestFinancials.driftsresultat.label("latest_operating_profit"),
                models.LatestFinancials.operating_margin.label("latest_operating_margin"),
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
                base_query = base_query.order_by(sort_column_obj.desc().nullslast())
            else:
                base_query = base_query.order_by(sort_column_obj.asc().nullslast())

        base_query = base_query.limit(limit).offset(skip)

        result = await self.db.execute(base_query)
        rows = result.fetchall()
        orgnrs = [row[0] for row in rows]

        if not orgnrs:
            return []

        # Phase 2: Fetch full company data
        query = select(models.Company).options(*LIST_VIEW_OPTIONS).filter(models.Company.orgnr.in_(orgnrs))
        result = await self.db.execute(query)
        companies_dict = {c.orgnr: c for c in result.unique().scalars().all()}
        companies = [companies_dict[orgnr] for orgnr in orgnrs if orgnr in companies_dict]

        if not companies:
            return []

        # Phase 3: Get financial data
        fin_query = select(
            models.LatestFinancials.orgnr,
            models.LatestFinancials.salgsinntekter,
            models.LatestFinancials.aarsresultat,
            models.LatestFinancials.driftsresultat,
            models.LatestFinancials.operating_margin,
        ).filter(models.LatestFinancials.orgnr.in_(orgnrs))

        fin_result = await self.db.execute(fin_query)
        fin_data = {row[0]: (row[1], row[2], row[3], row[4]) for row in fin_result.all()}

        return [
            CompanyWithFinancials(
                company=c,
                latest_revenue=fin_data[c.orgnr][0] if c.orgnr in fin_data else None,
                latest_profit=fin_data[c.orgnr][1] if c.orgnr in fin_data else None,
                latest_operating_profit=fin_data[c.orgnr][2] if c.orgnr in fin_data else None,
                latest_operating_margin=fin_data[c.orgnr][3] if c.orgnr in fin_data else None,
            )
            for c in companies
        ]

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
            models.LatestFinancials.salgsinntekter.label("latest_revenue"),
            models.LatestFinancials.aarsresultat.label("latest_profit"),
            models.LatestFinancials.driftsresultat.label("latest_operating_profit"),
            models.LatestFinancials.operating_margin.label("latest_operating_margin"),
        ).options(*LIST_VIEW_OPTIONS)

        query = query.join(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)

        query, _ = self._apply_filters_no_join(query, filters=filters)

        extended_sort_map = {
            **SORT_COLUMN_MAP,
            "revenue": models.LatestFinancials.salgsinntekter,
            "profit": models.LatestFinancials.aarsresultat,
            "operating_profit": models.LatestFinancials.driftsresultat,
            "operating_margin": models.LatestFinancials.operating_margin,
        }
        sort_column = extended_sort_map.get(sort_by, models.Company.navn)

        if sort_order == "desc":
            query = query.order_by(sort_column.desc().nullslast())
        else:
            query = query.order_by(sort_column.asc().nullslast())

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
            )
            for row in rows
        ]

    def _apply_filters_no_join(self, query, filters: FilterParams):
        """Apply filters using CompanyFilterBuilder (no financial join)."""
        builder = CompanyFilterBuilder(filters)
        builder.apply_all(include_financial=True)
        query = builder.apply_to_query(query)
        return query, builder.needs_financial_join

    def _apply_filters(self, query, filters: FilterParams):
        """Apply filters using CompanyFilterBuilder (with optional financial join)."""
        builder = CompanyFilterBuilder(filters)
        builder.apply_all(include_financial=False)

        if builder._has_financial_filters():
            query = query.join(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            builder.apply_financial_filters()

        query = builder.apply_to_query(query)
        return query, builder.needs_financial_join
