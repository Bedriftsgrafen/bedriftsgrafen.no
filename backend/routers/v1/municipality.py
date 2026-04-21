"""API endpoints for Municipality Dashboards ("Local Heroes")."""

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.municipality import MunicipalityListResponse, MunicipalityPremiumResponse
from services.stats_service import StatsService
from utils.redis_cache import RedisCache

router = APIRouter(prefix="/v1/municipality", tags=["municipality"])

# Cache full dashboard responses 1hr — municipality data changes at most nightly
_dashboard_cache = RedisCache(prefix="dashboard:municipality", ttl=3600)


@router.get("/", response_model=list[MunicipalityListResponse])
async def list_municipalities(
    db: AsyncSession = Depends(get_db),
) -> list[MunicipalityListResponse]:
    """
    List all municipalities with company counts for discovery.
    Used for sitemaps and explorer suggestions.
    """
    service = StatsService(db)
    # Reuse existing geography stats method for simplicity
    stats = await service.get_municipality_stats(metric="company_count")

    return [
        MunicipalityListResponse(
            code=s.code,
            name=s.name,
            slug=f"{s.code}-{s.name.lower().replace(' ', '-')}",
            company_count=s.value,
            population=s.population,
            lat=s.lat,
            lng=s.lng,
        )
        for s in stats
    ]


@router.get("/{code}", response_model=MunicipalityPremiumResponse)
async def get_municipality_dashboard(
    code: str = Path(..., min_length=4, max_length=4, pattern=r"^\d{4}$", description="4-digit municipality code"),
    db: AsyncSession = Depends(get_db),
) -> MunicipalityPremiumResponse:
    """
    Get consolidated premium dashboard data for a municipality.
    Includes population, trends, top sectors, and top companies.
    """
    cached = await _dashboard_cache.get(code)
    if cached is not None:
        return MunicipalityPremiumResponse.model_validate(cached)

    service = StatsService(db)
    dashboard = await service.get_municipality_premium_dashboard(code)

    if not dashboard or (not dashboard.get("population") and not dashboard.get("company_count")):
        raise HTTPException(status_code=404, detail=f"Municipality {code} not found")

    response = MunicipalityPremiumResponse.model_validate(dashboard)
    await _dashboard_cache.set(code, response.model_dump(mode="json"))
    return response
