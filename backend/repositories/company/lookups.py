"""Single-entity lookup methods for companies.

Contains get_by_orgnr, get_similar_companies, get_by_industry_code.
"""

import logging
from typing import Any

from sqlalchemy import and_, select, text
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import TextClause

import models
from exceptions import CompanyNotFoundException, DatabaseException
from repositories.company.base import (
    DETAIL_VIEW_OPTIONS,
    LATEST_FINANCIAL_COLUMNS,
    CompanyWithFinancials,
)
from repositories.company_filter_builder import FilterParams

logger = logging.getLogger(__name__)


def _build_similar_sql(*, has_postnummer: bool, has_kommune: bool) -> TextClause:
    """Build the UNION ALL candidates query for get_similar_companies.

    Builds only the sub-queries applicable to the source company's available
    location fields. Omitting sub-queries that would use None bind params
    prevents asyncpg type errors on '->>' equality comparisons.

    Priorities included per combination:
    - Both available:   1 (postnummer), 2 (naeringskode+kommune), 3 (prefix+kommune), 4 (prefix)
    - Kommune only:     2, 3, 4
    - Postnummer only:  1, 4
    - Neither:          4
    """
    parts: list[str] = []

    if has_postnummer:
        parts.append(
            """\n            (SELECT b.orgnr, 1 AS priority
             FROM bedrifter b
             WHERE b.naeringskode = :naeringskode
               AND b.forretningsadresse->>'postnummer' = :postnummer
               AND b.orgnr != :orgnr
               AND b.konkurs = false
               AND b.under_avvikling = false
               AND b.under_tvangsavvikling = false
             ORDER BY b.antall_ansatte DESC NULLS LAST
             LIMIT :lim)"""
        )

    if has_kommune:
        parts.append(
            """\n            (SELECT b.orgnr, 2 AS priority
             FROM bedrifter b
             WHERE b.naeringskode = :naeringskode
               AND upper(b.forretningsadresse->>'kommune') = :kommune
               AND b.orgnr != :orgnr
               AND b.konkurs = false
               AND b.under_avvikling = false
               AND b.under_tvangsavvikling = false
             ORDER BY b.antall_ansatte DESC NULLS LAST
             LIMIT :lim)"""
        )
        parts.append(
            """\n            (SELECT b.orgnr, 3 AS priority
             FROM bedrifter b
             WHERE left(b.naeringskode, 3) = :nace_prefix
               AND b.naeringskode != :naeringskode
               AND upper(b.forretningsadresse->>'kommune') = :kommune
               AND b.orgnr != :orgnr
               AND b.konkurs = false
               AND b.under_avvikling = false
               AND b.under_tvangsavvikling = false
             ORDER BY b.antall_ansatte DESC NULLS LAST
             LIMIT :lim)"""
        )

    # Priority 4: always included
    parts.append(
        """\n            (SELECT b.orgnr, 4 AS priority
             FROM bedrifter b
             WHERE left(b.naeringskode, 3) = :nace_prefix
               AND b.orgnr != :orgnr
               AND b.konkurs = false
               AND b.under_avvikling = false
               AND b.under_tvangsavvikling = false
             ORDER BY b.antall_ansatte DESC NULLS LAST
             LIMIT :lim)"""
    )

    union_all = "\n                UNION ALL".join(parts)
    sql = (
        "\n        WITH candidates AS ("  # noqa: S608 - hardcoded SQL fragments only, no user input
        + union_all
        + "\n        ),"
        "\n        ranked AS ("
        "\n            SELECT orgnr, priority,"
        "\n                   ROW_NUMBER() OVER ("
        "\n                       PARTITION BY orgnr"
        "\n                       ORDER BY priority"
        "\n                   ) AS rn"
        "\n            FROM candidates"
        "\n        )"
        "\n        SELECT orgnr FROM ranked"
        "\n        WHERE rn = 1"
        "\n        ORDER BY priority, orgnr"
        "\n        LIMIT :lim"
    )
    return text(sql)


class LookupsMixin:
    """Mixin providing lookup operations for CompanyRepository."""

    db: AsyncSession  # Type hint for mixin

    async def get_by_orgnr(self, orgnr: str) -> models.Company:
        """Get company by organization number."""
        try:
            result = await self.db.execute(
                select(models.Company).options(*DETAIL_VIEW_OPTIONS).filter(models.Company.orgnr == orgnr)
            )
            company = result.scalar_one_or_none()

            if not company:
                raise CompanyNotFoundException(orgnr)

            return company
        except CompanyNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Database error fetching company {orgnr}: {e}")
            raise DatabaseException(f"Failed to fetch company {orgnr}", original_error=e)

    async def get_company_name(self, orgnr: str) -> str | None:
        """Fetch only the name of a company or subunit by its orgnr. Highly efficient."""
        try:
            # First try company table
            result = await self.db.execute(select(models.Company.navn).filter(models.Company.orgnr == orgnr))
            name = result.scalar_one_or_none()
            if name:
                return name

            # Fallback to subunit table
            result = await self.db.execute(select(models.SubUnit.navn).filter(models.SubUnit.orgnr == orgnr))
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Database error fetching company/subunit name {orgnr}: {e}")
            return None

    async def get_existing_orgnrs(self, orgnrs: list[str]) -> set[str]:
        """Check which of the given orgnrs exist in the database.

        Args:
            orgnrs: List of organization numbers to check

        Returns:
            Set of existing organization numbers
        """
        if not orgnrs:
            return set()

        try:
            stmt = select(models.Company.orgnr).where(models.Company.orgnr.in_(orgnrs))
            result = await self.db.execute(stmt)
            return {row[0] for row in result.fetchall()}
        except Exception as e:
            logger.error(f"Database error checking existing orgnrs: {e}")
            return set()

    async def get_similar_companies(self, orgnr: str, limit: int = 5) -> list[CompanyWithFinancials]:
        """Find similar companies based on industry (naeringskode) and location.

        Uses a two-step approach for index-friendly query plans:
        1. Fetch source company fields (naeringskode, kommune, postnummer) in Python.
        2. Pass them as literal bind parameters to the candidates query so PostgreSQL
           can use partial indexes directly (idx_similar_postnummer, idx_similar_kommune,
           idx_similar_nace_prefix) rather than falling back to a full table scan via a
           CTE join.

        Priority order:
        1. Exact NACE + same postal code
        2. Exact NACE + same kommune
        3. Same NACE prefix + same kommune
        4. Same NACE prefix, any location

        IMPORTANT: Uses ``= false`` (not ``IS FALSE``) in WHERE clauses to match
        the partial index predicates.
        PostgreSQL requires exact predicate match for partial index eligibility.

        ORDER BY uses only ``antall_ansatte DESC NULLS LAST`` (no ``navn``) so
        PostgreSQL can satisfy the sort directly from the partial indexes without
        needing to fetch and sort additional columns.
        """
        try:
            # Step 1: Fetch source company fields in Python so candidates query gets
            # literal constants — this lets PostgreSQL pick the partial indexes.
            source_query = text("""
                SELECT
                    naeringskode,
                    UPPER(forretningsadresse->>'kommune') AS kommune,
                    forretningsadresse->>'postnummer'      AS postnummer
                FROM bedrifter
                WHERE orgnr = :orgnr
            """)
            source_result = await self.db.execute(source_query, {"orgnr": orgnr})
            source_row = source_result.fetchone()
            if not source_row or not source_row[0]:
                return []

            naeringskode: str = source_row[0]
            kommune: str | None = source_row[1] or None
            postnummer: str | None = source_row[2] or None
            nace_prefix: str = naeringskode[:3]

            # Step 2: Build candidates query via helper — only includes sub-queries for
            # available location fields so no None bind params reach asyncpg.
            similar_query = _build_similar_sql(has_postnummer=bool(postnummer), has_kommune=bool(kommune))
            params: dict[str, Any] = {
                "orgnr": orgnr,
                "naeringskode": naeringskode,
                "nace_prefix": nace_prefix,
                "lim": limit,
            }
            if postnummer:
                params["postnummer"] = postnummer
            if kommune:
                params["kommune"] = kommune

            result = await self.db.execute(similar_query, params)
            similar_orgnrs = [row[0] for row in result.fetchall()]

            if not similar_orgnrs:
                return []

            # Fetch full company objects with financials
            companies_query = (
                select(
                    models.Company,
                    *LATEST_FINANCIAL_COLUMNS,
                )
                .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
                .filter(models.Company.orgnr.in_(similar_orgnrs))
            )

            result = await self.db.execute(companies_query)
            rows = result.all()
            companies_dict = {
                row[0].orgnr: CompanyWithFinancials(
                    company=row[0],
                    latest_revenue=row[1],
                    latest_profit=row[2],
                    latest_operating_profit=row[3],
                    latest_operating_margin=row[4],
                    latest_equity_ratio=row[5],
                )
                for row in rows
            }

            return [companies_dict[o] for o in similar_orgnrs if o in companies_dict]
        except DatabaseException:
            raise
        except Exception as e:
            logger.error(f"Database error fetching similar companies for {orgnr}: {e}")
            raise DatabaseException(f"Failed to fetch similar companies for {orgnr}", original_error=e)

    async def get_by_industry_code(
        self, nace_code: str, limit: int = 20, offset: int = 0, include_inactive: bool = False
    ) -> tuple[list[CompanyWithFinancials], int]:
        """Fetch companies by NACE industry code with prefix matching.

        Args:
            nace_code: NACE code (e.g., "62.010" for exact, "62" for all 62.xxx)
            limit: Maximum number of results
            offset: Pagination offset
            include_inactive: Include companies in bankruptcy/liquidation

        Returns:
            Tuple of (list of companies, total count)

        Raises:
            DatabaseException: If query fails
        """
        try:
            # Build WHERE clauses
            where_clauses = ["naeringskode LIKE :nace_pattern"]
            params: dict[str, Any] = {"nace_pattern": f"{nace_code}%", "limit": limit, "offset": offset}

            if not include_inactive:
                where_clauses.extend(
                    ["konkurs IS NOT TRUE", "under_avvikling IS NOT TRUE", "under_tvangsavvikling IS NOT TRUE"]
                )

            where_sql = " AND ".join(where_clauses)

            # Query 1: Fast COUNT using naeringskode index (where_sql is built from hardcoded clauses)
            count_query = text(f"""
                SELECT COUNT(*)
                FROM bedrifter
                WHERE {where_sql}
            """)  # noqa: S608
            count_result = await self.db.execute(count_query, {"nace_pattern": f"{nace_code}%"})
            total_count = count_result.scalar() or 0

            if total_count == 0:
                return [], 0

            # Query 2: Get orgnrs with pagination (where_sql is built from hardcoded clauses)
            orgnr_query = text(f"""
                SELECT orgnr
                FROM bedrifter
                WHERE {where_sql}
                ORDER BY antall_ansatte DESC NULLS LAST
                LIMIT :limit OFFSET :offset
            """)  # noqa: S608
            result = await self.db.execute(orgnr_query, params)
            rows = result.fetchall()

            if not rows:
                return [], total_count

            # Extract orgnrs
            orgnrs = [row[0] for row in rows]

            # Phase 2: Fetch full company data for these orgnrs with financials
            companies_query = (
                select(
                    models.Company,
                    *LATEST_FINANCIAL_COLUMNS,
                )
                .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
                .filter(models.Company.orgnr.in_(orgnrs))
            )

            result = await self.db.execute(companies_query)
            rows = result.all()
            companies_dict = {
                row[0].orgnr: CompanyWithFinancials(
                    company=row[0],
                    latest_revenue=row[1],
                    latest_profit=row[2],
                    latest_operating_profit=row[3],
                    latest_operating_margin=row[4],
                    latest_equity_ratio=row[5],
                )
                for row in rows
            }

            # Preserve ordering from orgnr query
            companies = [companies_dict[orgnr] for orgnr in orgnrs if orgnr in companies_dict]

            return companies, total_count

        except Exception as e:
            logger.error(f"Database error fetching industry {nace_code}: {e}")
            raise DatabaseException(f"Failed to fetch companies for industry {nace_code}", original_error=e)

    async def get_company_with_latest_financials(self, orgnr: str) -> tuple[models.LatestFinancials | None, int | None]:
        """
        Fetch company's latest financials and employee count in a single joined query.
        Used for benchmarking.
        """
        query = (
            select(models.LatestFinancials, models.Company.antall_ansatte)
            .select_from(models.Company)
            .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            .where(models.Company.orgnr == orgnr)
        )

        result = await self.db.execute(query)
        row = result.first()

        if row:
            return row[0], row[1]
        return None, None

    async def get_map_markers(
        self,
        filters: FilterParams,
        bbox: tuple[float, float, float, float] | None = None,
        limit: int = 5000,
    ) -> tuple[list[tuple], int]:
        """Get companies with coordinates for map display.

        Args:
            filters: Filter parameters (NACE, org form, revenue, employees, status, dates, etc.)
            bbox: Optional bounding box as (west, south, east, north)
            limit: Maximum number of markers to return

        Returns:
            Tuple of (list of marker tuples, total count)
            Each marker tuple: (orgnr, navn, latitude, longitude, naeringskode, antall_ansatte)
        """
        from repositories.company_filter_builder import CompanyFilterBuilder

        builder = CompanyFilterBuilder(filters)
        # Apply all filters including financials, status, dates, etc.
        builder.apply_all(include_financial=True)

        # Build query
        query = select(
            models.Company.orgnr,
            models.Company.navn,
            models.Company.latitude,
            models.Company.longitude,
            models.Company.naeringskode,
            models.Company.antall_ansatte,
        ).where(
            and_(
                models.Company.latitude.isnot(None),
                models.Company.longitude.isnot(None),
            )
        )

        # Join with financials if needed by filter builder
        if builder.needs_financial_join:
            query = query.outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)

        # Apply bounding box
        if bbox:
            west, south, east, north = bbox
            query = query.where(
                and_(
                    models.Company.longitude >= west,
                    models.Company.longitude <= east,
                    models.Company.latitude >= south,
                    models.Company.latitude <= north,
                )
            )

        # Apply accumulated filters from builder
        query = builder.apply_to_query(query)

        # Fetch limit + 1 to check for truncation without an expensive COUNT(*) subquery
        # This saves a full scan of the filtered 1.1M row dataset.
        result = await self.db.execute(query.limit(limit + 1))
        rows = list(result.all())

        total = len(rows)
        # If we got limit + 1, it means there are more results available
        # The router uses (total > limit) to set the 'truncated' flag.
        return [tuple(r) for r in rows[:limit]], total

    async def get_company_og_data(self, orgnr: str) -> Row | None:
        """Fetch minimal data needed for OG image generation efficiently."""
        query = (
            select(
                models.Company.navn,
                models.Company.naeringskode,
                models.Company.antall_ansatte,
                models.LatestFinancials.salgsinntekter,
                models.LatestFinancials.aarsresultat,
            )
            .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            .where(models.Company.orgnr == orgnr)
        )
        result = await self.db.execute(query)
        return result.first()
