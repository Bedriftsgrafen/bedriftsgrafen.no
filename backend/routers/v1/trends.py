"""API endpoints for trend/timeline statistics."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from repositories.stats_repository import StatsRepository

router: APIRouter = APIRouter(prefix="/v1/trends", tags=["Trends"])


@router.get("/timeline")
async def get_trends_timeline(
    metric: Literal["bankruptcies", "new_companies"] = Query(
        ..., description="Which metric to get: bankruptcies or new_companies"
    ),
    months: int = Query(12, ge=1, le=36, description="Number of months to look back"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get monthly counts for selected metric.

    Returns array of {month: "2024-01", count: 123} objects sorted by month.
    """
    repo = StatsRepository(db)
    return await repo.get_timeline_trends(metric, months)
