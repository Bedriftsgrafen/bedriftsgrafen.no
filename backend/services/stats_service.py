import asyncio
import logging
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.counties import COUNTY_NAMES, get_county_name
from repositories.company import CompanyRepository
from repositories.stats_repository import StatsRepository
from schemas.stats import GeoStatResponse

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

        Note: Cache is bounded to ~356 municipalities (all Norwegian kommuner).
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

        rows = await self.stats_repo.get_county_stats(metric_col, nace)

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
        metric_col = metric_columns[metric]

        # Fetch stats and population data sequentially
        # Note: asyncio.gather causes issues with SQLAlchemy async sessions
        # when both tasks use the same session (race condition on close)
        rows = await self.stats_repo.get_municipality_stats(metric_col, nace, county_code)
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

            stats.append(
                GeoStatResponse(
                    code=clean_code,
                    name=self._get_municipality_name(clean_code),
                    value=val,
                    population=pop,
                    companies_per_capita=per_capita,
                )
            )

        return stats

    async def get_geography_stats(
        self,
        level: GeoLevel,
        metric: GeoMetric,
        nace: str | None = None,
        county_code: str | None = None,
    ) -> list[GeoStatResponse]:
        """Get aggregated statistics per region for geographic visualization."""
        if level == "county":
            return await self.get_county_stats(metric, nace)
        else:
            return await self.get_municipality_stats(metric, nace, county_code)

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
        industry_stats = None
        used_nace_code = nace_code

        if is_municipal:
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
