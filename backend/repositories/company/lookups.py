"""Single-entity lookup methods for companies.

Contains get_by_orgnr, get_similar_companies, get_by_industry_code.
"""

import logging
from typing import Any

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer

import models
from exceptions import CompanyNotFoundException, DatabaseException
from repositories.company.base import DETAIL_VIEW_OPTIONS

logger = logging.getLogger(__name__)


class LookupsMixin:
    """Mixin providing lookup operations for CompanyRepository."""

    db: AsyncSession  # Type hint for mixin

    async def get_by_orgnr(self, orgnr: str) -> models.Company:
        """Get company by organization number.

        Args:
            orgnr: Organization number

        Returns:
            Company model

        Raises:
            CompanyNotFoundException: If company not found
            DatabaseException: If database error occurs
        """
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

    async def get_similar_companies(self, orgnr: str, limit: int = 5) -> list[models.Company]:
        """Find similar companies based on industry (naeringskode) and location.

        Priority order (uses short-circuit queries for efficiency):
        1. Exact NACE + same postal code
        2. Exact NACE + same kommune
        3. Same NACE prefix + same kommune
        4. Same NACE prefix, any location
        """
        # Get source company data
        source_query = text("""
            SELECT
                naeringskode,
                UPPER(forretningsadresse->>'kommune') as kommune,
                forretningsadresse->>'postnummer' as postnummer
            FROM bedrifter
            WHERE orgnr = :orgnr
        """)
        result = await self.db.execute(source_query, {"orgnr": orgnr})
        source = result.fetchone()

        if not source or not source.naeringskode:
            return []

        naeringskode = source.naeringskode
        naeringskode_prefix = naeringskode[:3] if len(naeringskode) >= 3 else naeringskode
        kommune = source.kommune or ""
        postnummer = source.postnummer or ""

        similar_orgnrs: list[Any] = []

        # Priority 1: Exact NACE + same postnummer
        if postnummer and len(similar_orgnrs) < limit:
            remaining = limit - len(similar_orgnrs)

            stmt = (
                select(models.Company.orgnr)
                .where(
                    models.Company.naeringskode == naeringskode,
                    models.Company.forretningsadresse["postnummer"].astext == postnummer,
                    models.Company.orgnr != orgnr,
                    models.Company.konkurs.is_(False),
                    models.Company.under_avvikling.is_(False),
                    models.Company.under_tvangsavvikling.is_(False),
                )
                .order_by(models.Company.antall_ansatte.desc().nullslast(), models.Company.navn.asc())
                .limit(remaining)
            )

            result = await self.db.execute(stmt)
            similar_orgnrs.extend(row[0] for row in result.fetchall())

        # Priority 2: Exact NACE + same kommune
        if kommune and len(similar_orgnrs) < limit:
            remaining = limit - len(similar_orgnrs)

            stmt = select(models.Company.orgnr).where(
                models.Company.naeringskode == naeringskode,
                func.upper(models.Company.forretningsadresse["kommune"].astext) == kommune,
                models.Company.orgnr != orgnr,
                models.Company.konkurs.is_(False),
                models.Company.under_avvikling.is_(False),
                models.Company.under_tvangsavvikling.is_(False),
            )

            if similar_orgnrs:
                stmt = stmt.where(models.Company.orgnr.notin_(similar_orgnrs))

            stmt = stmt.order_by(models.Company.antall_ansatte.desc().nullslast(), models.Company.navn.asc()).limit(
                remaining
            )

            result = await self.db.execute(stmt)
            similar_orgnrs.extend(row[0] for row in result.fetchall())

        # Priority 3: Same NACE prefix + same kommune
        if kommune and len(similar_orgnrs) < limit:
            remaining = limit - len(similar_orgnrs)

            stmt = select(models.Company.orgnr).where(
                func.left(models.Company.naeringskode, 3) == naeringskode_prefix,
                models.Company.naeringskode != naeringskode,
                func.upper(models.Company.forretningsadresse["kommune"].astext) == kommune,
                models.Company.orgnr != orgnr,
                models.Company.konkurs.is_(False),
                models.Company.under_avvikling.is_(False),
                models.Company.under_tvangsavvikling.is_(False),
            )

            if similar_orgnrs:
                stmt = stmt.where(models.Company.orgnr.notin_(similar_orgnrs))

            stmt = stmt.order_by(models.Company.antall_ansatte.desc().nullslast(), models.Company.navn.asc()).limit(
                remaining
            )

            result = await self.db.execute(stmt)
            similar_orgnrs.extend(row[0] for row in result.fetchall())

        # Priority 4: Same NACE prefix, any location
        if len(similar_orgnrs) < limit:
            remaining = limit - len(similar_orgnrs)

            stmt = select(models.Company.orgnr).where(
                func.left(models.Company.naeringskode, 3) == naeringskode_prefix,
                models.Company.orgnr != orgnr,
                models.Company.konkurs.is_(False),
                models.Company.under_avvikling.is_(False),
                models.Company.under_tvangsavvikling.is_(False),
            )

            if similar_orgnrs:
                stmt = stmt.where(models.Company.orgnr.notin_(similar_orgnrs))

            stmt = stmt.order_by(models.Company.antall_ansatte.desc().nullslast(), models.Company.navn.asc()).limit(
                remaining
            )

            result = await self.db.execute(stmt)
            similar_orgnrs.extend(row[0] for row in result.fetchall())

        if not similar_orgnrs:
            return []

        # Fetch full company objects
        companies_query = (
            select(models.Company)
            .options(defer(models.Company.search_vector))
            .filter(models.Company.orgnr.in_(similar_orgnrs))
        )

        result = await self.db.execute(companies_query)
        companies_dict = {c.orgnr: c for c in result.scalars().all()}

        return [companies_dict[o] for o in similar_orgnrs if o in companies_dict]

    async def get_by_industry_code(
        self, nace_code: str, limit: int = 20, offset: int = 0, include_inactive: bool = False
    ) -> tuple[list[models.Company], int]:
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

            # Query 1: Fast COUNT using naeringskode index
            count_query = text(f"""
                SELECT COUNT(*)
                FROM bedrifter
                WHERE {where_sql}
            """)
            count_result = await self.db.execute(count_query, {"nace_pattern": f"{nace_code}%"})
            total_count = count_result.scalar() or 0

            if total_count == 0:
                return [], 0

            # Query 2: Get orgnrs with pagination
            orgnr_query = text(f"""
                SELECT orgnr
                FROM bedrifter
                WHERE {where_sql}
                ORDER BY antall_ansatte DESC NULLS LAST
                LIMIT :limit OFFSET :offset
            """)
            result = await self.db.execute(orgnr_query, params)
            rows = result.fetchall()

            if not rows:
                return [], total_count

            # Extract orgnrs
            orgnrs = [row[0] for row in rows]

            # Phase 2: Fetch full company data for these orgnrs
            companies_query = (
                select(models.Company)
                .options(defer(models.Company.search_vector), defer(models.Company.raw_data))
                .filter(models.Company.orgnr.in_(orgnrs))
            )

            result = await self.db.execute(companies_query)
            companies_dict = {c.orgnr: c for c in result.scalars().all()}

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
        naeringskode: str | None = None,
        county: str | None = None,
        municipality: str | None = None,
        municipality_code: str | None = None,
        bbox: tuple[float, float, float, float] | None = None,
        limit: int = 5000,
        organisasjonsform: list[str] | None = None,
        min_revenue: float | None = None,
        max_revenue: float | None = None,
        min_employees: int | None = None,
        max_employees: int | None = None,
    ) -> tuple[list[tuple], int]:
        """Get companies with coordinates for map display.

        Args:
            naeringskode: Optional NACE code prefix to filter by
            county: Optional county code (2-digit kommunenummer prefix)
            municipality: Optional municipality name (case-insensitive)
            municipality_code: Optional 4-digit municipality code
            bbox: Optional bounding box as (west, south, east, north)
            limit: Maximum number of markers to return
            organisasjonsform: Optional list of organization forms
            min_revenue: Optional min revenue (MNOK)
            max_revenue: Optional max revenue (MNOK)
            min_employees: Optional min employees
            max_employees: Optional max employees

        Returns:
            Tuple of (list of marker tuples, total count)
            Each marker tuple: (orgnr, navn, latitude, longitude, naeringskode, antall_ansatte)
        """
        from repositories.company_filter_builder import CompanyFilterBuilder, FilterParams

        # Construct FilterParams
        filters = FilterParams(
            naeringskode=naeringskode,
            organisasjonsform=organisasjonsform,
            min_revenue=min_revenue,
            max_revenue=max_revenue,
            min_employees=min_employees,
            max_employees=max_employees,
            municipality=municipality,
            municipality_code=municipality_code,
            county=county,
        )

        builder = CompanyFilterBuilder(filters)
        # Apply all non-financial filters
        builder.apply_nace_filter()
        builder.apply_org_form_filter()
        builder.apply_employee_filter()
        builder.apply_location_filter()
        builder.apply_status_filters()  # Exclude bankrupt by default if desired? No, keeper filter logic
        builder.apply_exclude_org_form_filter()

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

        # Apply financial filters (requires join)
        if filters.has_financial_filters():
            query = query.outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            builder.apply_financial_filters()
            query = builder.apply_to_query(query)

        # Get total count BEFORE limit
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query) or 0

        # Apply limit and execute
        result = await self.db.execute(query.limit(limit))
        rows = list(result.all())

        return [tuple(r) for r in rows], total
