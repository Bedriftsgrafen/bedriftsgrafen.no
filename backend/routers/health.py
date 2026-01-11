from fastapi import APIRouter, Request

from main import limiter

router = APIRouter(tags=["health"])


@router.get("/health")
@limiter.limit("100/second")
def health_check(request: Request):
    return {"status": "ok"}
