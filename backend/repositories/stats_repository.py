import logging
from collections.abc import Sequence
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import and_, case, false, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.nace import NACE_SECTION_MAPPING
from repositories.company_filter_builder import FilterParams
from schemas.stats import GeoLevel, GeoMetric, IndustryStatsDTO
from utils.redis_cache import RedisCache

logger = logging.getLogger(__name__)

# National density changes at most nightly (materialized view refresh)
_national_density_cache = RedisCache(prefix="stats:national_density", ttl=3600)

# Latest population year changes only when new population data is imported (~annually)
_latest_year_cache = RedisCache(prefix="stats:latest_year", ttl=3600)


class StatsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_national_density(self, year: int) -> float:
        """Get national business density (companies per 1000 population), cached 1hr.

        Eliminates 2 heavy SUM() queries on every dashboard request.
        Cache is keyed by year to avoid cross-year mismatches.
        """
        cache_key = f"year:{year}"
        cached = await _national_density_cache.get(cache_key)
        if cached is not None:
            return float(cached)

        national_stats_query = select(func.sum(models.MunicipalityStats.company_count).label("total_companies"))
        national_pop_query = select(func.sum(models.MunicipalityPopulation.population)).where(
            models.MunicipalityPopulation.year == year
        )

        n_stats_res = await self.db.execute(national_stats_query)
        n_pop_res = await self.db.execute(national_pop_query)

        total_n_companies = n_stats_res.scalar() or 0
        total_n_pop = n_pop_res.scalar() or 1  # avoid div zero
        density = total_n_companies / total_n_pop * 1000

        await _national_density_cache.set(cache_key, density)
        return density

    async def get_industry_stats(self, nace_division: str) -> models.IndustryStats | None:
        """Get aggregated statistics for a specific NACE division (2-digit) or section (1-letter)."""
        query = select(models.IndustryStats)
        if len(nace_division) == 1 and nace_division in NACE_SECTION_MAPPING:
            query = query.where(models.IndustryStats.nace_division.in_(NACE_SECTION_MAPPING[nace_division]))
        else:
            query = query.where(models.IndustryStats.nace_division == nace_division)

        result = await self.db.execute(query)
        # Note: If it's a section, we might get multiple rows - we need to aggregate them
        # However, for get_industry_stat (singular), we usually expect a singular division.
        # If it's a section, we should probably aggregate.
        # But wait, IndustryStats is a materialized view with ONE row per division.
        # If we query by section, result.scalars().all() return multiple rows.
        # Let's adjust this to return a combined stat if it's a section.
        stats = result.scalars().all()
        if not stats:
            return None
        if len(stats) == 1:
            return stats[0]

        # Aggregate multiple divisions into one (for sections)
        # Create a transient model instance for the response
        combined = models.IndustryStats(
            nace_division=nace_division,
            company_count=sum(((s.company_count or 0) for s in stats), 0),
            total_employees=sum(((s.total_employees or 0) for s in stats), 0),
            new_last_year=sum(((s.new_last_year or 0) for s in stats), 0),
            bankrupt_count=sum(((s.bankrupt_count or 0) for s in stats), 0),
            bankruptcies_last_year=sum(((s.bankruptcies_last_year or 0) for s in stats), 0),
            total_revenue=sum(((s.total_revenue or 0.0) for s in stats), 0.0),
            total_profit=sum(((s.total_profit or 0.0) for s in stats), 0.0),
            profitable_count=sum(((s.profitable_count or 0) for s in stats), 0),
        )
        # Calculate averages for the combined stat
        if combined.company_count and combined.company_count > 0:
            combined.avg_revenue = (combined.total_revenue or 0.0) / combined.company_count
            combined.avg_profit = (combined.total_profit or 0.0) / combined.company_count
            combined.avg_employees = (
                sum(((s.avg_employees or 0.0) * (s.company_count or 0)) for s in stats) / combined.company_count
            )
            # Operating margin is harder to aggregate accurately without weights, but let's use weighted average
            if combined.total_revenue and combined.total_revenue > 0:
                total_margin_revenue = sum(((s.avg_operating_margin or 0.0) * (s.total_revenue or 0.0)) for s in stats)
                combined.avg_operating_margin = total_margin_revenue / combined.total_revenue
            else:
                combined.avg_operating_margin = 0.0

        return combined

    async def get_industry_subclass_stats(self, nace_code: str) -> models.IndustrySubclassStats | None:
        """Get aggregated statistics for a specific NACE subclass (5-digit)."""
        result = await self.db.execute(
            select(models.IndustrySubclassStats).where(models.IndustrySubclassStats.nace_code == nace_code)
        )
        return result.scalar_one_or_none()

    async def get_county_stats(self, metric_col, nace: str | None = None) -> Sequence[Any]:
        """Get raw county stats query result."""
        query = select(
            models.CountyStats.county_code.label("code"),
            func.sum(metric_col).label("value"),
        ).group_by(models.CountyStats.county_code)

        if nace:
            if len(nace) == 1 and nace in NACE_SECTION_MAPPING:
                query = query.where(models.CountyStats.nace_division.in_(NACE_SECTION_MAPPING[nace]))
            else:
                query = query.where(models.CountyStats.nace_division == nace)

        result = await self.db.execute(query)
        return result.all()

    async def get_municipality_stats(self, metric_col, nace: str | None = None, county_code: str | None = None):
        """Get raw municipality stats query result."""
        query = select(
            models.MunicipalityStats.municipality_code.label("code"),
            func.sum(metric_col).label("value"),
        ).group_by(models.MunicipalityStats.municipality_code)

        if nace:
            if len(nace) == 1 and nace in NACE_SECTION_MAPPING:
                query = query.where(models.MunicipalityStats.nace_division.in_(NACE_SECTION_MAPPING[nace]))
            else:
                query = query.where(models.MunicipalityStats.nace_division == nace)

        if county_code:
            query = query.where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)

        result = await self.db.execute(query)
        return result.all()

    async def get_latest_population_year(self) -> int | None:
        """Get the most recent year with valid (named) population data.

        Excludes years where municipality names are missing (incomplete imports).
        Cached 1hr — this value changes only when new population data is imported.
        """
        from sqlalchemy import func as sa_func

        cached = await _latest_year_cache.get("year")
        if cached is not None:
            return int(cached)

        query = select(sa_func.max(models.MunicipalityPopulation.year)).where(
            and_(
                models.MunicipalityPopulation.name.isnot(None),
                models.MunicipalityPopulation.name != "",
            )
        )
        result = await self.db.execute(query)
        year = result.scalar()

        if year is not None:
            await _latest_year_cache.set("year", year)
        return year

    async def get_municipality_populations(self, year: int | None = None) -> Sequence[models.MunicipalityPopulation]:
        """Get population data for all municipalities for a specific year.

        If year is None, uses the latest available year.
        """
        if year is None:
            year = await self.get_latest_population_year()
            if year is None:
                return []  # No population data exists

        query = select(models.MunicipalityPopulation).where(models.MunicipalityPopulation.year == year)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_municipality_names(self):
        """Fetch distinct municipality names from the geo model (fast)."""
        # We use the most recent year to get the most representative names
        year = await self.get_latest_population_year() or 2024
        result = await self.db.execute(
            select(
                models.MunicipalityPopulation.municipality_code.label("code"),
                models.MunicipalityPopulation.name.label("name"),
            ).where(
                and_(
                    models.MunicipalityPopulation.year == year,
                    models.MunicipalityPopulation.name.isnot(None),
                )
            )
        )
        return result.all()

    async def get_industry_stats_by_municipality(
        self, nace_code: str, municipality_code: str
    ) -> models.IndustryStats | IndustryStatsDTO | None:
        """
        Calculate industry financial stats for companies in a specific municipality.

        Returns an IndustryStats-like object with avg_revenue, avg_profit, etc.
        """
        # Determine filter type: section (1-char), division (2-digit), or subclass (5-digit)

        nace_filter: Any
        if len(nace_code) == 1 and nace_code in NACE_SECTION_MAPPING:
            nace_filter = func.left(models.Company.naeringskode, 2).in_(NACE_SECTION_MAPPING[nace_code])
        else:
            nace_is_subclass = len(nace_code) > 2
            if nace_is_subclass:
                nace_filter = models.Company.naeringskode == nace_code
            else:
                nace_filter = func.left(models.Company.naeringskode, 2) == nace_code

        # Use LatestAccountings materialized view (already has latest year per company)
        # This avoids the expensive MAX(aar) GROUP BY subquery
        query = (
            select(
                func.count(func.distinct(models.Company.orgnr)).label("company_count"),
                func.avg(models.LatestAccountings.salgsinntekter).label("avg_revenue"),
                func.avg(models.LatestAccountings.aarsresultat).label("avg_profit"),
                func.avg(case((models.Company.antall_ansatte > 0, models.Company.antall_ansatte), else_=None)).label(
                    "avg_employees"
                ),
                func.avg(
                    case(
                        (
                            and_(
                                models.LatestAccountings.salgsinntekter >= 50000,
                                models.LatestAccountings.driftsresultat.isnot(None),
                                (
                                    models.LatestAccountings.driftsresultat / models.LatestAccountings.salgsinntekter
                                ).between(-1.0, 1.0),
                            ),
                            (models.LatestAccountings.driftsresultat / models.LatestAccountings.salgsinntekter) * 100,
                        ),
                        else_=None,
                    )
                ).label("avg_operating_margin"),
                func.percentile_cont(0.5).within_group(models.LatestAccountings.salgsinntekter).label("median_revenue"),
            )
            .select_from(models.Company)
            .join(models.LatestAccountings, models.Company.orgnr == models.LatestAccountings.orgnr)
            .where(
                and_(
                    nace_filter,
                    func.coalesce(
                        func.nullif(models.Company.forretningsadresse["kommunenummer"].astext, ""),
                        func.nullif(models.Company.postadresse["kommunenummer"].astext, ""),
                    )
                    == municipality_code,
                    models.Company.konkurs.is_(False),
                )
            )
        )

        result = await self.db.execute(query)
        row = result.one_or_none()

        if not row or row.company_count < 5:
            # Require at least 5 companies for meaningful comparison
            return None

        return IndustryStatsDTO(
            company_count=row.company_count,
            avg_revenue=row.avg_revenue,
            avg_profit=row.avg_profit,
            avg_employees=row.avg_employees,
            avg_operating_margin=row.avg_operating_margin,
            median_revenue=row.median_revenue,
        )

    def _benchmark_peer_filters(self, nace_code: str, municipality_code: str | None) -> list[Any]:
        nace_filter: Any
        if len(nace_code) == 1 and nace_code in NACE_SECTION_MAPPING:
            nace_filter = func.left(models.Company.naeringskode, 2).in_(NACE_SECTION_MAPPING[nace_code])
        elif len(nace_code) > 2:
            nace_filter = models.Company.naeringskode == nace_code
        else:
            nace_filter = func.left(models.Company.naeringskode, 2) == nace_code

        filters: list[Any] = [nace_filter, models.Company.naeringskode.isnot(None)]

        if municipality_code:
            filters.extend(
                [
                    func.coalesce(
                        func.nullif(models.Company.forretningsadresse["kommunenummer"].astext, ""),
                        func.nullif(models.Company.postadresse["kommunenummer"].astext, ""),
                    )
                    == municipality_code,
                    models.Company.konkurs.is_(False),
                ]
            )
        elif len(nace_code) > 2:
            filters.append(models.Company.organisasjonsform != "KBO")
        else:
            filters.extend(
                [
                    models.Company.konkurs.isnot(True),
                    models.Company.under_avvikling.isnot(True),
                    models.Company.under_tvangsavvikling.isnot(True),
                ]
            )

        return filters

    @staticmethod
    def _percentile_from_counts(value_count: int | None, total_count: int | None) -> int | None:
        if value_count is None or total_count is None or total_count <= 0:
            return None
        return max(0, min(100, round((value_count / total_count) * 100)))

    async def get_benchmark_percentiles(
        self,
        nace_code: str,
        *,
        municipality_code: str | None = None,
        company_revenue: float | None = None,
        company_profit: float | None = None,
        company_employees: int | None = None,
        company_operating_margin: float | None = None,
    ) -> dict[str, int | None]:
        """Calculate exact percentile ranks against the selected peer group."""
        operating_margin = (models.LatestAccountings.driftsresultat / models.LatestAccountings.salgsinntekter) * 100
        operating_margin_valid = and_(
            models.LatestAccountings.salgsinntekter >= 50000,
            models.LatestAccountings.driftsresultat.isnot(None),
            (models.LatestAccountings.driftsresultat / models.LatestAccountings.salgsinntekter).between(-1.0, 1.0),
        )

        query = (
            select(
                func.count().filter(models.LatestAccountings.salgsinntekter > 0).label("revenue_total"),
                func.count()
                .filter(
                    and_(
                        models.LatestAccountings.salgsinntekter > 0,
                        models.LatestAccountings.salgsinntekter <= company_revenue,
                    )
                    if company_revenue is not None
                    else false()
                )
                .label("revenue_lte"),
                func.count().filter(models.LatestAccountings.aarsresultat.isnot(None)).label("profit_total"),
                func.count()
                .filter(
                    and_(
                        models.LatestAccountings.aarsresultat.isnot(None),
                        models.LatestAccountings.aarsresultat <= company_profit,
                    )
                    if company_profit is not None
                    else false()
                )
                .label("profit_lte"),
                func.count().filter(models.Company.antall_ansatte > 0).label("employees_total"),
                func.count()
                .filter(
                    and_(models.Company.antall_ansatte > 0, models.Company.antall_ansatte <= company_employees)
                    if company_employees is not None and company_employees > 0
                    else false()
                )
                .label("employees_lte"),
                func.count().filter(operating_margin_valid).label("operating_margin_total"),
                func.count()
                .filter(
                    and_(operating_margin_valid, operating_margin <= company_operating_margin)
                    if company_operating_margin is not None
                    else false()
                )
                .label("operating_margin_lte"),
            )
            .select_from(models.Company)
            .outerjoin(models.LatestAccountings, models.Company.orgnr == models.LatestAccountings.orgnr)
            .where(and_(*self._benchmark_peer_filters(nace_code, municipality_code)))
        )

        row = (await self.db.execute(query)).one()
        return {
            "revenue": self._percentile_from_counts(row.revenue_lte, row.revenue_total),
            "profit": self._percentile_from_counts(row.profit_lte, row.profit_total),
            "employees": self._percentile_from_counts(row.employees_lte, row.employees_total),
            "operating_margin": self._percentile_from_counts(row.operating_margin_lte, row.operating_margin_total),
        }

    async def get_filtered_geography_stats(
        self,
        level: GeoLevel,
        metric: GeoMetric,
        filters: FilterParams,
    ) -> Sequence[Any]:
        """
        Get live, filtered geographic statistics by aggregating the bedrifter table.
        Used when advanced filters (org form, revenue, etc.) are present.
        """
        from repositories.company_filter_builder import CompanyFilterBuilder

        # Determine geographic column — COALESCE for consistency with filter_builder and MATVIEWs
        _eff_muni = func.coalesce(
            func.nullif(models.Company.forretningsadresse["kommunenummer"].astext, ""),
            func.nullif(models.Company.postadresse["kommunenummer"].astext, ""),
        )
        geo_col = func.left(_eff_muni, 2).label("code") if level == "county" else _eff_muni.label("code")

        # Determine metric aggregation
        metric_col: Any
        if metric == "company_count":
            metric_col = func.count(models.Company.orgnr).label("value")
        elif metric == "total_employees":
            metric_col = func.sum(models.Company.antall_ansatte).label("value")
        elif metric == "new_last_year":
            # Approximation for live query: founded in last 365 days
            from datetime import date, timedelta

            one_year_ago = date.today() - timedelta(days=365)
            metric_col = func.count(case((models.Company.stiftelsesdato >= one_year_ago, 1))).label("value")
        elif metric == "bankrupt_count":
            metric_col = func.count(case((models.Company.konkurs.is_(True), 1))).label("value")
        else:
            metric_col = func.count(models.Company.orgnr).label("value")

        # Build query
        query = select(geo_col, metric_col).where(geo_col.isnot(None))

        # Join with financials if needed
        builder = CompanyFilterBuilder(filters)
        builder.apply_all(include_financial=True)

        if builder.needs_financial_join:
            query = query.join(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)

        query = builder.apply_to_query(query)
        query = query.group_by(geo_col)

        result = await self.db.execute(query)
        return result.all()

    async def get_municipality_premium_summary(self, municipality_code: str) -> dict[str, Any]:
        """
        Get high-level summary for a municipality:
        - Population (latest + growth if available)
        - Total companies, employees, new last year
        - National density comparison (cached)
        """
        # 1. Fetch population (latest and previous year for growth)
        # Filter out years with incomplete data (empty names = incomplete import)
        pop_query = (
            select(models.MunicipalityPopulation)
            .where(
                and_(
                    models.MunicipalityPopulation.municipality_code == municipality_code,
                    models.MunicipalityPopulation.name.isnot(None),
                    models.MunicipalityPopulation.name != "",
                )
            )
            .order_by(models.MunicipalityPopulation.year.desc())
            .limit(2)
        )

        pop_res = await self.db.execute(pop_query)
        pop_rows = pop_res.scalars().all()

        latest_pop = pop_rows[0].population if pop_rows and pop_rows[0].population is not None else 0
        prev_pop = pop_rows[1].population if len(pop_rows) > 1 else None
        pop_growth = ((latest_pop - prev_pop) / prev_pop * 100) if prev_pop and latest_pop else None

        # 2. Fetch basic company stats (aggregated from MunicipalityStats)
        stats_query = select(
            func.sum(models.MunicipalityStats.company_count).label("company_count"),
            func.sum(models.MunicipalityStats.total_employees).label("total_employees"),
            func.sum(models.MunicipalityStats.new_last_year).label("new_last_year"),
        ).where(models.MunicipalityStats.municipality_code == municipality_code)

        stats_res = await self.db.execute(stats_query)
        stats_row = stats_res.one_or_none()

        # 3. Get national density (cached — eliminates 2 heavy SUM queries)
        year = pop_rows[0].year if pop_rows else 2024
        national_density = await self._get_national_density(year)

        return {
            "population": latest_pop,
            "population_growth_1y": pop_growth,
            "company_count": (stats_row.company_count or 0) if stats_row else 0,
            "total_employees": (stats_row.total_employees or 0) if stats_row else 0,
            "new_last_year": (stats_row.new_last_year or 0) if stats_row else 0,
            "national_density": national_density,
            "year": pop_rows[0].year if pop_rows else None,
        }

    async def get_municipality_sector_distribution(self, municipality_code: str, limit: int = 10):
        """Get industry distribution for a municipality."""
        from constants.nace import get_nace_name

        query = (
            select(
                models.MunicipalityStats.nace_division,
                models.MunicipalityStats.company_count,
                models.MunicipalityStats.total_employees,
            )
            .where(models.MunicipalityStats.municipality_code == municipality_code)
            .order_by(models.MunicipalityStats.company_count.desc())
            .limit(limit)
        )

        result = await self.db.execute(query)
        rows = result.all()

        total_count = sum((r.company_count or 0) for r in rows) or 1

        return [
            {
                "nace_division": r.nace_division,
                "nace_name": get_nace_name(r.nace_division),
                "company_count": r.company_count or 0,
                "total_employees": r.total_employees or 0,
                "percentage_of_total": ((r.company_count or 0) / total_count * 100) if total_count else 0,
            }
            for r in rows
        ]

    async def get_municipality_combined_rankings(self, municipality_code: str):
        """Get rankings for density, revenue, and population in a single efficient query."""
        from sqlalchemy import Float, cast

        county_code = municipality_code[:2]
        latest_year = await self.get_latest_population_year() or 2024

        # 1. Density Query
        density_data = (
            select(
                models.MunicipalityStats.municipality_code,
                (
                    cast(func.sum(models.MunicipalityStats.company_count), Float)
                    / cast(models.MunicipalityPopulation.population, Float)
                    * 1000
                ).label("density"),
            )
            .join(
                models.MunicipalityPopulation,
                and_(
                    models.MunicipalityStats.municipality_code == models.MunicipalityPopulation.municipality_code,
                    models.MunicipalityPopulation.year == latest_year,
                ),
            )
            .where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)
            .group_by(models.MunicipalityStats.municipality_code, models.MunicipalityPopulation.population)
            .subquery()
        )

        # 2. Revenue Query
        revenue_data = (
            select(
                models.MunicipalityStats.municipality_code,
                func.sum(models.MunicipalityStats.total_revenue).label("revenue"),
            )
            .where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)
            .group_by(models.MunicipalityStats.municipality_code)
            .subquery()
        )

        # 3. Population Query
        pop_data = (
            select(
                models.MunicipalityPopulation.municipality_code,
                models.MunicipalityPopulation.population.label("population"),
            )
            .where(
                and_(
                    func.left(models.MunicipalityPopulation.municipality_code, 2) == county_code,
                    models.MunicipalityPopulation.year == latest_year,
                )
            )
            .subquery()
        )

        # 4. Final Combined Ranking Query
        rank_query = (
            select(
                density_data.c.municipality_code,
                func.rank().over(order_by=density_data.c.density.desc()).label("rank_density"),
                func.rank().over(order_by=revenue_data.c.revenue.desc()).label("rank_revenue"),
                func.rank().over(order_by=pop_data.c.population.desc()).label("rank_population"),
                func.count().over().label("total"),
            )
            .select_from(density_data)
            .join(revenue_data, density_data.c.municipality_code == revenue_data.c.municipality_code)
            .join(pop_data, density_data.c.municipality_code == pop_data.c.municipality_code)
        )

        result = await self.db.execute(rank_query)
        ranks = result.all()

        for r in ranks:
            if r.municipality_code == municipality_code:
                return {
                    "density": {"rank": r.rank_density, "out_of": r.total},
                    "revenue": {"rank": r.rank_revenue, "out_of": r.total},
                    "population": {"rank": r.rank_population, "out_of": r.total},
                }
        return None

    async def get_establishment_trend(self, municipality_code: str, months: int = 12) -> list[dict[str, Any]]:
        """Get monthly registration counts for the last X months."""
        return await self.get_trend(
            level="municipality", code=municipality_code, metric="establishments", months=months
        )

    async def get_bankrupt_trend(self, municipality_code: str, months: int = 12) -> list[dict[str, Any]]:
        """Get monthly bankruptcy counts for the last X months."""
        return await self.get_trend(level="municipality", code=municipality_code, metric="bankruptcies", months=months)

    async def get_county_establishment_trend(self, county_code: str, months: int = 12) -> list[dict[str, Any]]:
        """Get monthly registration counts for a county."""
        return await self.get_trend(level="county", code=county_code, metric="establishments", months=months)

    async def get_county_bankrupt_trend(self, county_code: str, months: int = 12) -> list[dict[str, Any]]:
        """Get monthly bankruptcy counts for a county."""
        return await self.get_trend(level="county", code=county_code, metric="bankruptcies", months=months)

    async def get_trend(
        self,
        level: GeoLevel,
        code: str,
        metric: Literal["establishments", "bankruptcies"],
        months: int = 12,
    ) -> list[dict[str, Any]]:
        """Generic trend fetching for establishments or bankruptcies.
        Refactored to use get_timeline_trends for DRY consistency.
        """
        filters = FilterParams()
        if level == "municipality":
            filters.municipality_code = code
        else:
            filters.county = code

        # Map internal metric names to timeline metric names
        timeline_metric: Literal["bankruptcies", "new_companies"] = (
            "new_companies" if metric == "establishments" else "bankruptcies"
        )

        return await self.get_timeline_trends(metric=timeline_metric, months=months, filters=filters)

    async def get_all_municipality_codes(self) -> Sequence[str]:
        """Fetch all municipality codes that have companies or population data."""
        # Use MunicipalityStats as it represents active municipalities in our system
        query = select(models.MunicipalityStats.municipality_code).distinct()
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_municipality_codes_with_updates(self) -> list[tuple[str, datetime | None]]:
        """Fetch municipality codes with their latest data update timestamp."""
        # Latest population update or company update in that municipality
        query = (
            select(
                models.MunicipalityStats.municipality_code,
                func.max(models.MunicipalityPopulation.updated_at).label("latest_update"),
            )
            .join(
                models.MunicipalityPopulation,
                models.MunicipalityStats.municipality_code == models.MunicipalityPopulation.municipality_code,
                isouter=True,
            )
            .group_by(models.MunicipalityStats.municipality_code)
        )
        result = await self.db.execute(query)
        return [(row.municipality_code, row.latest_update) for row in result]

    # =========================================================================
    # COUNTY (FYLKE) DASHBOARD METHODS
    # =========================================================================

    async def get_county_premium_summary(self, county_code: str) -> dict[str, Any]:
        """
        Get high-level summary for a county:
        - Population (aggregated from municipalities)
        - Total companies, employees, municipality count
        - National density comparison (cached)
        """
        # 1. Fetch aggregated population for the county (latest year)
        latest_year = await self.get_latest_population_year() or 2024

        # Only count valid municipalities (non-empty names = current, not merged/historical)
        pop_query = select(
            func.sum(models.MunicipalityPopulation.population).label("population"),
            func.count(models.MunicipalityPopulation.municipality_code).label("municipality_count"),
        ).where(
            and_(
                func.left(models.MunicipalityPopulation.municipality_code, 2) == county_code,
                models.MunicipalityPopulation.year == latest_year,
                models.MunicipalityPopulation.name.isnot(None),
                models.MunicipalityPopulation.name != "",
            )
        )

        pop_res = await self.db.execute(pop_query)
        pop_row = pop_res.one_or_none()

        population = pop_row.population if pop_row and pop_row.population is not None else 0
        municipality_count = pop_row.municipality_count if pop_row else 0

        # 1b. Get previous year population for growth calculation
        prev_pop_query = select(func.sum(models.MunicipalityPopulation.population)).where(
            and_(
                func.left(models.MunicipalityPopulation.municipality_code, 2) == county_code,
                models.MunicipalityPopulation.year == latest_year - 1,
                models.MunicipalityPopulation.name.isnot(None),
                models.MunicipalityPopulation.name != "",
            )
        )
        prev_pop_res = await self.db.execute(prev_pop_query)
        prev_pop = prev_pop_res.scalar()
        pop_growth = ((population - prev_pop) / prev_pop * 100) if prev_pop and population else None

        # 2. Fetch aggregated company stats for the county (uses idx_municipality_stats_county)
        stats_query = select(
            func.sum(models.MunicipalityStats.company_count).label("company_count"),
            func.sum(models.MunicipalityStats.total_employees).label("total_employees"),
            func.sum(models.MunicipalityStats.new_last_year).label("new_last_year"),
            func.sum(models.MunicipalityStats.total_revenue).label("total_revenue"),
        ).where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)

        stats_res = await self.db.execute(stats_query)
        stats_row = stats_res.one_or_none()

        # 3. Get national density (cached — eliminates 2 heavy SUM queries)
        national_density = await self._get_national_density(latest_year)

        return {
            "population": population,
            "population_growth_1y": pop_growth,
            "company_count": (stats_row.company_count or 0) if stats_row else 0,
            "total_employees": (stats_row.total_employees or 0) if stats_row else 0,
            "new_last_year": (stats_row.new_last_year or 0) if stats_row else 0,
            "total_revenue": (stats_row.total_revenue or 0) if stats_row else 0,
            "municipality_count": municipality_count,
            "national_density": national_density,
            "year": latest_year,
        }

    async def get_county_sector_distribution(self, county_code: str, limit: int = 10):
        """Get industry distribution for a county."""
        from constants.nace import get_nace_name

        query = (
            select(
                models.MunicipalityStats.nace_division,
                func.sum(models.MunicipalityStats.company_count).label("company_count"),
                func.sum(models.MunicipalityStats.total_employees).label("total_employees"),
            )
            .where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)
            .group_by(models.MunicipalityStats.nace_division)
            .order_by(func.sum(models.MunicipalityStats.company_count).desc())
            .limit(limit)
        )

        result = await self.db.execute(query)
        rows = result.all()

        total_count = sum((r.company_count or 0) for r in rows) or 1

        return [
            {
                "nace_division": r.nace_division,
                "nace_name": get_nace_name(r.nace_division),
                "company_count": r.company_count or 0,
                "total_employees": r.total_employees or 0,
                "percentage_of_total": ((r.company_count or 0) / total_count * 100) if total_count else 0,
            }
            for r in rows
        ]

    async def get_county_rankings(
        self, county_code: str, metric: Literal["density", "revenue", "population"] = "density"
    ):
        """Get national rankings for a county."""
        from sqlalchemy import Float, cast, literal_column

        latest_year = await self.get_latest_population_year() or 2024

        if metric == "density":
            # Step 1: Aggregate company counts by county from municipality_stats
            # Use literal_column to ensure GROUP BY references the alias
            county_col_stats = func.left(models.MunicipalityStats.municipality_code, 2)
            company_counts = (
                select(
                    county_col_stats.label("county_code"),
                    func.sum(models.MunicipalityStats.company_count).label("company_count"),
                )
                .group_by(literal_column("county_code"))
                .subquery()
            )

            # Step 2: Aggregate population by county
            county_col_pop = func.left(models.MunicipalityPopulation.municipality_code, 2)
            pop_counts = (
                select(
                    county_col_pop.label("county_code"),
                    func.sum(models.MunicipalityPopulation.population).label("population"),
                )
                .where(models.MunicipalityPopulation.year == latest_year)
                .group_by(literal_column("county_code"))
                .subquery()
            )

            # Step 3: Join the two aggregated subqueries
            # Use NULLIF to prevent division by zero
            county_data = (
                select(
                    company_counts.c.county_code,
                    (
                        cast(company_counts.c.company_count, Float)
                        / func.nullif(cast(pop_counts.c.population, Float), 0)
                        * 1000
                    ).label("value"),
                )
                .join(pop_counts, company_counts.c.county_code == pop_counts.c.county_code)
                .subquery()
            )
        elif metric == "population":
            county_col = func.left(models.MunicipalityPopulation.municipality_code, 2)
            county_data = (
                select(
                    county_col.label("county_code"),
                    func.sum(models.MunicipalityPopulation.population).label("value"),
                )
                .where(models.MunicipalityPopulation.year == latest_year)
                .group_by(literal_column("county_code"))
                .subquery()
            )
        else:  # revenue
            county_col = func.left(models.MunicipalityStats.municipality_code, 2)
            county_data = (
                select(
                    county_col.label("county_code"),
                    func.sum(models.MunicipalityStats.total_revenue).label("value"),
                )
                .group_by(literal_column("county_code"))
                .subquery()
            )

        # Rank all counties
        rank_query = select(
            county_data.c.county_code,
            func.rank().over(order_by=county_data.c.value.desc()).label("rank"),
            func.count().over().label("total"),
        ).select_from(county_data)

        result = await self.db.execute(rank_query)
        ranks = result.all()

        for r in ranks:
            if r.county_code == county_code:
                return {"rank": r.rank, "out_of": r.total}
        return None

    async def get_county_combined_rankings(self, county_code: str) -> dict[str, Any] | None:
        """Get national rankings for density, revenue, and population in a single query.

        Mirrors get_municipality_combined_rankings — combines 3 separate calls into
        one window function query to reduce round-trips from 3 to 1.
        """
        from sqlalchemy import Float, cast

        latest_year = await self.get_latest_population_year() or 2024

        # Aggregate company counts per county from municipality_stats.
        # Use the county_code column directly (added in p1q2r3s4t5u6) to avoid
        # the SQLAlchemy double-parameter issue where func.left(col, 2) in SELECT
        # and func.left(col, 2) in GROUP BY receive different bind slots ($N vs $M),
        # causing PostgreSQL to reject the query with a GroupingError.
        company_counts = (
            select(
                models.MunicipalityStats.county_code,
                func.sum(models.MunicipalityStats.company_count).label("company_count"),
                func.sum(models.MunicipalityStats.total_revenue).label("revenue"),
            )
            .group_by(models.MunicipalityStats.county_code)
            .subquery()
        )

        # Aggregate population per county.
        # Reuse the same expression object for SELECT and GROUP BY to avoid
        # SQLAlchemy assigning different bind parameter slots ($N vs $M) for the
        # same constant 2, which would cause a PostgreSQL GroupingError.
        pop_county_expr = func.left(models.MunicipalityPopulation.municipality_code, 2)
        pop_counts = (
            select(
                pop_county_expr.label("county_code"),
                func.sum(models.MunicipalityPopulation.population).label("population"),
            )
            .where(models.MunicipalityPopulation.year == latest_year)
            .group_by(pop_county_expr)
            .subquery()
        )

        # Join and compute density, then rank all three metrics in one pass
        rank_query = select(
            company_counts.c.county_code,
            func.rank()
            .over(
                order_by=(
                    cast(company_counts.c.company_count, Float)
                    / func.nullif(cast(pop_counts.c.population, Float), 0)
                    * 1000
                ).desc()
            )
            .label("rank_density"),
            func.rank().over(order_by=company_counts.c.revenue.desc()).label("rank_revenue"),
            func.rank().over(order_by=pop_counts.c.population.desc()).label("rank_population"),
            func.count().over().label("total"),
        ).join(pop_counts, company_counts.c.county_code == pop_counts.c.county_code)

        result = await self.db.execute(rank_query)
        ranks = result.all()

        for r in ranks:
            if r.county_code == county_code:
                return {
                    "density": {"rank": r.rank_density, "out_of": r.total},
                    "revenue": {"rank": r.rank_revenue, "out_of": r.total},
                    "population": {"rank": r.rank_population, "out_of": r.total},
                }
        return None

    async def get_county_municipalities(self, county_code: str):
        """Get all municipalities in a county with their stats."""
        latest_year = await self.get_latest_population_year() or 2024

        query = (
            select(
                models.MunicipalityPopulation.municipality_code.label("code"),
                models.MunicipalityPopulation.name,
                models.MunicipalityPopulation.population,
                func.sum(models.MunicipalityStats.company_count).label("company_count"),
            )
            .join(
                models.MunicipalityStats,
                models.MunicipalityPopulation.municipality_code == models.MunicipalityStats.municipality_code,
                isouter=True,
            )
            .where(
                and_(
                    func.left(models.MunicipalityPopulation.municipality_code, 2) == county_code,
                    models.MunicipalityPopulation.year == latest_year,
                    # Filter out historical/merged municipalities without names
                    models.MunicipalityPopulation.name.isnot(None),
                    models.MunicipalityPopulation.name != "",
                )
            )
            .group_by(
                models.MunicipalityPopulation.municipality_code,
                models.MunicipalityPopulation.name,
                models.MunicipalityPopulation.population,
            )
            .order_by(func.sum(models.MunicipalityStats.company_count).desc().nullslast())
        )

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                "code": r.code,
                "name": r.name,
                "population": r.population,
                "company_count": r.company_count or 0,
            }
            for r in rows
        ]

    async def get_all_county_summaries(self):
        """Get summary stats for all counties (for index page)."""
        latest_year = await self.get_latest_population_year() or 2024

        # Use literal_column for GROUP BY to avoid SQLAlchemy expression issues
        query = (
            select(
                func.left(models.MunicipalityStats.municipality_code, 2).label("code"),
                func.sum(models.MunicipalityStats.company_count).label("company_count"),
                func.count(func.distinct(models.MunicipalityStats.municipality_code)).label("municipality_count"),
            )
            .group_by(literal_column("code"))
            .order_by(func.sum(models.MunicipalityStats.company_count).desc())
        )

        result = await self.db.execute(query)
        stats_rows = {r.code: r for r in result.all()}

        # Get population per county
        pop_query = (
            select(
                func.left(models.MunicipalityPopulation.municipality_code, 2).label("code"),
                func.sum(models.MunicipalityPopulation.population).label("population"),
            )
            .where(models.MunicipalityPopulation.year == latest_year)
            .group_by(literal_column("code"))
        )

        pop_result = await self.db.execute(pop_query)
        pop_rows = {r.code: r.population for r in pop_result.all()}

        return [
            {
                "code": code,
                "company_count": stats.company_count,
                "municipality_count": stats.municipality_count,
                "population": pop_rows.get(code),
            }
            for code, stats in stats_rows.items()
        ]

    async def get_industry_stats_list(
        self,
        sort_by: Literal[
            "company_count",
            "total_revenue",
            "avg_revenue",
            "total_employees",
            "bankrupt_count",
            "new_last_year",
            "bankruptcies_last_year",
            "avg_profit",
            "avg_operating_margin",
        ],
        sort_order: Literal["asc", "desc"],
        limit: int,
    ) -> Sequence[models.IndustryStats]:
        """Get sorted list of industry statistics from materialized view."""
        sort_columns = {
            "company_count": models.IndustryStats.company_count,
            "total_revenue": models.IndustryStats.total_revenue,
            "avg_revenue": models.IndustryStats.avg_revenue,
            "total_employees": models.IndustryStats.total_employees,
            "bankrupt_count": models.IndustryStats.bankrupt_count,
            "new_last_year": models.IndustryStats.new_last_year,
            "bankruptcies_last_year": models.IndustryStats.bankruptcies_last_year,
            "avg_profit": models.IndustryStats.avg_profit,
            "avg_operating_margin": models.IndustryStats.avg_operating_margin,
        }
        sort_column = sort_columns[sort_by]

        query = select(models.IndustryStats)
        if sort_order == "asc":
            query = query.order_by(sort_column.asc().nullslast())
        else:
            query = query.order_by(sort_column.desc().nullslast())

        query = query.limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_industry_stat_by_division(self, nace_division: str) -> models.IndustryStats | None:
        """Get statistics for a specific NACE division."""
        result = await self.db.execute(
            select(models.IndustryStats).where(models.IndustryStats.nace_division == nace_division)
        )
        return result.scalar_one_or_none()

    async def get_timeline_trends(
        self,
        metric: Literal["bankruptcies", "new_companies"],
        months: int,
        filters: FilterParams | None = None,
    ) -> list[dict[str, Any]]:
        """Get monthly counts for bankruptcies or new companies with optional filtering.

        Args:
            metric: Type of trend to fetch
            months: Number of months to look back
            filters: Optional FilterParams for NACE, county, etc.
        """
        from datetime import date, timedelta

        from repositories.company_filter_builder import CompanyFilterBuilder

        # Defense-in-depth: ensure months is integer even though FastAPI validates upstream
        safe_months = int(months)
        start_date = date.today().replace(day=1) - timedelta(days=30 * safe_months)

        date_col = models.Company.konkursdato if metric == "bankruptcies" else models.Company.stiftelsesdato

        query = select(
            func.date_trunc("month", date_col).label("month"),
            func.count(models.Company.orgnr).label("value"),
        ).where(
            and_(
                date_col.isnot(None),
                date_col >= start_date,
            )
        )

        # Apply filters if provided (NACE, location, status, etc.)
        if filters:
            builder = CompanyFilterBuilder(filters).apply_all()
            query = builder.apply_to_query(query)

        query = query.group_by("month").order_by("month")

        result = await self.db.execute(query)
        rows = result.all()

        return [{"label": r.month.strftime("%b %y") if r.month else "Ukjent", "value": r.value} for r in rows]

    # ------------------------------------------------------------------
    # Industry premium dashboard helpers
    # ------------------------------------------------------------------

    async def get_industry_subclasses(self, nace_division: str) -> Sequence[models.IndustrySubclassStats]:
        """Get all subclass stats for a 2-digit NACE division, sorted by company count."""
        prefix = nace_division + "."
        result = await self.db.execute(
            select(models.IndustrySubclassStats)
            .where(models.IndustrySubclassStats.nace_code.like(prefix + "%"))
            .order_by(models.IndustrySubclassStats.company_count.desc().nullslast())
        )
        return result.scalars().all()

    async def get_industry_county_distribution(self, nace_division: str, limit: int = 10) -> list[dict[str, Any]]:
        """Get top counties by company count for a specific NACE division."""
        result = await self.db.execute(
            select(
                models.CountyStats.county_code,
                models.CountyStats.company_count,
                models.CountyStats.total_employees,
            )
            .where(
                and_(
                    models.CountyStats.nace_division == nace_division,
                    models.CountyStats.company_count > 0,
                )
            )
            .order_by(models.CountyStats.company_count.desc().nullslast())
            .limit(limit)
        )
        return [
            {
                "code": r.county_code,
                "company_count": r.company_count or 0,
                "total_employees": r.total_employees,
            }
            for r in result.all()
        ]

    async def get_industry_all_rankings(
        self,
        nace_division: str,
    ) -> dict[str, dict[str, int]]:
        """Get rank of an industry among all industries for revenue, companies, and employees.

        Returns dict with keys 'total_revenue', 'company_count', 'total_employees',
        each containing {'rank': N, 'out_of': M}.
        Uses a single query with window functions for efficiency.
        """
        metrics = {
            "total_revenue": models.IndustryStats.total_revenue,
            "company_count": models.IndustryStats.company_count,
            "total_employees": models.IndustryStats.total_employees,
        }

        # Single query: get total count and target row values
        total_res = await self.db.execute(select(func.count()).select_from(models.IndustryStats))
        total = total_res.scalar() or 0

        target_res = await self.db.execute(
            select(
                models.IndustryStats.total_revenue,
                models.IndustryStats.company_count,
                models.IndustryStats.total_employees,
            ).where(models.IndustryStats.nace_division == nace_division)
        )
        target_row = target_res.one_or_none()
        if target_row is None:
            fallback = {"rank": total, "out_of": total}
            return dict.fromkeys(metrics, fallback)

        # One query to count higher values for all three metrics
        higher_res = await self.db.execute(
            select(
                func.count().filter(models.IndustryStats.total_revenue > target_row.total_revenue).label("rev"),
                func.count().filter(models.IndustryStats.company_count > target_row.company_count).label("comp"),
                func.count().filter(models.IndustryStats.total_employees > target_row.total_employees).label("emp"),
            ).select_from(models.IndustryStats)
        )
        higher = higher_res.one()

        return {
            "total_revenue": {"rank": (higher.rev or 0) + 1, "out_of": total},
            "company_count": {"rank": (higher.comp or 0) + 1, "out_of": total},
            "total_employees": {"rank": (higher.emp or 0) + 1, "out_of": total},
        }
