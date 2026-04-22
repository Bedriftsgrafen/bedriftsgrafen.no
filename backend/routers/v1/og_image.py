"""API endpoints for Dynamic OpenGraph (OG) images."""

import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from limiter import limiter
from services.seo_service import SEOService
from services.stats_service import StatsService
from utils.logging_config import sanitize_log

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/og", tags=["seo"])

_CACHE_HEADER = "public, max-age=3600, s-maxage=86400"


def _svg_response(svg: str) -> Response:
    """Return an SVG response with standard cache headers."""
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": _CACHE_HEADER},
    )


@router.get("/company/{orgnr}.svg")
@limiter.limit("60/minute")
async def get_company_og_svg(request: Request, orgnr: str, db: AsyncSession = Depends(get_db)):
    """Generates a dynamic SVG OpenGraph card for a company."""
    try:
        seo_service = SEOService(db)
        data = await seo_service.get_company_og_data(orgnr)
        if not data:
            return Response(status_code=404)
        return _svg_response(seo_service.generate_company_og_svg(data))
    except Exception:
        logger.exception("Error generating company OG SVG for %s", sanitize_log(orgnr))
        return Response(status_code=404)


@router.get("/municipality/{code}.svg")
@limiter.limit("60/minute")
async def get_municipality_og_svg(request: Request, code: str, db: AsyncSession = Depends(get_db)):
    """Generates a dynamic SVG OpenGraph card for a municipality."""
    try:
        stats_service = StatsService(db)
        seo_service = SEOService(db)
        dashboard = await stats_service.get_municipality_premium_dashboard(code)
        if not dashboard:
            return Response(status_code=404)
        return _svg_response(seo_service.generate_municipality_og_svg(dashboard))
    except Exception:
        logger.exception("Error generating municipality OG SVG for %s", sanitize_log(code))
        return Response(status_code=404)


@router.get("/county/{code}.svg")
@limiter.limit("60/minute")
async def get_county_og_svg(request: Request, code: str, db: AsyncSession = Depends(get_db)):
    """Generates a dynamic SVG OpenGraph card for a county."""
    try:
        stats_service = StatsService(db)
        seo_service = SEOService(db)
        dashboard = await stats_service.get_county_premium_dashboard(code)
        if not dashboard:
            return Response(status_code=404)
        return _svg_response(seo_service.generate_county_og_svg(dashboard))
    except Exception:
        logger.exception("Error generating county OG SVG for %s", sanitize_log(code))
        return Response(status_code=404)


@router.get("/industry/{code}.svg")
@limiter.limit("60/minute")
async def get_industry_og_svg(request: Request, code: str, db: AsyncSession = Depends(get_db)):
    """Generates a dynamic SVG OpenGraph card for an industry division."""
    try:
        stats_service = StatsService(db)
        seo_service = SEOService(db)
        dashboard = await stats_service.get_industry_premium_dashboard(code)
        if not dashboard:
            return Response(status_code=404)
        return _svg_response(seo_service.generate_industry_og_svg(dashboard))
    except Exception:
        logger.exception("Error generating industry OG SVG for %s", sanitize_log(code))
        return Response(status_code=404)
