import asyncio
import logging
from typing import Literal, Any, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.counties import COUNTY_NAMES, get_county_name
from constants.municipality_coords import MUNICIPALITY_COORDS
from repositories.company_filter_builder import FilterParams
from repositories.company import CompanyRepository
from repositories.stats_repository import StatsRepository
from schemas.stats import GeoAveragesResponse, GeoStatResponse
from sqlalchemy import func, select

logger = logging.getLogger(__name__)

# Type aliases
GeoMetric = Literal["company_count", "new_last_year", "bankrupt_count", "total_employees"]
GeoLevel = Literal["county", "municipality"]

# Percentile estimation thresholds (assumes normal distribution)
# Maps ratio (company_value / industry_avg) to estimated percentile
# Higher granularity for better UX (top 1%, 2%, 5%, etc.)
PERCENTILE_THRESHOLDS = [
    (3.0, 99),  # Top 1% (3x average or more)
    (2.5, 98),  # Top 2%
    (2.0, 95),  # Top 5%
    (1.7, 90),  # Top 10%
    (1.5, 85),  # Top 15%
    (1.2, 70),  # Top 30%
    (1.0, 55),  # Above average
    (0.8, 40),  # Below average
    (0.5, 25),  # Bottom 25%
    (0.3, 10),  # Bottom 10%
]


class StatsService:
    """Service for statistics calculations and queries."""

    # Municipality names cache (singleton pattern)
    _municipality_names: dict[str, str] = {}
    _municipality_names_lock = asyncio.Lock()

    def __init__(self, db: AsyncSession):
        self.db = db
        self.stats_repo = StatsRepository(db)
        self.company_repo = CompanyRepository(db)

    async def _ensure_municipality_names_loaded(self) -> None:
        """Load municipality names from database (thread-safe singleton).

        Note: Cache is bounded to ~357 municipalities (all Norwegian kommuner).
        Memory footprint: ~20KB. No TTL needed as municipality names rarely change.
        """
        if StatsService._municipality_names:
            return

        async with StatsService._municipality_names_lock:
            # Double-check after acquiring lock
            if StatsService._municipality_names:
                return

            try:
                rows = await self.stats_repo.get_municipality_names()
                for row in rows:
                    if row.code and row.name:
                        StatsService._municipality_names[row.code] = row.name.title()
                logger.info(f"Loaded {len(StatsService._municipality_names)} municipality names into cache")
            except Exception as e:
                logger.error(f"Failed to load municipality names: {e}")
                # Continue with fallback naming - service remains functional

    def _get_municipality_name(self, code: str) -> str:
        """Get municipality name from pre-loaded cache."""
        return StatsService._municipality_names.get(code, f"Kommune {code}")

    async def get_county_stats(self, metric: GeoMetric, nace: str | None = None) -> list[GeoStatResponse]:
        """Get aggregated statistics per county."""
        metric_columns = {
            "company_count": models.CountyStats.company_count,
            "new_last_year": models.CountyStats.new_last_year,
            "bankrupt_count": models.CountyStats.bankrupt_count,
            "total_employees": models.CountyStats.total_employees,
        }
        metric_col = metric_columns[metric]

        # Truncate NACE to division (2 digits) if provided as subclass (5 digits)
        # Summary map views aggregate at division/section level
        clean_nace = nace[:2] if nace and len(nace) > 1 else nace

        rows: Sequence[Any] = await self.stats_repo.get_county_stats(metric_col, clean_nace)

        # Fetch population for all municipalities to aggregate by county
        # Uses latest available year from SSB data (auto-fallback)
        pop_rows = await self.stats_repo.get_municipality_populations()

        # Aggregate population by county
        county_pop: dict[str, int] = {}
        for r in pop_rows:
            # County code is first 2 digits of municipality code
            c_code = r.municipality_code[:2]
            county_pop[c_code] = county_pop.get(c_code, 0) + r.population

        stats = []
        for row in rows:
            if row.code not in COUNTY_NAMES:
                continue

            val = int(row.value or 0)
            pop = county_pop.get(row.code)
            per_capita = (val / pop * 1000) if pop and pop > 0 else None

            stats.append(
                GeoStatResponse(
                    code=row.code,
                    name=get_county_name(row.code),
                    value=val,
                    population=pop,
                    companies_per_capita=per_capita,
                    lat=None,
                    lng=None,
                )
            )
        return stats

    async def get_municipality_stats(
        self, metric: GeoMetric, nace: str | None = None, county_code: str | None = None
    ) -> list[GeoStatResponse]:
        """Get aggregated statistics per municipality.

        Performance: Uses two concurrent queries instead of N+1:
        1. Fetch municipality stats (filtered)
        2. Fetch population data (all municipalities for current year)
        """
        metric_columns = {
            "company_count": models.MunicipalityStats.company_count,
            "new_last_year": models.MunicipalityStats.new_last_year,
            "bankrupt_count": models.MunicipalityStats.bankrupt_count,
            "total_employees": models.MunicipalityStats.total_employees,
        }
        # Truncate NACE to division (2 digits) if provided as subclass (5 digits)
        # Preserve section letters (A-U)
        clean_nace = nace[:2] if nace and len(nace) > 1 else nace
        metric_col = metric_columns[metric]

        # Fetch stats and population data sequentially
        # Note: asyncio.gather causes issues with SQLAlchemy async sessions
        # when both tasks use the same session (race condition on close)
        rows: Sequence[Any] = await self.stats_repo.get_municipality_stats(metric_col, clean_nace, county_code)
        pop_rows = await self.stats_repo.get_municipality_populations()

        # Build population lookup map (STRIP keys for safety)
        pop_map = {str(r.municipality_code).strip(): r.population for r in pop_rows}

        # Batch load municipality names (cached, single query on first call)
        await self._ensure_municipality_names_loaded()

        stats = []
        for row in rows:
            if not row.code:
                continue

            # Robust matching: ensure string and strip whitespace
            clean_code = str(row.code).strip()

            val = int(row.value or 0)
            pop = pop_map.get(clean_code)

            per_capita = (val / pop * 1000) if pop and pop > 0 else None

            # Retrieve coordinates
            coords = MUNICIPALITY_COORDS.get(clean_code)

            stats.append(
                GeoStatResponse(
                    code=clean_code,
                    name=self._get_municipality_name(clean_code),
                    value=val,
                    population=pop,
                    companies_per_capita=per_capita,
                    lat=coords[0] if coords else None,
                    lng=coords[1] if coords else None,
                )
            )

        return stats

    async def get_geography_stats(
        self,
        level: GeoLevel,
        metric: GeoMetric,
        filters: FilterParams,
    ) -> list[GeoStatResponse]:
        """Get aggregated statistics per region for geographic visualization."""
        # Check if we have any advanced filters that require live aggregation
        # (Materialized views only support NACE-based aggregations)
        if not filters.is_empty():
            rows = await self.stats_repo.get_filtered_geography_stats(level, metric, filters)

            # Populate names and population
            await self._ensure_municipality_names_loaded()
            pop_rows = await self.stats_repo.get_municipality_populations()

            if level == "county":
                from constants.counties import COUNTY_NAMES, get_county_name

                # Aggregate population by county
                county_pop: dict[str, int] = {}
                for r in pop_rows:
                    c_code = r.municipality_code[:2]
                    county_pop[c_code] = county_pop.get(c_code, 0) + r.population

                stats = []
                for row in rows:
                    if row.code not in COUNTY_NAMES:
                        continue
                    val = int(row.value or 0)
                    pop = county_pop.get(row.code)
                    per_capita = (val / pop * 1000) if pop and pop > 0 else None
                    stats.append(
                        GeoStatResponse(
                            code=row.code,
                            name=get_county_name(row.code),
                            value=val,
                            population=pop,
                            companies_per_capita=per_capita,
                            lat=None,
                            lng=None,
                        )
                    )
                return stats
            else:
                pop_map = {str(r.municipality_code).strip(): r.population for r in pop_rows}
                stats = []
                for row in rows:
                    if not row.code:
                        continue
                    clean_code = str(row.code).strip()
                    val = int(row.value or 0)
                    pop = pop_map.get(clean_code)
                    per_capita = (val / pop * 1000) if pop and pop > 0 else None
                    coords = MUNICIPALITY_COORDS.get(clean_code)
                    stats.append(
                        GeoStatResponse(
                            code=clean_code,
                            name=self._get_municipality_name(clean_code),
                            value=val,
                            population=pop,
                            companies_per_capita=per_capita,
                            lat=coords[0] if coords else None,
                            lng=coords[1] if coords else None,
                        )
                    )
                return stats

        # Default path using materialized views
        if level == "county":
            return await self.get_county_stats(metric, filters.naeringskode)
        else:
            return await self.get_municipality_stats(metric, filters.naeringskode, filters.county)

    async def get_geography_averages(
        self,
        level: GeoLevel,
        metric: GeoMetric,
        filters: FilterParams,
        county_code_context: str | None = None,
    ) -> GeoAveragesResponse:
        """Get national and county averages for comparison."""
        # For mapping averages, we also need to respect filters if they are present
        # If filters are present, we should aggregate live
        if not filters.is_empty():
            # Get national total
            # We can use get_filtered_geography_stats and sum it up
            rows = await self.stats_repo.get_filtered_geography_stats(level, metric, filters)
            national_total = sum((int(row.value or 0) for row in rows), 0)

            # Unit count (number of counties or municipalities that have companies)
            # Actually, average should probably be over ALL units if we want a true average
            # but for filtered data, maybe it's only over units with matches?
            # Standard in this app seems to be dividing by total number of units.
            unit_count = 15 if level == "county" else 356
            national_avg = national_total / unit_count if unit_count > 0 else 0

            county_avg = None
            county_total = None
            county_name = None

            if county_code_context and level == "municipality":
                # Filter rows to this county
                county_rows = [r for r in rows if r.code.startswith(county_code_context)]
                county_total = sum((int(row.value or 0) for row in county_rows), 0)
                # Count municipalities in this county
                # (This is an approximation, but better than nothing)
                muni_in_county_count = len([r for r in rows if r.code.startswith(county_code_context)])
                county_avg = county_total / muni_in_county_count if muni_in_county_count > 0 else 0
                from constants.counties import get_county_name

                county_name = get_county_name(county_code_context)

            return GeoAveragesResponse(
                national_avg=round(national_avg, 1),
                national_total=national_total,
                county_avg=round(county_avg, 1) if county_avg is not None else None,
                county_total=county_total,
                county_name=county_name,
            )

        # Fallback to existing materialized view path
        nace = filters.naeringskode
        county_code = county_code_context or filters.county

        # Truncate NACE for summary views (2-digit division)
        clean_nace = nace[:2] if nace and len(nace) > 1 else nace

        county_metric_columns = {
            "company_count": models.CountyStats.company_count,
            "new_last_year": models.CountyStats.new_last_year,
            "bankrupt_count": models.CountyStats.bankrupt_count,
            "total_employees": models.CountyStats.total_employees,
        }
        municipality_metric_columns = {
            "company_count": models.MunicipalityStats.company_count,
            "new_last_year": models.MunicipalityStats.new_last_year,
            "bankrupt_count": models.MunicipalityStats.bankrupt_count,
            "total_employees": models.MunicipalityStats.total_employees,
        }

        from constants.counties import COUNTY_NAMES, get_county_name

        if level == "county":
            metric_col = county_metric_columns[metric]
            query = select(func.sum(metric_col).label("total"))
            if clean_nace:
                query = query.where(models.CountyStats.nace_division == clean_nace)
            result = await self.db.execute(query)
            national_total = result.scalar() or 0
            national_avg = national_total / len(COUNTY_NAMES) if COUNTY_NAMES else 0
        else:
            metric_col = municipality_metric_columns[metric]
            base_query = select(
                func.sum(metric_col).label("total"),
                func.count(func.distinct(models.MunicipalityStats.municipality_code)).label("unit_count"),
            )
            if clean_nace:
                base_query = base_query.where(models.MunicipalityStats.nace_division == clean_nace)

            result = await self.db.execute(base_query)
            row = result.one()
            national_total = row.total or 0
            row_unit_count = row.unit_count or 0
            national_avg = national_total / row_unit_count if row_unit_count else 0

        county_avg = None
        county_total = None
        county_name = None

        if county_code and level == "municipality":
            county_metric_col = municipality_metric_columns[metric]
            county_query = select(
                func.sum(county_metric_col).label("total"),
                func.count(func.distinct(models.MunicipalityStats.municipality_code)).label("unit_count"),
            ).where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)
            if clean_nace:
                county_query = county_query.where(models.MunicipalityStats.nace_division == clean_nace)

            result = await self.db.execute(county_query)
            row = result.one()
            county_total = row.total or 0
            row_unit_count = row.unit_count or 0
            county_avg = county_total / row_unit_count if row_unit_count else 0
            county_name = get_county_name(county_code)

        return GeoAveragesResponse(
            national_avg=round(national_avg, 1),
            national_total=national_total,
            county_avg=round(county_avg, 1) if county_avg is not None else None,
            county_total=county_total,
            county_name=county_name,
        )

    async def get_industry_benchmark(
        self, nace_code: str, orgnr: str, municipality_code: str | None = None
    ) -> dict | None:
        """
        Get industry benchmark data comparing a company to its industry.
        Supports automatic fallback from 5-digit (subclass) to 2-digit (division)
        if 5-digit data is insufficient.

        Args:
            nace_code: NACE code (2 digits '62' or 5 digits '62.010')
            orgnr: Company organization number
            municipality_code: Optional 4-digit municipality code for local comparison

        Returns:
            Dictionary with benchmark data or None if data not available
        """
        is_subclass = len(nace_code) > 2
        nace_division = nace_code[:2]
        is_municipal = municipality_code is not None

        # 1. Fetch Industry Stats
        industry_stats: Any = None
        used_nace_code = nace_code

        if municipality_code is not None:
            # Try municipal stats first
            industry_stats = await self.stats_repo.get_industry_stats_by_municipality(nace_code, municipality_code)
            # If municipal data insufficient, fallback to national silently
            if not industry_stats:
                is_municipal = False  # Flag that we fell back

        if not industry_stats:
            # National stats path
            if is_subclass:
                industry_stats = await self.stats_repo.get_industry_subclass_stats(nace_code)
            else:
                industry_stats = await self.stats_repo.get_industry_stats(nace_division)

            # Fallback from 5-digit to 2-digit
            if is_subclass and not industry_stats:
                industry_stats = await self.stats_repo.get_industry_stats(nace_division)
                used_nace_code = nace_division

        # 2. Fetch Company Data
        company_financials, company_employees = await self.company_repo.get_company_with_latest_financials(orgnr)

        if not industry_stats:
            return None

        # 4. Calculate percentile rankings (simple estimation based on averages)
        def calc_percentile(company_val: float | None, avg_val: float | None) -> int | None:
            """Estimate percentile based on comparison to average.

            Note: This is a simplified estimation assuming normal distribution.
            For skewed distributions (like revenue), this is an approximation.
            Consider using actual percentile calculations from DB for more accuracy.
            """
            if company_val is None or avg_val is None or avg_val == 0:
                return None

            # Calculate percentile from ratio using predefined thresholds
            ratio = company_val / avg_val
            for threshold, percentile in PERCENTILE_THRESHOLDS:
                if ratio >= threshold:
                    return percentile
            return 10  # Below all thresholds

        # Build response
        company_revenue = company_financials.salgsinntekter if company_financials else None
        company_profit = company_financials.aarsresultat if company_financials else None
        company_op_result = company_financials.driftsresultat if company_financials else None

        # Calculate operating margin for company (as percentage to match industry_stats)
        # Industry stats store margin as percentage (driftsresultat / salgsinntekter * 100)
        company_op_margin = None
        if company_revenue and company_op_result is not None and company_revenue > 0:
            company_op_margin = (company_op_result / company_revenue) * 100

        return {
            "orgnr": orgnr,
            "nace_code": used_nace_code,  # Return the code actually used (can be 2 or 5 digit)
            "nace_division": nace_division,  # Keep for ref
            "municipality_code": municipality_code if is_municipal else None,  # None = national scope
            "company_count": industry_stats.company_count,
            "revenue": {
                "company_value": company_revenue,
                "industry_avg": industry_stats.avg_revenue,
                "industry_median": industry_stats.median_revenue,
                "percentile": calc_percentile(company_revenue, industry_stats.avg_revenue),
            },
            "profit": {
                "company_value": company_profit,
                "industry_avg": industry_stats.avg_profit,
                "industry_median": None,
                "percentile": calc_percentile(company_profit, industry_stats.avg_profit),
            },
            "employees": {
                "company_value": company_employees,
                "industry_avg": industry_stats.avg_employees,
                "industry_median": None,
                "percentile": calc_percentile(company_employees, industry_stats.avg_employees),
            },
            "operating_margin": {
                "company_value": company_op_margin,
                "industry_avg": industry_stats.avg_operating_margin,
                "industry_median": None,
                "percentile": calc_percentile(company_op_margin, industry_stats.avg_operating_margin),
            },
        }

    async def get_municipality_premium_dashboard(self, municipality_code: str):
        """
        Consolidated premium dashboard data for a municipality.
        Coordinates multiple repository calls in parallel for performance.
        """
        # Ensure name cache is loaded for fallback
        await self._ensure_municipality_names_loaded()

        # 1. Fetch all components
        summary = await self.stats_repo.get_municipality_premium_summary(municipality_code)
        sectors = await self.stats_repo.get_municipality_sector_distribution(municipality_code)

        # Advanced rankings (Density, Revenue, and Population)
        ranking_density = await self.stats_repo.get_municipality_rankings(municipality_code, metric="density")
        ranking_revenue = await self.stats_repo.get_municipality_rankings(municipality_code, metric="revenue")
        ranking_population = await self.stats_repo.get_municipality_rankings(municipality_code, metric="population")

        trend = await self.stats_repo.get_establishment_trend(municipality_code)

        # 2. Fetch company lists (Top earners, Newest, and Bankruptcies)
        # Top 5 by revenue
        top_companies_res = await self.company_repo.get_all(
            FilterParams(municipality_code=municipality_code),
            limit=5,
            sort_by="revenue",
            sort_order="desc",
        )

        # Newest 40 (Exclude KBO at query level to ensure we get real new companies)
        new_companies_res = await self.company_repo.get_all(
            FilterParams(municipality_code=municipality_code, exclude_org_form=["KBO"]),
            limit=40,
            sort_by="stiftelsesdato",
            sort_order="desc",
        )

        # Siste konkurser (Top 5)
        bankrupt_res = await self.company_repo.get_all(
            FilterParams(municipality_code=municipality_code, is_bankrupt=True),
            limit=5,
            sort_by="konkursdato",
            sort_order="desc",
        )

        # Post-processing
        from constants.counties import get_county_name

        # Exclude bankrupt estates from newest companies feed
        filtered_newest = [c for c in new_companies_res if "KONKURSBO" not in (c.navn or "").upper()]

        # Get coordinates
        coords = MUNICIPALITY_COORDS.get(municipality_code)

        return {
            "code": municipality_code,
            "name": self._get_municipality_name(municipality_code),
            "county_code": municipality_code[:2],
            "county_name": get_county_name(municipality_code[:2]),
            "lat": coords[0] if coords else None,
            "lng": coords[1] if coords else None,
            "population": summary["population"],
            "population_growth_1y": summary["population_growth_1y"],
            "company_count": summary["company_count"],
            "business_density": (summary["company_count"] / summary["population"] * 1000)
            if summary["population"] > 0
            else 0,
            "business_density_national_avg": summary["national_density"],
            "total_revenue": None,  # Future: sum from LatestAccountings join
            "establishment_trend": trend,
            "top_sectors": sectors,
            "top_companies": top_companies_res,
            "newest_companies": filtered_newest[:5],
            "latest_bankruptcies": bankrupt_res,
            "ranking_in_county_density": ranking_density,
            "ranking_in_county_revenue": ranking_revenue,
            "ranking_in_county_population": ranking_population,
        }
