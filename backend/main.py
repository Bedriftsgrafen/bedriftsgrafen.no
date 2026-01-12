import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from exceptions import BedriftsgrafenException
from middleware import RequestIdMiddleware
from utils.logging_config import setup_logging

# Setup structured logging before creating app
setup_logging(level=logging.INFO)

logger = logging.getLogger(__name__)

# Initialize rate limiter with get_remote_address as key function
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

from routers import health  # noqa: E402
from routers import admin_import  # noqa: E402
from routers import sitemap  # noqa: E402
from routers.v1 import companies as v1_companies  # noqa: E402
from routers.v1 import stats as v1_stats  # noqa: E402
from routers.v1 import trends as v1_trends  # noqa: E402
from services.company_service import CompanyService  # noqa: E402
from services.scheduler import SchedulerService  # noqa: E402

# Initialize scheduler service
scheduler_service = SchedulerService()


@asynccontextmanager
async def lifespan(app):
    """Application lifespan manager for startup/shutdown events."""
    # Startup
    start_scheduler = os.getenv("START_SCHEDULER", "true").lower() == "true"
    
    if start_scheduler:
        logger.info("Starting scheduler service...")
        await scheduler_service.start()
    else:
        logger.info("Scheduler service disabled (START_SCHEDULER=false)")
        
    yield
    
    # Shutdown
    if start_scheduler:
        logger.info("Shutting down scheduler service...")
        await scheduler_service.shutdown()


app = FastAPI(title="Bedriftsgrafen API", lifespan=lifespan)

# Attach limiter to app
app.state.limiter = limiter

# Add SlowAPI middleware
app.add_middleware(SlowAPIMiddleware)


# Exception handler for rate limit exceeded
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded errors"""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Maximum 100 requests per minute allowed.",
            "retry_after": exc.headers.get("retry-after", "60") if exc.headers else "60",
        },
        headers=exc.headers or {},
    )


# Add request tracking middleware (should be first)
app.add_middleware(RequestIdMiddleware)

# Enable CORS - reads from environment, defaults to "*" for development
cors_origins_raw = os.getenv("CORS_ORIGINS", "*")
cors_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler for custom domain exceptions
@app.exception_handler(BedriftsgrafenException)
async def bedriftsgrafen_exception_handler(request: Request, exc: BedriftsgrafenException):
    """Global exception handler for domain exceptions"""
    logger.error(
        f"Domain exception: {exc.message}",
        extra={"status_code": exc.status_code, "path": request.url.path, "exception_type": exc.__class__.__name__},
    )

    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "type": exc.__class__.__name__})


# Include routers
app.include_router(health.router)
# V1 API (new versioning)
app.include_router(v1_companies.router)
app.include_router(v1_stats.router)
app.include_router(v1_trends.router)
# Admin and utility routes
app.include_router(admin_import.router)
app.include_router(sitemap.router)


# NOTE: Table creation is now handled by Alembic migrations
# @app.on_event("startup")
# async def startup():
#     async with engine.begin() as conn:
#         await conn.run_sync(models.Base.metadata.create_all)
#         await conn.run_sync(models_import.Base.metadata.create_all)


@app.get("/")
@limiter.limit("10/second")
async def read_root(request: Request):
    return {"status": "online", "message": "Bedriftsgrafen API is running"}


@app.get("/stats")
@limiter.limit("5/second")
async def get_stats(request: Request, db: AsyncSession = Depends(get_db)):
    service = CompanyService(db)
    return await service.get_statistics()


