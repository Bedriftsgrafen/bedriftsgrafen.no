"""API endpoints for trend/timeline statistics."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

import models
from database import get_db

router = APIRouter(prefix="/v1/trends", tags=["Trends"])


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
    date_col = models.Company.konkursdato if metric == "bankruptcies" else models.Company.stiftelsesdato

    # Use subquery approach to avoid GROUP BY issues
    month_expr = func.to_char(date_col, "YYYY-MM")

    query = (
        select(month_expr.label("month"), func.count().label("count"))
        .where(date_col.isnot(None), date_col >= text(f"CURRENT_DATE - interval '{months} months'"))
        .group_by(month_expr)
        .order_by(month_expr)
    )

    result = await db.execute(query)
    rows = result.all()

    return [{"month": row.month, "count": row.count} for row in rows]
