"""Statistics and counting operations for companies.

Contains count_companies, get_aggregate_stats, and dashboard stat methods.
"""

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import bindparam, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

import models
from exceptions import DatabaseException
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

        # Fast path 1: no filters at all and no financial sort - Use O(1) materialized view
        if filters.is_empty() and not needs_financial_join:
            try:
                result = await self.db.execute(text("SELECT total_count FROM company_totals WHERE id = 1"))
                count = result.scalar()
                if count is not None:
                    return int(count)
            except Exception as e:
                logger.warning(f"Error in count O(1) optimization: {e}")

            # Fallback to standard count
            return await self.count()

        # Fast path 2: only organisasjonsform filter - use pre-computed counts
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
            query = query.join(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            query, _ = self._apply_filters(query, filters=filters)  # type: ignore[attr-defined]  # mixin method on CompanyRepository
        else:
            query, _ = self._apply_filters_no_join(query, filters=filters)  # type: ignore[attr-defined]  # mixin method on CompanyRepository

        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_aggregate_stats(self, filters: FilterParams, sort_by: str | None = None) -> dict[str, Any]:
        """
        Get aggregate statistics for companies matching filters.
        Returns total count, sum of revenue/profit/employees, and organisation form breakdown.

        Uses company_totals materialized view for instant unfiltered stats.
        Runs aggregate + breakdown queries concurrently for filtered requests.
        """
        try:
            # Financial sort fields that require INNER JOIN
            financial_sort_fields = ("revenue", "profit", "operating_profit", "operating_margin")
            needs_financial_join = (sort_by in financial_sort_fields) or filters.has_financial_filters()

            # Fast path: no filters and no financial join requirements
            if filters.is_empty() and not needs_financial_join:
                try:
                    # Removed begin_nested() for sub-millisecond read-only SELECT
                    result = await self.db.execute(text("SELECT * FROM company_totals WHERE id = 1"))
                    row = result.fetchone()
                    if row:
                        # Extract row data handle both tuple and mapping
                        data = row._asdict() if hasattr(row, "_asdict") else dict(row._mapping)

                        breakdown_result = await self.db.execute(
                            text("SELECT kode as form, count FROM orgform_counts ORDER BY count DESC LIMIT 5")
                        )
                        breakdown = [dict(r._mapping) for r in breakdown_result.fetchall()]
                        return {
                            "total_count": int(data.get("total_count", 0)),
                            "total_revenue": float(data.get("total_revenue", 0.0)),
                            "total_profit": float(data.get("total_profit", 0.0)),
                            "total_employees": int(data.get("total_employees", 0)),
                            "geocoded_count": int(data.get("geocoded_count", 0)),
                            "new_companies_30d": int(data.get("new_companies_30d", 0)),
                            "total_roles": int(data.get("total_roles", 0)),
                            "by_organisasjonsform": breakdown,
                        }
                except Exception as e:
                    logger.warning(f"Materialized view query failed, falling back: {e}")

            # Regular filtered query — build filters once, reuse for both queries
            builder = CompanyFilterBuilder(filters)
            builder.apply_all(include_financial=True)

            # Query 1: Aggregation (count, revenue, profit, employees)
            agg_query = select(
                func.count().label("total_count"),
                func.sum(func.coalesce(models.LatestFinancials.salgsinntekter, 0)).label("total_revenue"),
                func.sum(func.coalesce(models.LatestFinancials.aarsresultat, 0)).label("total_profit"),
                func.sum(func.coalesce(models.Company.antall_ansatte, 0)).label("total_employees"),
            )

            # Query 2: Organisation form breakdown
            group_query = (
                select(models.Company.organisasjonsform.label("form"), func.count().label("count"))
                .select_from(models.Company)
                .group_by(models.Company.organisasjonsform)
                .order_by(func.count().desc())
                .limit(5)
            )

            # Apply join strategy to both queries
            if needs_financial_join:
                agg_query = agg_query.select_from(models.Company).join(
                    models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr
                )
                group_query = group_query.join(
                    models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr
                )
            else:
                agg_query = agg_query.select_from(models.Company).outerjoin(
                    models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr
                )
                group_query = group_query.outerjoin(
                    models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr
                )

            # Apply filters to both
            agg_query = builder.apply_to_query(agg_query)
            group_query = builder.apply_to_query(group_query)

            # Execute both queries (sequentially — same session constraint)
            result = await self.db.execute(agg_query)
            row = result.fetchone()

            total_stats = {
                "total_count": row[0] if row else 0,
                "total_revenue": float(row[1]) if row and row[1] else 0.0,
                "total_profit": float(row[2]) if row and row[2] else 0.0,
                "total_employees": int(row[3]) if row and row[3] else 0,
            }

            group_result = await self.db.execute(group_query)
            breakdown = [{"form": r[0], "count": r[1]} for r in group_result.fetchall()]

            total_stats["by_organisasjonsform"] = breakdown
            return total_stats

        except Exception as e:
            logger.error("stats.fallback path=aggregate error=%s", e, exc_info=True)
            raise DatabaseException("Failed to get aggregate stats", original_error=e)

    async def count(self, fast: bool = False) -> int:
        """
        Count all companies.
        If fast=True, uses company_totals materialized view for instant results.
        Falls back to pg_class estimate if view fails.
        """
        try:
            result = await self.db.execute(text("SELECT total_count FROM company_totals WHERE id = 1"))
            count = result.scalar()
            if count is not None:
                return int(count)
        except Exception as e:
            logger.warning(f"company_totals count failed: {e}")

        if fast:
            try:
                result = await self.db.execute(
                    text("SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname='bedrifter'")
                )
                count = result.scalar()
                if count and count > 0:
                    return int(count)
            except Exception as e:
                logger.warning(f"Fast count estimate failed: {e}")

        # Fallback to actual COUNT(*)
        result = await self.db.execute(text("SELECT COUNT(*) FROM bedrifter"))
        count = result.scalar()
        return int(count) if count else 0

    async def get_total_employees(self) -> int:
        """Get total employees from pre-computed stats table."""
        try:
            result = await self.db.execute(text("SELECT total_employees FROM dashboard_stats WHERE id = 1"))
            count = result.scalar()
            return int(count) if count else 0
        except Exception as e:
            logger.warning(f"Dashboard stats fallback for total_employees: {e}")
            result = await self.db.execute(select(func.sum(models.Company.antall_ansatte)))
            count = result.scalar()
            return int(count) if count else 0

    async def get_new_companies_ytd(self) -> int:
        """Get new companies year-to-date from pre-computed stats table."""
        try:
            result = await self.db.execute(text("SELECT new_companies_ytd FROM dashboard_stats WHERE id = 1"))
            count = result.scalar()
            return int(count) if count else 0
        except Exception as e:
            logger.warning(f"Dashboard stats fallback for new_companies_ytd: {e}")
            current_year = datetime.now(UTC).year
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
        except Exception as e:
            logger.warning(f"Dashboard stats fallback for bankruptcies: {e}")
            result = await self.db.execute(select(func.count(models.Company.orgnr)).filter(models.Company.konkurs))
            count = result.scalar()
            return int(count) if count else 0

    async def get_geocoded_count(self) -> int:
        """
        Get count of geocoded companies.
        Optimized to hit idx_bedrifter_geocoded index.
        """
        try:
            # Explicit SQL to ensure we hit the partial index with IS NOT NULL
            stmt = text("SELECT COUNT(orgnr) FROM bedrifter WHERE latitude IS NOT NULL")
            result = await self.db.execute(stmt)
            count = result.scalar()
            return int(count) if count else 0
        except Exception as e:
            logger.error(f"Error counting geocoded companies: {e}")
            return 0

    async def get_new_companies_30d(self) -> int:
        """Get number of new companies in the last 30 days."""
        try:
            from datetime import timedelta

            start_date = datetime.now(UTC).date() - timedelta(days=30)
            result = await self.db.execute(
                select(func.count(models.Company.orgnr)).filter(
                    models.Company.stiftelsesdato >= start_date, models.Company.organisasjonsform != "KBO"
                )
            )
            count = result.scalar()
            return int(count) if count else 0
        except Exception as e:
            logger.error(f"Error counting new companies (30d): {e}")
            return 0
