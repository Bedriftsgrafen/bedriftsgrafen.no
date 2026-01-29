import logging
from datetime import datetime
from typing import Literal, Sequence, Any

from sqlalchemy import func, select, and_, case, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.nace import NACE_SECTION_MAPPING
from repositories.company_filter_builder import FilterParams
from services.dtos import IndustryStatsDTO

logger = logging.getLogger(__name__)

GeoMetric = Literal["company_count", "new_last_year", "bankrupt_count", "total_employees"]


class StatsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

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
        """Get the most recent year with population data."""
        from sqlalchemy import func as sa_func

        query = select(sa_func.max(models.MunicipalityPopulation.year))
        result = await self.db.execute(query)
        return result.scalar()

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
        from typing import Any

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
                func.avg(models.Company.antall_ansatte).label("avg_employees"),
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
                    models.Company.forretningsadresse["kommunenummer"].astext == municipality_code,
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

    async def get_filtered_geography_stats(
        self,
        level: Literal["county", "municipality"],
        metric: GeoMetric,
        filters: FilterParams,
    ) -> Sequence[Any]:
        """
        Get live, filtered geographic statistics by aggregating the bedrifter table.
        Used when advanced filters (org form, revenue, etc.) are present.
        """
        from repositories.company_filter_builder import CompanyFilterBuilder

        # Determine geographic column
        if level == "county":
            geo_col = func.left(models.Company.forretningsadresse["kommunenummer"].astext, 2).label("code")
        else:
            geo_col = models.Company.forretningsadresse["kommunenummer"].astext.label("code")

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

    async def get_municipality_premium_summary(self, municipality_code: str):
        """
        Get high-level summary for a municipality:
        - Population (latest + growth if available)
        - Total companies, employees, new last year
        - National density comparison
        """
        # 1. Fetch population (latest and previous year for growth)
        pop_query = (
            select(models.MunicipalityPopulation)
            .where(models.MunicipalityPopulation.municipality_code == municipality_code)
            .order_by(models.MunicipalityPopulation.year.desc())
            .limit(2)
        )

        pop_res = await self.db.execute(pop_query)
        pop_rows = pop_res.scalars().all()

        latest_pop = pop_rows[0].population if pop_rows else 0
        prev_pop = pop_rows[1].population if len(pop_rows) > 1 else None
        pop_growth = ((latest_pop - prev_pop) / prev_pop * 100) if prev_pop else None

        # 2. Fetch basic company stats (aggregated from MunicipalityStats)
        stats_query = select(
            func.sum(models.MunicipalityStats.company_count).label("company_count"),
            func.sum(models.MunicipalityStats.total_employees).label("total_employees"),
            func.sum(models.MunicipalityStats.new_last_year).label("new_last_year"),
        ).where(models.MunicipalityStats.municipality_code == municipality_code)

        stats_res = await self.db.execute(stats_query)
        stats_row = stats_res.one_or_none()

        # 3. Get national density (all companies / all population)
        # Performance: This could be cached or pre-calculated in a real scenario
        national_stats_query = select(func.sum(models.MunicipalityStats.company_count).label("total_companies"))
        national_pop_query = select(func.sum(models.MunicipalityPopulation.population)).where(
            models.MunicipalityPopulation.year == (pop_rows[0].year if pop_rows else 2024)
        )

        n_stats_res = await self.db.execute(national_stats_query)
        n_pop_res = await self.db.execute(national_pop_query)

        total_n_companies = n_stats_res.scalar() or 0
        total_n_pop = n_pop_res.scalar() or 1  # avoid div zero
        national_density = total_n_companies / total_n_pop * 1000

        return {
            "population": latest_pop,
            "population_growth_1y": pop_growth,
            "company_count": stats_row.company_count if stats_row else 0,
            "total_employees": stats_row.total_employees if stats_row else 0,
            "new_last_year": stats_row.new_last_year if stats_row else 0,
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

        total_count = sum(r.company_count for r in rows) or 1

        return [
            {
                "nace_division": r.nace_division,
                "nace_name": get_nace_name(r.nace_division),
                "company_count": r.company_count,
                "percentage_of_total": (r.company_count / total_count * 100) if total_count else 0,
            }
            for r in rows
        ]

    async def get_municipality_rankings(
        self, municipality_code: str, metric: Literal["density", "revenue", "population"] = "density"
    ):
        """Get rankings for various metrics within the county."""
        from sqlalchemy import Float, cast

        county_code = municipality_code[:2]
        latest_year = await self.get_latest_population_year() or 2024

        if metric == "density":
            # Subquery for all municipalities in the county with density
            muni_data = (
                select(
                    models.MunicipalityStats.municipality_code,
                    (
                        cast(func.sum(models.MunicipalityStats.company_count), Float)
                        / cast(models.MunicipalityPopulation.population, Float)
                        * 1000
                    ).label("value"),
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
        elif metric == "population":
            # Rank by population
            muni_data = (
                select(
                    models.MunicipalityPopulation.municipality_code,
                    models.MunicipalityPopulation.population.label("value"),
                )
                .where(
                    and_(
                        func.left(models.MunicipalityPopulation.municipality_code, 2) == county_code,
                        models.MunicipalityPopulation.year == latest_year,
                    )
                )
                .subquery()
            )
        else:
            # Rank by total revenue
            muni_data = (
                select(
                    models.MunicipalityStats.municipality_code,
                    func.sum(models.MunicipalityStats.total_revenue).label("value"),
                )
                .where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)
                .group_by(models.MunicipalityStats.municipality_code)
                .subquery()
            )

        # Rank by metric
        rank_query = select(
            muni_data.c.municipality_code,
            func.rank().over(order_by=muni_data.c.value.desc()).label("rank"),
            func.count().over().label("total"),
        ).select_from(muni_data)

        result = await self.db.execute(rank_query)
        ranks = result.all()

        for r in ranks:
            if r.municipality_code == municipality_code:
                return {"rank": r.rank, "out_of": r.total}
        return None

    async def get_establishment_trend(self, municipality_code: str, months: int = 12):
        """Get monthly registration counts for the last X months."""
        from datetime import date, timedelta

        start_date = date.today().replace(day=1) - timedelta(days=30 * months)

        query = (
            select(
                func.date_trunc("month", models.Company.stiftelsesdato).label("month"),
                func.count(models.Company.orgnr).label("count"),
            )
            .where(
                and_(
                    models.Company.forretningsadresse["kommunenummer"].astext == municipality_code,
                    models.Company.stiftelsesdato >= start_date,
                )
            )
            .group_by("month")
            .order_by("month")
        )

        result = await self.db.execute(query)
        rows = result.all()

        return [{"label": r.month.strftime("%b %y") if r.month else "Ukjent", "value": r.count} for r in rows]

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

    async def get_county_premium_summary(self, county_code: str):
        """
        Get high-level summary for a county:
        - Population (aggregated from municipalities)
        - Total companies, employees, municipality count
        - National density comparison
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

        population = pop_row.population if pop_row else 0
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
        pop_growth = ((population - prev_pop) / prev_pop * 100) if prev_pop else None

        # 2. Fetch aggregated company stats for the county (uses idx_municipality_stats_county)
        stats_query = select(
            func.sum(models.MunicipalityStats.company_count).label("company_count"),
            func.sum(models.MunicipalityStats.total_employees).label("total_employees"),
            func.sum(models.MunicipalityStats.new_last_year).label("new_last_year"),
            func.sum(models.MunicipalityStats.total_revenue).label("total_revenue"),
        ).where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)

        stats_res = await self.db.execute(stats_query)
        stats_row = stats_res.one_or_none()

        # 3. Get national totals for density comparison
        national_stats_query = select(func.sum(models.MunicipalityStats.company_count).label("total_companies"))
        national_pop_query = select(func.sum(models.MunicipalityPopulation.population)).where(
            models.MunicipalityPopulation.year == latest_year
        )

        n_stats_res = await self.db.execute(national_stats_query)
        n_pop_res = await self.db.execute(national_pop_query)

        total_n_companies = n_stats_res.scalar() or 0
        total_n_pop = n_pop_res.scalar() or 1
        national_density = total_n_companies / total_n_pop * 1000

        return {
            "population": population,
            "population_growth_1y": pop_growth,
            "company_count": stats_row.company_count if stats_row else 0,
            "total_employees": stats_row.total_employees if stats_row else 0,
            "new_last_year": stats_row.new_last_year if stats_row else 0,
            "total_revenue": stats_row.total_revenue if stats_row else 0,
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

        total_count = sum(r.company_count for r in rows) or 1

        return [
            {
                "nace_division": r.nace_division,
                "nace_name": get_nace_name(r.nace_division),
                "company_count": r.company_count,
                "total_employees": r.total_employees,
                "percentage_of_total": (r.company_count / total_count * 100) if total_count else 0,
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

    async def get_county_establishment_trend(self, county_code: str, months: int = 12):
        """Get monthly registration counts for a county."""
        from datetime import date, timedelta

        start_date = date.today().replace(day=1) - timedelta(days=30 * months)

        query = (
            select(
                func.date_trunc("month", models.Company.stiftelsesdato).label("month"),
                func.count(models.Company.orgnr).label("count"),
            )
            .where(
                and_(
                    func.left(models.Company.forretningsadresse["kommunenummer"].astext, 2) == county_code,
                    models.Company.stiftelsesdato >= start_date,
                )
            )
            .group_by("month")
            .order_by("month")
        )

        result = await self.db.execute(query)
        rows = result.all()

        return [{"label": r.month.strftime("%b %y") if r.month else "Ukjent", "value": r.count} for r in rows]

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
        self, metric: Literal["bankruptcies", "new_companies"], months: int
    ) -> list[dict[str, int | str]]:
        """Get monthly counts for bankruptcies or new companies.

        Args:
            metric: Type of trend to fetch
            months: Number of months to look back (1-36, validated upstream)
        """
        from sqlalchemy import text

        # Defense-in-depth: ensure months is integer even though FastAPI validates upstream
        safe_months = int(months)

        date_col = models.Company.konkursdato if metric == "bankruptcies" else models.Company.stiftelsesdato
        month_expr = func.to_char(date_col, "YYYY-MM")

        query = (
            select(month_expr.label("month"), func.count().label("cnt"))
            .where(date_col.isnot(None), date_col >= text(f"CURRENT_DATE - interval '{safe_months} months'"))
            .group_by(month_expr)
            .order_by(month_expr)
        )

        result = await self.db.execute(query)
        rows = result.all()
        return [{"month": row.month, "count": row.cnt} for row in rows]
