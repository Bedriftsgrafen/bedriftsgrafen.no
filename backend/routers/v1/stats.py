"""API endpoints for statistics and analytics."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from constants.nace import get_nace_name
from database import get_db
from dependencies.company_filters import CompanyQueryParams
from repositories.company_filter_builder import FilterParams
from schemas.benchmark import IndustryBenchmarkResponse
from schemas.industry import IndustryPremiumResponse
from schemas.municipality import TrendPoint
from schemas.stats import GeoAveragesResponse, GeoLevel, GeoMetric, GeoStatResponse, IndustryStatResponse
from services.stats_service import StatsService

router: APIRouter = APIRouter(prefix="/v1/stats", tags=["statistics"])

# Type alias for sort field validation
# All fields map directly to indexed columns in industry_stats materialized view
# Safe: FastAPI validates input against Literal type before handler is called
SortField = Literal[
    "company_count",  # Primary sort (default)
    "total_revenue",  # Indexed: DESC NULLS LAST
    "avg_revenue",
    "total_employees",  # Indexed: DESC NULLS LAST
    "bankrupt_count",
    "new_last_year",
    "bankruptcies_last_year",
    "avg_profit",  # Added for frontend column picker
    "avg_operating_margin",  # Added for frontend column picker
]


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
    service = StatsService(db)
    return await service.get_industry_stats_list(sort_by, sort_order, limit)


@router.get("/industries/{nace_division}", response_model=IndustryStatResponse)
async def get_industry_stat(
    nace_division: str = Path(
        ...,
        min_length=1,
        max_length=2,
        pattern=r"^([A-U]|\d{2})$",
        description="NACE division code (2 digits) or section letter (A-U)",
    ),
    db: AsyncSession = Depends(get_db),
) -> IndustryStatResponse:
    """Get statistics for a specific industry (NACE division)."""
    service = StatsService(db)
    result = await service.get_industry_stat_by_division(nace_division)

    if not result:
        raise HTTPException(status_code=404, detail=f"Industry with NACE division '{nace_division}' not found")

    return result


@router.get("/industries/{nace_division}/dashboard", response_model=IndustryPremiumResponse)
async def get_industry_dashboard(
    nace_division: str = Path(
        ...,
        min_length=2,
        max_length=2,
        pattern=r"^\d{2}$",
        description="2-digit NACE division code (e.g. 62)",
    ),
    db: AsyncSession = Depends(get_db),
) -> IndustryPremiumResponse:
    """Get premium dashboard data for a specific industry (NACE division).

    Returns consolidated stats, trends, top companies, subclass breakdown,
    geographic distribution, and industry rankings.
    """
    service = StatsService(db)
    result = await service.get_industry_premium_dashboard(nace_division)

    if not result:
        raise HTTPException(status_code=404, detail=f"Industry with NACE division '{nace_division}' not found")

    return IndustryPremiumResponse(**result)


@router.get("/industries/{nace_code}/benchmark/{orgnr}", response_model=IndustryBenchmarkResponse)
async def get_industry_benchmark(
    nace_code: str = Path(
        ...,
        min_length=1,
        max_length=12,
        pattern=r"^([A-U]|\d{2}|\d{2}\.\d{3})$",
        description="NACE code: section letter (A-U), 2nd-digit division, or 5-digit subclass",
    ),
    orgnr: str = Path(..., min_length=9, max_length=9, pattern=r"^\d{9}$", description="Organization number"),
    municipality_code: str | None = Query(
        None,
        min_length=1,
        max_length=12,
        pattern=r"^(\d{4})$",
        description="Optional 4-digit municipality code for local comparison",
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

    return IndustryBenchmarkResponse.model_validate(benchmark)


# =============================================================================
# Geographic Statistics (for choropleth map)
# =============================================================================

# Import from constants for backwards compatibility in this file


# Norwegian municipality names (loaded from database on first request)
# Code moved to StatsService to avoid duplication


@router.get("/geography", response_model=list[GeoStatResponse])
async def get_geography_stats(
    level: GeoLevel = Query("county", description="Geographic level: county or municipality"),
    metric: GeoMetric = Query("company_count", description="Metric to aggregate"),
    nace: str | None = Query(
        None,
        min_length=1,
        max_length=12,
        pattern=r"^([A-U]|\d{2}|\d{2}\.\d{3})$",
        description="NACE code: section letter (A-U), 2nd-digit division, or 5-digit subclass",
    ),
    county_code: str | None = Query(
        None, min_length=2, max_length=10, pattern=r"^\d{2}$", description="Filter by county code (2 digits)"
    ),
    params: CompanyQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> list[GeoStatResponse]:
    """
    Get aggregated statistics per region for geographic visualization.

    - level=county: Returns data per fylke (15 regions)
    - level=municipality: Returns data per kommune (356 regions)
    - county_code: Filter municipalities to a specific county
    """
    # Build filters, overlaying legacy individual params if provided
    filters = FilterParams.from_dto(params.to_dto())
    if nace:
        filters.naeringskode = nace
    if county_code:
        filters.county = county_code

    service = StatsService(db)
    return await service.get_geography_stats(level=level, metric=metric, filters=filters)


@router.get("/geography/averages", response_model=GeoAveragesResponse)
async def get_geography_averages(
    level: GeoLevel = Query("county", description="Geographic level for averages"),
    metric: GeoMetric = Query("company_count", description="Metric to average"),
    nace: str | None = Query(
        None,
        min_length=1,
        max_length=12,
        pattern=r"^([A-U]|\d{2}|\d{2}\.\d{3})$",
        description="NACE code: section letter (A-U), 2nd-digit division, or 5-digit subclass",
    ),
    county_code: str | None = Query(
        None, min_length=2, max_length=10, pattern=r"^\d{2}$", description="County code (2 digits)"
    ),
    params: CompanyQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> GeoAveragesResponse:
    """Get national and county averages for comparison."""
    # Build filters, overlaying legacy individual params if provided
    filters = FilterParams.from_dto(params.to_dto())
    if nace:
        filters.naeringskode = nace
    if county_code:
        filters.county = county_code

    service = StatsService(db)
    return await service.get_geography_averages(
        level=level, metric=metric, filters=filters, county_code_context=county_code
    )


@router.get("/timeline", response_model=list[TrendPoint])
async def get_timeline_stats(
    metric: Literal["bankruptcies", "new_companies"] = Query(..., description="Metric for trend"),
    months: int = Query(12, ge=1, le=36, description="Months to look back"),
    params: CompanyQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> list[TrendPoint]:
    """Get monthly registration or bankruptcy counts with optional filtering."""
    # Build filters from query params
    filters = FilterParams.from_dto(params.to_dto())

    service = StatsService(db)
    data = await service.get_timeline_trends(metric=metric, months=months, filters=filters)
    return [TrendPoint.model_validate(p) for p in data]
