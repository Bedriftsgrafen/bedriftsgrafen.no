import logging

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from database import AsyncSessionLocal
from limiter import limiter
from utils.redis_client import check_redis_health

router: APIRouter = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


async def check_database_health() -> bool:
    """Verify that the API can acquire a DB connection and execute a trivial query."""
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database health check failed: %s", exc)
        return False


@router.get("/health/live")
@limiter.limit("100/second")
async def liveness_check(request: Request):
    return {"status": "ok"}


@router.get("/health/ready")
@limiter.limit("100/second")
async def readiness_check(request: Request):
    database_ok = await check_database_health()
    redis_ok = await check_redis_health()
    ready = database_ok and redis_ok

    payload = {
        "status": "ready" if ready else "not_ready",
        "database": "connected" if database_ok else "unavailable",
        "redis": "connected" if redis_ok else "unavailable",
    }
    if ready:
        return payload
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=payload)


@router.get("/health")
@limiter.limit("100/second")
async def health_check(request: Request):
    database_ok = await check_database_health()
    redis_ok = await check_redis_health()
    return {
        "status": "ok" if database_ok and redis_ok else "degraded",
        "database": "connected" if database_ok else "unavailable",
        "redis": "connected" if redis_ok else "unavailable",
    }
