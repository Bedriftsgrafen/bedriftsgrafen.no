"""Statistics and counting operations for companies.

Contains count_companies, get_aggregate_stats, and dashboard stat methods.
"""

from datetime import date, datetime
from typing import Any

from sqlalchemy import bindparam, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

import models
from repositories.company.base import logger
from repositories.company_filter_builder import CompanyFilterBuilder, FilterParams


class StatsMixin:
    """Mixin providing statistics operations for CompanyRepository."""

    db: AsyncSession  # Type hint for mixin

    async def count_companies(self, filters: FilterParams, sort_by: str = "navn") -> int:
        """
        Count companies matching filters.
        Uses optimized non-join query when no financial filters are present.
        Uses pre-computed counts for organisasjonsform-only filters.
        When sorting by financial fields, uses INNER JOIN to match listing behavior.
        """
        # Financial sort fields that require INNER JOIN
        financial_sort_fields = ("revenue", "profit", "operating_profit", "operating_margin")
        needs_financial_join = sort_by in financial_sort_fields
        
        # Fast path: no filters at all and no financial sort
        if filters.is_empty() and not needs_financial_join:
            return await self.count()

        # Fast path: only organisasjonsform filter - use pre-computed counts
        if filters.has_only_org_form_filter() and not needs_financial_join:
            try:
                stmt = text("SELECT COALESCE(SUM(count), 0) FROM orgform_counts WHERE kode IN :org_forms")
                stmt = stmt.bindparams(bindparam("org_forms", expanding=True))
                result = await self.db.execute(stmt, {"org_forms": filters.organisasjonsform})
                count = result.scalar()
                return int(count) if count else 0
            except Exception as e:
                logger.warning(f"Error in count optimization: {e}")

        query = select(func.count(models.Company.orgnr))

        if filters.has_financial_filters() or needs_financial_join:
            # INNER JOIN for financial sorting/filtering to match list query behavior
            query = query.join(
                models.LatestFinancials,
                models.Company.orgnr == models.LatestFinancials.orgnr
            )
            query, _ = self._apply_filters(query, filters=filters)
        else:
            query, _ = self._apply_filters_no_join(query, filters=filters)

        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_aggregate_stats(self, filters: FilterParams) -> dict[str, Any]:
        """
        Get aggregate statistics for companies matching filters.
        Returns total count, sum of revenue/profit/employees, and organisation form breakdown.

        Uses company_totals materialized view for instant unfiltered stats.
        """
        try:
            # Fast path: no filters - use materialized view
            if filters.is_empty():
                try:
                    async with self.db.begin_nested():
                        result = await self.db.execute(text("SELECT * FROM company_totals"))
                        row = result.fetchone()
                        if row:
                            breakdown_result = await self.db.execute(
                                text("SELECT kode, count FROM orgform_counts ORDER BY count DESC LIMIT 5")
                            )
                            breakdown = [{"form": r[0], "count": r[1]} for r in breakdown_result.fetchall()]

                            return {
                                "total_count": int(row[0]) if row[0] else 0,
                                "total_revenue": float(row[1]) if row[1] else 0.0,
                                "total_profit": float(row[2]) if row[2] else 0.0,
                                "total_employees": int(row[3]) if row[3] else 0,
                                "by_organisasjonsform": breakdown,
                            }
                except Exception as e:
                    logger.warning(f"Materialized view query failed, falling back: {e}")

            # Regular query
            query = (
                select(
                    func.count().label("total_count"),
                    func.sum(func.coalesce(models.LatestFinancials.salgsinntekter, 0)).label("total_revenue"),
                    func.sum(func.coalesce(models.LatestFinancials.aarsresultat, 0)).label("total_profit"),
                    func.sum(func.coalesce(models.Company.antall_ansatte, 0)).label("total_employees"),
                )
                .select_from(models.Company)
                .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            )

            builder = CompanyFilterBuilder(filters)
            builder.apply_all(include_financial=True)
            query = builder.apply_to_query(query)

            result = await self.db.execute(query)
            row = result.fetchone()

            total_stats = {
                "total_count": row[0] if row else 0,
                "total_revenue": float(row[1]) if row and row[1] else 0.0,
                "total_profit": float(row[2]) if row and row[2] else 0.0,
                "total_employees": int(row[3]) if row and row[3] else 0,
            }

            # Organisation form breakdown
            group_query = (
                select(models.Company.organisasjonsform, func.count())
                .select_from(models.Company)
                .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
                .group_by(models.Company.organisasjonsform)
                .order_by(func.count().desc())
                .limit(5)
            )

            group_query = builder.apply_to_query(group_query)
            group_result = await self.db.execute(group_query)
            breakdown = [{"form": r[0], "count": r[1]} for r in group_result.fetchall()]

            total_stats["by_organisasjonsform"] = breakdown
            return total_stats

        except Exception as e:
            logger.error(f"Error getting aggregate stats: {e}")
            return {
                "total_count": 0,
                "total_revenue": 0.0,
                "total_profit": 0.0,
                "total_employees": 0,
                "by_organisasjonsform": [],
            }

    async def count(self) -> int:
        """Count all companies using actual COUNT."""
        result = await self.db.execute(text("SELECT COUNT(*) FROM bedrifter"))
        count = result.scalar()
        return int(count) if count else 0

    async def get_total_employees(self) -> int:
        """Get total employees from pre-computed stats table."""
        try:
            result = await self.db.execute(text("SELECT total_employees FROM dashboard_stats WHERE id = 1"))
            count = result.scalar()
            return int(count) if count else 0
        except Exception:
            result = await self.db.execute(select(func.sum(models.Company.antall_ansatte)))
            count = result.scalar()
            return int(count) if count else 0

    async def get_new_companies_ytd(self) -> int:
        """Get new companies year-to-date from pre-computed stats table."""
        try:
            result = await self.db.execute(text("SELECT new_companies_ytd FROM dashboard_stats WHERE id = 1"))
            count = result.scalar()
            return int(count) if count else 0
        except Exception:
            current_year = datetime.now().year
            start_date = date(current_year, 1, 1)
            result = await self.db.execute(
                select(func.count(models.Company.orgnr)).filter(
                    models.Company.stiftelsesdato >= start_date,
                    models.Company.organisasjonsform != "KBO",
                )
            )
            count = result.scalar()
            return int(count) if count else 0

    async def get_bankruptcies_count(self) -> int:
        """Get bankruptcies count from pre-computed stats table."""
        try:
            result = await self.db.execute(text("SELECT bankruptcies FROM dashboard_stats WHERE id = 1"))
            count = result.scalar()
            return int(count) if count else 0
        except Exception:
            result = await self.db.execute(
                select(func.count(models.Company.orgnr)).filter(models.Company.konkurs)
            )
            count = result.scalar()
            return int(count) if count else 0
