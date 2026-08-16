import logging
import os
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, CollectorRegistry, generate_latest, multiprocess
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import TimeoutError as SATimeoutError
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from exceptions import BedriftsgrafenException
from limiter import limiter
from middleware import RequestIdMiddleware, SecurityHeadersMiddleware
from utils.logging_config import setup_logging
from utils.metrics import RATE_LIMIT_RESPONSES_TOTAL, init_metrics

# Setup structured logging before creating app
setup_logging(level=logging.INFO)

# Initialize Prometheus metrics
init_metrics()

logger = logging.getLogger(__name__)

from routers import (  # noqa: E402
    admin_import,
    health,
    sitemap,
)
from routers.v1 import activity as v1_activity  # noqa: E402
from routers.v1 import affiliates as v1_affiliates  # noqa: E402
from routers.v1 import client_errors as v1_client_errors  # noqa: E402
from routers.v1 import companies as v1_companies  # noqa: E402
from routers.v1 import county as v1_county  # noqa: E402
from routers.v1 import municipality as v1_municipality  # noqa: E402
from routers.v1 import og_image as v1_og_image  # noqa: E402
from routers.v1 import people as v1_people  # noqa: E402
from routers.v1 import stats as v1_stats  # noqa: E402
from routers.v1 import trends as v1_trends  # noqa: E402
from services.brreg_egress_guard import load_brreg_egress_guard_config  # noqa: E402
from services.company_service import CompanyService  # noqa: E402
from services.scheduler import SchedulerService  # noqa: E402
from services.seo_service import SEOService  # noqa: E402


async def warm_sitemap_cache() -> None:
    """
    Pre-warm sitemap cache on startup.

    Tries Redis first (fast, populated by worker's scheduler).
    Falls back to full DB refresh only if Redis is empty.
    """
    import asyncio

    # Small delay to let the server start first
    await asyncio.sleep(2)

    logger.info("Starting sitemap cache warm-up...")
    try:
        # Try Redis first — worker's scheduler writes here every 6h
        if await SEOService._load_from_redis():
            logger.info("Sitemap cache warm-up completed from Redis (no DB queries needed)")
            return

        # Redis empty — do full DB refresh (first startup or Redis cleared)
        logger.info("Redis cache empty, performing full DB refresh...")
        async with AsyncSessionLocal() as db:
            seo_service = SEOService(db)
            await seo_service.get_sitemap_data(force_refresh=True)
        logger.info("Sitemap cache warm-up completed from DB")
    except Exception as e:
        logger.error(f"Sitemap cache warm-up failed: {e}")
        # Non-fatal - cache will be populated on first request


@asynccontextmanager
async def lifespan(app):
    """Application lifespan manager for startup/shutdown events."""
    import asyncio

    # Startup
    start_scheduler = os.getenv("START_SCHEDULER", "true").lower() == "true"
    warm_cache = os.getenv("WARM_SITEMAP_CACHE", "false").lower() == "true"
    scheduler_service = None
    cache_task = None

    # Fail startup before accepting traffic when outbound safety configuration is invalid.
    load_brreg_egress_guard_config()

    if start_scheduler:
        logger.info("Starting scheduler service...")
        # Lazy initialization to avoid registering jobs (and logging) if disabled
        scheduler_service = SchedulerService()
        await scheduler_service.start()
    else:
        logger.info("Scheduler service disabled (START_SCHEDULER=false)")

    # Start cache warm-up as background task (non-blocking)
    # NOTE: Disabled by default since scheduler already warms cache every 6h.
    # With multiple uvicorn workers, each would trigger warm-up on startup.
    if warm_cache:
        cache_task = asyncio.create_task(warm_sitemap_cache())
    else:
        logger.debug("Sitemap startup warm-up disabled (scheduler handles this)")

    yield

    # Shutdown
    if cache_task and not cache_task.done():
        cache_task.cancel()
        try:
            await cache_task
        except asyncio.CancelledError:
            logger.debug("Cache warm-up task cancelled during shutdown (expected)")

    if scheduler_service:
        logger.info("Shutting down scheduler service...")
        await scheduler_service.shutdown()

    # Close Redis connection pool
    from utils.redis_client import close_redis

    await close_redis()


app = FastAPI(title="Bedriftsgrafen API", lifespan=lifespan)

# Attach limiter to app
app.state.limiter = limiter

# Add SlowAPI middleware
app.add_middleware(SlowAPIMiddleware)


# Exception handler for rate limit exceeded
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded errors"""
    RATE_LIMIT_RESPONSES_TOTAL.labels(layer="backend").inc()
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Try again after the indicated delay.",
            "code": "RATE_LIMITED",
            "retry_after": exc.headers.get("retry-after", "60") if exc.headers else "60",
        },
        headers=exc.headers or {},
    )


# Add request tracking middleware (should be first)
app.add_middleware(RequestIdMiddleware)

# Add security headers to all responses
app.add_middleware(SecurityHeadersMiddleware)

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
    log_level = logging.ERROR if exc.status_code >= 500 else logging.INFO
    logger.log(
        log_level,
        f"Domain exception: {exc.message}",
        extra={"status_code": exc.status_code, "path": request.url.path, "exception_type": exc.__class__.__name__},
    )

    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "code": exc.code})


# Global exception handler to prevent stack trace leakage in production
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")


# Graceful 503 for connection pool exhaustion
@app.exception_handler(SATimeoutError)
async def pool_exhaustion_handler(request: Request, exc: SATimeoutError):
    """Return 503 when the DB connection pool is exhausted instead of raw 500."""
    logger.warning(
        "Connection pool exhausted",
        extra={"path": request.url.path, "method": request.method},
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Service temporarily unavailable, please retry"},
        headers={"Retry-After": "30"},
    )


# Graceful 503 for DB statement timeouts (asyncpg.QueryCanceledError)
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler to prevent internal details from leaking.

    Returns 503 for DB timeouts (QueryCanceledError), generic 500 otherwise.
    In production: Returns generic error message, logs full details.
    In development: Returns full exception details for debugging.
    """
    # Check for DB statement timeout (asyncpg.QueryCanceledError)
    exc_name = type(exc).__name__
    if exc_name == "QueryCanceledError" or (
        hasattr(exc, "orig") and type(getattr(exc, "orig", None)).__name__ == "QueryCanceledError"
    ):
        logger.warning(
            "DB statement timeout",
            extra={"path": request.url.path, "method": request.method},
        )
        return JSONResponse(
            status_code=503,
            content={"detail": "Request timed out, please retry"},
            headers={"Retry-After": "5"},
        )

    # Always log the full exception
    logger.error(
        "Unhandled exception: %s",
        exc,
        exc_info=exc,
        extra={"path": request.url.path, "method": request.method},
    )

    if ENVIRONMENT == "production":
        # Production: Hide implementation details
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
    else:
        # Development: Show full error for debugging
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(exc),
                "type": exc.__class__.__name__,
                "path": str(request.url.path),
            },
        )


# Include routers
app.include_router(health.router)
# V1 API (new versioning)
app.include_router(v1_companies.router)
app.include_router(v1_activity.router)
app.include_router(v1_stats.router)
app.include_router(v1_trends.router)
app.include_router(v1_people.router)
app.include_router(v1_municipality.router)
app.include_router(v1_county.router)
app.include_router(v1_og_image.router)
app.include_router(v1_client_errors.router)
app.include_router(v1_affiliates.router)
# Admin and utility routes
app.include_router(admin_import.router)
app.include_router(sitemap.router)

# Instrument app with Prometheus metrics (but don't expose publicly)
Instrumentator(
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/metrics", "/health", "/health/live", "/health/ready"],
).instrument(app)


# Secured /metrics endpoint — requires METRICS_TOKEN (or legacy ADMIN_KEY fallback)
METRICS_TOKEN = os.getenv("METRICS_TOKEN") or os.getenv("ADMIN_KEY", "")


def metrics_token_matches(provided_token: str, expected_token: str) -> bool:
    return bool(provided_token and expected_token and secrets.compare_digest(provided_token, expected_token))


def metrics_registry() -> CollectorRegistry:
    """Return the registry to export on /metrics.

    Uvicorn runs several worker processes, and each one keeps its own
    in-process registry. A scrape reaches whichever worker answers, so the
    counters appear to jump between per-worker values; Prometheus reads every
    downward step as a counter reset and extrapolates, which inflates rate()
    and increase() far above the real traffic.

    When PROMETHEUS_MULTIPROC_DIR is set, prometheus_client writes per-process
    files that MultiProcessCollector aggregates into one consistent view. With
    the variable unset (dev, tests) the default single-process registry is
    correct as-is.
    """
    if not os.getenv("PROMETHEUS_MULTIPROC_DIR"):
        return REGISTRY

    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)
    return registry


@app.get("/metrics", include_in_schema=False)
async def metrics_endpoint(request: Request):
    """Prometheus metrics endpoint, secured with a metrics token."""
    from starlette.responses import Response

    key = request.query_params.get("key", "")
    auth_header = request.headers.get("authorization", "")
    bearer_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

    if not METRICS_TOKEN or not (
        metrics_token_matches(key, METRICS_TOKEN) or metrics_token_matches(bearer_token, METRICS_TOKEN)
    ):
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return Response(content=generate_latest(metrics_registry()), media_type=CONTENT_TYPE_LATEST)


@app.get("/")
@limiter.limit("10/second")
async def read_root(request: Request):
    return {"status": "online", "message": "Bedriftsgrafen API is running"}


@app.get("/stats")
@limiter.limit("5/second")
async def get_stats(request: Request, db: AsyncSession = Depends(get_db)):
    service = CompanyService(db)
    return await service.get_statistics()
