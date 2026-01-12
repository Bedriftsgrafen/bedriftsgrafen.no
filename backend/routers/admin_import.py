import os
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from main import limiter
from services.bulk_import_service import BulkImportService
from services.ssb_service import SsbService
from services.update_service import UpdateService

# Admin API key for authentication (required for all admin endpoints)
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")


async def verify_admin_key(x_admin_key: str = Header(None, alias="X-Admin-Key")):
    """Verify admin API key from request header.

    Set ADMIN_API_KEY environment variable to enable authentication.
    If not set, admin endpoints are publicly accessible (development mode).
    """
    if ADMIN_API_KEY:
        if not x_admin_key:
            raise HTTPException(status_code=401, detail="Missing X-Admin-Key header")
        if x_admin_key != ADMIN_API_KEY:
            raise HTTPException(status_code=403, detail="Invalid admin API key")


router = APIRouter(prefix="/admin/import", tags=["admin", "import"], dependencies=[Depends(verify_admin_key)])


class UpdateRequest(BaseModel):
    since_date: str | None = None  # ISO format YYYY-MM-DD
    limit: int = 100  # Max updates to process


class PopulateQueueRequest(BaseModel):
    orgnr_list: list[str] | None = None
    from_file: str | None = None  # Path to file
    priority: int = 0


class BulkImportRequest(BaseModel):
    batch_name: str = "default"


@router.post("/updates")
@limiter.limit("1/second")
async def run_incremental_update(
    request: Request, update_request: UpdateRequest = UpdateRequest(), db: AsyncSession = Depends(get_db)
):
    """
    Fetch and process incremental updates from Brønnøysund
    Uses the oppdateringer (updates) API endpoint

    This should be run daily to keep data current.
    Fetches recent updates and filters by since_date.
    """
    service = UpdateService(db)

    since_date = None
    if update_request.since_date:
        since_date = date.fromisoformat(update_request.since_date)

    result = await service.fetch_updates(since_date, update_request.limit)
    return result


@router.post("/queue/populate")
@limiter.limit("1/second")
async def populate_import_queue(
    request: Request, queue_request: PopulateQueueRequest, db: AsyncSession = Depends(get_db)
):
    """
    Populate the bulk import queue with organization numbers

    Either provide:
    - orgnr_list: List of specific organization numbers
    - from_file: Path to JSON file with company data
    """
    service = BulkImportService(db)

    if queue_request.from_file:
        # Security: Prevent directory traversal
        import os

        safe_path = os.path.basename(queue_request.from_file)
        if safe_path != queue_request.from_file or ".." in queue_request.from_file:
            raise HTTPException(status_code=400, detail="Invalid file path")
        result = await service.populate_from_file(queue_request.from_file)
    elif queue_request.orgnr_list:
        result = await service.populate_queue(queue_request.orgnr_list, queue_request.priority)
    else:
        raise HTTPException(status_code=400, detail="Must provide either orgnr_list or from_file")

    return result


@router.post("/bulk/start")
@limiter.limit("1/second")
async def start_bulk_import(
    request: Request,
    import_request: BulkImportRequest,
    background_tasks: BackgroundTasks,
):
    """
    Start the bulk import process

    This will process all pending items in the queue using multiple workers.
    The process runs in the background and can be monitored via /admin/import/progress

    WARNING: This may take hours or days for large datasets
    """

    async def _run_bulk_import(batch_name: str):
        """Background task wrapper that creates its own database session."""
        async with AsyncSessionLocal() as db:
            service = BulkImportService(db)
            await service.start_bulk_import(batch_name)

    # Run in background with dedicated session
    background_tasks.add_task(_run_bulk_import, import_request.batch_name)

    return {"message": "Bulk import started in background", "batch_name": import_request.batch_name}


@router.get("/progress")
@limiter.limit("5/minute")
async def get_import_progress(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Get current bulk import progress statistics
    """
    service = BulkImportService(db)
    progress = await service.get_progress()
    return progress


@router.post("/retry-failed")
@limiter.limit("1/second")
async def retry_failed_imports(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Retry all failed imports by resetting them to pending status
    """
    service = BulkImportService(db)
    count = await service.retry_failed()
    return {"message": f"Reset {count} failed items for retry"}


@router.post("/ssb/population")
@limiter.limit("1/minute")
async def sync_ssb_population(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Fetch and store municipality population data from SSB.

    Uses SSB Table 07459 (Folkemengde per kommune).
    Data is upserted, so running this multiple times is safe.
    """
    service = SsbService(db)
    result = await service.fetch_and_store_population()
    return result


@router.post("/geocode")
@limiter.limit("1/minute")
async def run_geocoding_batch(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Run a batch of geocoding operations.

    Geocodes up to 100 companies that are missing coordinates.
    Uses Kartverket Adresse-API with rate limiting (1 req/sec).
    """
    from services.geocoding_batch_service import GeocodingBatchService

    service = GeocodingBatchService(db)
    result = await service.run_batch(batch_size=100)
    return result


@router.get("/geocode/status")
@limiter.limit("10/minute")
async def get_geocoding_status(request: Request, db: AsyncSession = Depends(get_db)):
    """Get geocoding progress status."""
    from services.geocoding_batch_service import GeocodingBatchService

    service = GeocodingBatchService(db)
    remaining = await service.count_companies_needing_geocoding()
    total_geocoded = await service.count_geocoded_companies()

    return {
        "total_geocoded": total_geocoded,
        "remaining": remaining,
        "percent_complete": round(total_geocoded / (total_geocoded + remaining) * 100, 1)
        if (total_geocoded + remaining) > 0
        else 0,
    }


@router.post("/geocode/fast-fill")
async def run_geocoding_fast_fill(background_tasks: BackgroundTasks):
    """
    Trigger fast coordinate backfill in background.
    """
    from database import AsyncSessionLocal
    from services.geocoding_batch_service import GeocodingBatchService

    async def _run_backfill():
        async with AsyncSessionLocal() as db:
            service = GeocodingBatchService(db)
            await service.run_postal_code_backfill()

    background_tasks.add_task(_run_backfill)

    return {"message": "Fast fill started in background. Check status endpoint for progress."}
