"""Single-entity lookup methods for companies.

Contains get_by_orgnr, get_similar_companies, get_by_industry_code.
"""

import logging
from typing import Any

from sqlalchemy import and_, func, select, text
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

import models
from exceptions import CompanyNotFoundException, DatabaseException
from repositories.company.base import (
    DETAIL_VIEW_OPTIONS,
    LATEST_FINANCIAL_COLUMNS,
    CompanyWithFinancials,
)
from repositories.company_filter_builder import FilterParams

logger = logging.getLogger(__name__)


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

        Uses a single SQL query with prioritized UNION ALL for efficiency.
        Priority order:
        1. Exact NACE + same postal code
        2. Exact NACE + same kommune
        3. Same NACE prefix + same kommune
        4. Same NACE prefix, any location

        IMPORTANT: Uses ``= false`` (not ``IS FALSE``) in WHERE clauses to match
        the partial index predicates on idx_similar_postnummer, idx_similar_kommune,
        and idx_similar_nace_prefix.
        PostgreSQL requires exact predicate match for partial index eligibility.

        ORDER BY uses only ``antall_ansatte DESC NULLS LAST`` (no ``navn``) so
        PostgreSQL can satisfy the sort directly from the partial indexes without
        needing to fetch and sort additional columns.
        """
        # Guard: companies without NACE code cannot have meaningful "similar" results
        source_query = text("""
            SELECT naeringskode
            FROM bedrifter
            WHERE orgnr = :orgnr
        """)
        source_result = await self.db.execute(source_query, {"orgnr": orgnr})
        source_row = source_result.fetchone()
        if not source_row or not source_row[0]:
            return []

        # Single query: get source company data + all similar candidates via UNION ALL
        similar_query = text("""
            WITH source AS (
                SELECT
                    naeringskode,
                    UPPER(forretningsadresse->>'kommune') as kommune,
                    forretningsadresse->>'postnummer' as postnummer,
                    left(naeringskode, 3) as nace_prefix
                FROM bedrifter
                WHERE orgnr = :orgnr
            ),
            candidates AS (
                -- Priority 1: Exact NACE + same postnummer (uses idx_similar_postnummer)
                (SELECT b.orgnr, 1 as priority
                 FROM bedrifter b, source s
                 WHERE b.naeringskode = s.naeringskode
                   AND b.forretningsadresse->>'postnummer' = s.postnummer
                   AND b.orgnr != :orgnr
                   AND b.konkurs = false
                   AND b.under_avvikling = false
                   AND b.under_tvangsavvikling = false
                   AND s.postnummer IS NOT NULL AND s.postnummer != ''
                 ORDER BY b.antall_ansatte DESC NULLS LAST
                 LIMIT :lim)
                UNION ALL
                -- Priority 2: Exact NACE + same kommune (uses idx_similar_kommune)
                (SELECT b.orgnr, 2 as priority
                 FROM bedrifter b, source s
                 WHERE b.naeringskode = s.naeringskode
                   AND upper(b.forretningsadresse->>'kommune') = s.kommune
                   AND b.orgnr != :orgnr
                   AND b.konkurs = false
                   AND b.under_avvikling = false
                   AND b.under_tvangsavvikling = false
                   AND s.kommune IS NOT NULL AND s.kommune != ''
                 ORDER BY b.antall_ansatte DESC NULLS LAST
                 LIMIT :lim)
                UNION ALL
                -- Priority 3: Same NACE prefix + same kommune (uses idx_similar_kommune)
                (SELECT b.orgnr, 3 as priority
                 FROM bedrifter b, source s
                 WHERE left(b.naeringskode, 3) = s.nace_prefix
                   AND b.naeringskode != s.naeringskode
                   AND upper(b.forretningsadresse->>'kommune') = s.kommune
                   AND b.orgnr != :orgnr
                   AND b.konkurs = false
                   AND b.under_avvikling = false
                   AND b.under_tvangsavvikling = false
                   AND s.kommune IS NOT NULL AND s.kommune != ''
                 ORDER BY b.antall_ansatte DESC NULLS LAST
                 LIMIT :lim)
                UNION ALL
                -- Priority 4: Same NACE prefix, any location (uses idx_similar_nace_prefix)
                (SELECT b.orgnr, 4 as priority
                 FROM bedrifter b, source s
                 WHERE left(b.naeringskode, 3) = s.nace_prefix
                   AND b.orgnr != :orgnr
                   AND b.konkurs = false
                   AND b.under_avvikling = false
                   AND b.under_tvangsavvikling = false
                 ORDER BY b.antall_ansatte DESC NULLS LAST
                 LIMIT :lim)
            ),
            ranked AS (
                SELECT orgnr, priority,
                       ROW_NUMBER() OVER (
                           PARTITION BY orgnr
                           ORDER BY priority
                       ) as rn
                FROM candidates
            )
            SELECT orgnr FROM ranked
            WHERE rn = 1
            ORDER BY priority, orgnr
            LIMIT :lim
        """)

        result = await self.db.execute(similar_query, {"orgnr": orgnr, "lim": limit})
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

    async def count(self) -> int:
        """Get total company count."""
        result = await self.db.execute(select(func.count(models.Company.orgnr)))
        count = result.scalar()
        return count or 0

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
