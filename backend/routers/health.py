from fastapi import APIRouter, Request

from limiter import limiter
from utils.redis_client import check_redis_health

router: APIRouter = APIRouter(tags=["health"])


@router.get("/health")
@limiter.limit("100/second")
async def health_check(request: Request):
    redis_ok = await check_redis_health()
    return {
        "status": "ok",
        "redis": "connected" if redis_ok else "unavailable",
    }

