import logging
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from services.dtos import IndustryStatsDTO

logger = logging.getLogger(__name__)

GeoMetric = Literal["company_count", "new_last_year", "bankrupt_count", "total_employees"]

class StatsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_industry_stats(self, nace_division: str) -> models.IndustryStats | None:
        """Get aggregated statistics for a specific NACE division (2-digit)."""
        result = await self.db.execute(
            select(models.IndustryStats).where(
                models.IndustryStats.nace_division == nace_division
            )
        )
        return result.scalar_one_or_none()

    async def get_industry_subclass_stats(self, nace_code: str) -> models.IndustrySubclassStats | None:
        """Get aggregated statistics for a specific NACE subclass (5-digit)."""
        result = await self.db.execute(
            select(models.IndustrySubclassStats).where(
                models.IndustrySubclassStats.nace_code == nace_code
            )
        )
        return result.scalar_one_or_none()

    async def get_county_stats(
        self, metric_col, nace: str | None = None
    ) -> list[models.CountyStats]:
        """Get raw county stats query result."""
        query = select(
            models.CountyStats.county_code.label("code"),
            func.sum(metric_col).label("value"),
        ).group_by(models.CountyStats.county_code)

        if nace:
            query = query.where(models.CountyStats.nace_division == nace)

        result = await self.db.execute(query)
        return result.all()

    async def get_municipality_stats(
        self, metric_col, nace: str | None = None, county_code: str | None = None
    ):
        """Get raw municipality stats query result."""
        query = select(
            models.MunicipalityStats.municipality_code.label("code"),
            func.sum(metric_col).label("value"),
        ).group_by(models.MunicipalityStats.municipality_code)

        if nace:
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

    async def get_municipality_populations(self, year: int | None = None) -> list[models.MunicipalityPopulation]:
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
        """Fetch distinct municipality names for cache."""
        result = await self.db.execute(
            select(
                models.Company.forretningsadresse["kommunenummer"].astext.label("code"),
                models.Company.forretningsadresse["kommune"].astext.label("name"),
            )
            .where(models.Company.forretningsadresse["kommunenummer"].isnot(None))
            .distinct()
        )
        return result.all()

    async def get_industry_stats_by_municipality(
        self, nace_code: str, municipality_code: str
    ) -> models.IndustryStats | IndustryStatsDTO | None:
        """
        Calculate industry financial stats for companies in a specific municipality.

        Returns an IndustryStats-like object with avg_revenue, avg_profit, etc.
        Uses LatestAccountings materialized view for efficient latest-year lookup.
        """
        from sqlalchemy import and_, case

        # Determine if we're filtering by full code (5-digit) or division (2-digit)
        is_subclass = len(nace_code) > 2
        nace_filter = (
            models.Company.naeringskode == nace_code if is_subclass
            else func.left(models.Company.naeringskode, 2) == nace_code
        )

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
                        (and_(models.LatestAccountings.salgsinntekter > 0, 
                              models.LatestAccountings.driftsresultat.isnot(None)),
                         (models.LatestAccountings.driftsresultat / models.LatestAccountings.salgsinntekter) * 100),
                        else_=None
                    )
                ).label("avg_operating_margin"),
                func.percentile_cont(0.5).within_group(
                    models.LatestAccountings.salgsinntekter
                ).label("median_revenue"),
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

