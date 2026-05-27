"""Public activity and freshness endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from limiter import limiter
from schemas.activity import ActivityOverviewResponse, CompanyEventListResponse
from services.activity_service import ActivityService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/activity", tags=["activity"])


def get_activity_service(db: AsyncSession = Depends(get_db)) -> ActivityService:
    return ActivityService(db)


@router.get("/overview", response_model=ActivityOverviewResponse)
@limiter.limit("30/minute")
async def get_activity_overview(
    request: Request,
    limit: int = Query(12, ge=1, le=24),
    service: ActivityService = Depends(get_activity_service),
) -> ActivityOverviewResponse:
    try:
        return await service.get_overview(limit=limit)
    except Exception as exc:
        logger.exception("Error fetching activity overview")
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.get("/events/{orgnr}", response_model=CompanyEventListResponse)
@limiter.limit("30/minute")
async def get_company_events(
    request: Request,
    orgnr: str = Path(..., pattern=r"^\d{9}$"),
    limit: int = Query(25, ge=1, le=50),
    offset: int = Query(0, ge=0, le=5000),
    service: ActivityService = Depends(get_activity_service),
) -> CompanyEventListResponse:
    if not service.event_ledger_enabled:
        raise HTTPException(status_code=503, detail="Event ledger is not enabled")

    try:
        return await service.get_company_events(orgnr=orgnr, limit=limit, offset=offset)
    except Exception as exc:
        logger.exception("Error fetching company events")
        raise HTTPException(status_code=500, detail="Internal server error") from exc
