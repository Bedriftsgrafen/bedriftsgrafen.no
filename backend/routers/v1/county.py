"""API endpoints for County Dashboards (Fylker)."""

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession

from constants.county_coords import COUNTY_COORDS
from database import get_db
from schemas.county import CountyListResponse, CountyPremiumResponse
from services.stats_service import StatsService
from utils.redis_cache import RedisCache

router = APIRouter(prefix="/v1/county", tags=["county"])

# Cache full dashboard responses 1hr — county data changes at most nightly
_dashboard_cache = RedisCache(prefix="dashboard:county", ttl=3600)


@router.get("/", response_model=list[CountyListResponse])
async def list_counties(
    db: AsyncSession = Depends(get_db),
) -> list[CountyListResponse]:
    """
    List all counties with company counts for discovery.
    Used for sitemaps and county index page.
    """
    service = StatsService(db)
    county_stats = await service.get_all_counties_summary()

    return [
        CountyListResponse(
            code=cs["code"],
            name=cs["name"],
            company_count=cs["company_count"],
            municipality_count=cs["municipality_count"],
            population=cs["population"],
            lat=COUNTY_COORDS.get(cs["code"], (None, None))[0],
            lng=COUNTY_COORDS.get(cs["code"], (None, None))[1],
        )
        for cs in county_stats
    ]


@router.get("/{code}", response_model=CountyPremiumResponse)
async def get_county_dashboard(
    code: str = Path(..., min_length=2, max_length=2, pattern=r"^\d{2}$", description="2-digit county code"),
    db: AsyncSession = Depends(get_db),
) -> CountyPremiumResponse:
    """
    Get consolidated premium dashboard data for a county.
    Includes population, trends, top sectors, top companies, and municipalities.
    """
    cached = await _dashboard_cache.get(code)
    if cached is not None:
        return CountyPremiumResponse.model_validate(cached)

    service = StatsService(db)
    dashboard = await service.get_county_premium_dashboard(code)

    if not dashboard or (not dashboard.get("population") and not dashboard.get("company_count")):
        raise HTTPException(status_code=404, detail=f"County {code} not found")

    response = CountyPremiumResponse.model_validate(dashboard)
    await _dashboard_cache.set(code, response.model_dump(mode="json"))
    return response
