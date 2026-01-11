"""API endpoints for statistics and analytics."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.counties import COUNTY_NAMES, get_county_name
from constants.nace import get_nace_name
from database import get_db
from schemas.benchmark import IndustryBenchmarkResponse
from schemas.stats import GeoAveragesResponse, GeoStatResponse, IndustryStatResponse
from services.stats_service import GeoLevel, GeoMetric, StatsService

router = APIRouter(prefix="/v1/stats", tags=["statistics"])

# Type alias for sort field validation
# All fields map directly to indexed columns in industry_stats materialized view
# Safe: FastAPI validates input against Literal type before handler is called
SortField = Literal[
    "company_count",        # Primary sort (default)
    "total_revenue",        # Indexed: DESC NULLS LAST
    "avg_revenue",
    "total_employees",      # Indexed: DESC NULLS LAST
    "bankrupt_count",
    "new_last_year",
    "bankruptcies_last_year",
    "avg_profit",           # Added for frontend column picker
    "avg_operating_margin", # Added for frontend column picker
]




def _enrich_with_nace_name(stat: models.IndustryStats) -> IndustryStatResponse:
    """Convert ORM model to response with NACE name enrichment.

    Single source of truth for model -> response conversion (DRY).
    """
    response = IndustryStatResponse.model_validate(stat)
    response.nace_name = get_nace_name(stat.nace_division)
    return response


# Column mapping for sort validation
_SORT_COLUMNS = {
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


@router.get("/industries", response_model=list[IndustryStatResponse])
async def get_industry_stats(
    sort_by: SortField = Query("company_count", description="Field to sort by"),
    sort_order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results"),
    db: AsyncSession = Depends(get_db),
) -> list[IndustryStatResponse]:
    """
    Get aggregated statistics per industry (NACE division).

    Data is served from the `industry_stats` materialized view which is
    refreshed nightly. Results are cached for 1 hour on the frontend.
    """
    sort_column = _SORT_COLUMNS[sort_by]  # Safe: Literal type guarantees valid key

    query = select(models.IndustryStats)

    if sort_order == "asc":
        query = query.order_by(sort_column.asc().nullslast())
    else:
        query = query.order_by(sort_column.desc().nullslast())

    query = query.limit(limit)

    result = await db.execute(query)
    stats = result.scalars().all()

    return [_enrich_with_nace_name(stat) for stat in stats]


@router.get("/industries/{nace_division}", response_model=IndustryStatResponse)
async def get_industry_stat(
    nace_division: str = Path(
        ..., min_length=2, max_length=2, pattern=r"^\d{2}$", description="NACE division code (2 digits, e.g., '68')"
    ),
    db: AsyncSession = Depends(get_db),
) -> IndustryStatResponse:
    """Get statistics for a specific industry (NACE division)."""
    result = await db.execute(select(models.IndustryStats).where(models.IndustryStats.nace_division == nace_division))
    stat = result.scalar_one_or_none()

    if not stat:
        raise HTTPException(status_code=404, detail=f"Industry with NACE division '{nace_division}' not found")

    return _enrich_with_nace_name(stat)


@router.get("/industries/{nace_code}/benchmark/{orgnr}", response_model=IndustryBenchmarkResponse)
async def get_industry_benchmark(
    nace_code: str = Path(
        ...,
        min_length=2,
        max_length=6,
        pattern=r"^(\d{2}|\d{2}\.\d{3})$",
        description="NACE code: 2 digits (e.g., '62') or 5 digits with dot (e.g., '62.010')"
    ),
    orgnr: str = Path(..., min_length=9, max_length=9, pattern=r"^\d{9}$", description="Organization number"),
    municipality_code: str | None = Query(
        None,
        min_length=4,
        max_length=4,
        pattern=r"^\d{4}$",
        description="Optional 4-digit municipality code for local comparison"
    ),
    db: AsyncSession = Depends(get_db),
) -> IndustryBenchmarkResponse:
    """
    Get benchmark comparison for a company against its industry.

    Optionally filter by municipality for local comparison.
    Automatically falls back from 5-digit (subclass) to 2-digit (division)
    if insufficient data exists at the subclass level.
    """
    service = StatsService(db)
    benchmark = await service.get_industry_benchmark(nace_code, orgnr, municipality_code)

    if not benchmark:
        # If fallback failed completely - no data available at any level
        nace_div = nace_code[:2]
        location_hint = f" in municipality {municipality_code}" if municipality_code else ""
        raise HTTPException(
            status_code=404,
            detail=(
                f"No benchmark data available for company {orgnr} in industry {nace_code}{location_hint}. "
                f"This can occur if: (1) the company lacks financial data, "
                f"(2) industry {nace_div} has insufficient companies for statistics, or "
                f"(3) the NACE code is not recognized."
            ),
        )

    # Enrich with NACE name matching the code level used
    benchmark["nace_name"] = get_nace_name(benchmark["nace_code"])

    return benchmark

# =============================================================================
# Geographic Statistics (for choropleth map)
# =============================================================================

# Import from constants for backwards compatibility in this file


# Norwegian municipality names (loaded from database on first request)
# Code moved to StatsService to avoid duplication





@router.get("/geography", response_model=list[GeoStatResponse])
async def get_geography_stats(
    level: GeoLevel = Query("county", description="Geographic level: county or municipality"),
    nace: str | None = Query(
        None, min_length=2, max_length=2, pattern=r"^\d{2}$", description="NACE division code (2 digits)"
    ),
    metric: GeoMetric = Query("company_count", description="Metric to aggregate"),
    county_code: str | None = Query(
        None, min_length=2, max_length=2, pattern=r"^\d{2}$", description="Filter by county code (2 digits)"
    ),
    db: AsyncSession = Depends(get_db),
) -> list[GeoStatResponse]:
    """
    Get aggregated statistics per region for geographic visualization.

    - level=county: Returns data per fylke (15 regions)
    - level=municipality: Returns data per kommune (356 regions)
    - county_code: Filter municipalities to a specific county
    """
    service = StatsService(db)
    return await service.get_geography_stats(level=level, metric=metric, nace=nace, county_code=county_code)


@router.get("/geography/averages", response_model=GeoAveragesResponse)
async def get_geography_averages(
    level: GeoLevel = Query("county", description="Geographic level for averages"),
    nace: str | None = Query(
        None, min_length=2, max_length=2, pattern=r"^\d{2}$", description="NACE division code (2 digits)"
    ),
    metric: GeoMetric = Query("company_count", description="Metric to average"),
    county_code: str | None = Query(
        None, min_length=2, max_length=2, pattern=r"^\d{2}$", description="County code (2 digits)"
    ),
    db: AsyncSession = Depends(get_db),
) -> GeoAveragesResponse:
    """Get national and county averages for comparison."""

    # Explicit metric column mapping (avoid getattr for safety)
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

    # Get national total and average
    if level == "county":
        metric_col = county_metric_columns[metric]
        query = select(func.sum(metric_col).label("total"))
        if nace:
            query = query.where(models.CountyStats.nace_division == nace)
        result = await db.execute(query)
        national_total = result.scalar() or 0
        national_avg = national_total / len(COUNTY_NAMES) if COUNTY_NAMES else 0
    else:
        metric_col = municipality_metric_columns[metric]
        query = select(
            func.sum(metric_col).label("total"),
            func.count(func.distinct(models.MunicipalityStats.municipality_code)).label("count"),
        )
        if nace:
            query = query.where(models.MunicipalityStats.nace_division == nace)
        result = await db.execute(query)
        row = result.one()
        national_total = row.total or 0
        national_avg = national_total / row.count if row.count else 0

    # Get county average if requested
    county_avg = None
    county_total = None
    county_name = None

    if county_code and level == "municipality":
        county_metric_col = municipality_metric_columns[metric]
        query = select(
            func.sum(county_metric_col).label("total"),
            func.count(func.distinct(models.MunicipalityStats.municipality_code)).label("count"),
        ).where(func.left(models.MunicipalityStats.municipality_code, 2) == county_code)
        if nace:
            query = query.where(models.MunicipalityStats.nace_division == nace)
        result = await db.execute(query)
        row = result.one()
        county_total = row.total or 0
        county_avg = county_total / row.count if row.count else 0
        county_name = get_county_name(county_code)

    return GeoAveragesResponse(
        national_avg=round(national_avg, 1),
        national_total=national_total,
        county_avg=round(county_avg, 1) if county_avg is not None else None,
        county_total=county_total,
        county_name=county_name,
    )
