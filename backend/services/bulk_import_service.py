import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models_import import BulkImportQueue, ImportBatch, ImportStatus
from services.company_service import CompanyService

logger = logging.getLogger(__name__)


class BulkImportService:
    """
    Service for managing large-scale bulk import of companies

    Strategy:
    1. Populate queue with all organization numbers
    2. Process in batches with multiple workers
    3. Track progress in database for resumability
    4. Implement rate limiting and error handling
    5. Provide monitoring endpoints

    Performance Estimate (Conservative):
    - Rate limit: 10 requests/second (safe estimate)
    - 2 API calls per company (company + financials)
    - Throughput: ~5 companies/second = 18,000/hour = 432,000/day
    - 1 million companies: ~2.3 days

    Optimization:
    - Run during off-peak hours
    - Increase workers if API allows
    - Skip companies without financial data
    - Prioritize active/important companies
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.company_service = CompanyService(db)

        # Rate limiting configuration
        self.requests_per_second = 10  # Conservative limit
        self.max_concurrent_workers = 5
        self.batch_size = 100  # Process in batches for commit efficiency

    async def populate_queue(self, orgnr_list: list[str], priority: int = 0) -> dict[str, int]:
        """
        Populate the import queue with organization numbers

        Args:
            orgnr_list: List of organization numbers to import
            priority: Priority level (higher = processed first)

        Returns:
            Statistics about queue population
        """
        added = 0
        skipped = 0

        for orgnr in orgnr_list:
            # Check if already in queue
            result = await self.db.execute(select(BulkImportQueue).filter(BulkImportQueue.orgnr == orgnr))
            existing = result.scalar_one_or_none()

            if existing:
                skipped += 1
            else:
                queue_item = BulkImportQueue(orgnr=orgnr, priority=priority, status=ImportStatus.PENDING)
                self.db.add(queue_item)
                added += 1

            # Commit in batches
            if added % 1000 == 0:
                await self.db.commit()

        await self.db.commit()

        logger.info(f"Queue populated: {added} added, {skipped} skipped")
        return {"added": added, "skipped": skipped}

    async def populate_from_file(self, file_path: str) -> dict[str, int]:
        """
        Populate queue from a JSON file containing company data
        (e.g., enheter_alle.json)
        """
        import json

        orgnr_list = []
        with open(file_path) as f:
            data = json.load(f)
            for company in data:
                orgnr = company.get("organisasjonsnummer")
                if orgnr:
                    orgnr_list.append(orgnr)

        logger.info(f"Loaded {len(orgnr_list)} companies from {file_path}")
        return await self.populate_queue(orgnr_list)

    async def process_single_company(self, orgnr: str) -> dict[str, Any]:
        """
        Process a single company: fetch and store data using CompanyService
        Disables geocoding for performance during bulk import.

        Returns:
            Results dictionary with success status and counts
        """
        result = {"orgnr": orgnr, "company_fetched": False, "financials_count": 0, "error": None}

        try:
            # Delegate to CompanyService (DRY)
            # Disable geocoding for bulk performance
            service_result = await self.company_service.fetch_and_store_company(
                orgnr, fetch_financials=True, geocode=False
            )

            result["company_fetched"] = service_result["company_fetched"]
            result["financials_count"] = service_result["financials_fetched"]

            if service_result["errors"] and not result["company_fetched"]:
                result["error"] = "; ".join(service_result["errors"])

        except Exception as e:
            result["error"] = str(e)
            logger.error(f"Error processing company {orgnr}: {e}")

        return result

    async def worker(self, worker_id: int, semaphore: asyncio.Semaphore):
        """
        Worker that processes companies from the queue

        Args:
            worker_id: Unique worker identifier
            semaphore: Semaphore for rate limiting
        """
        logger.info(f"Worker {worker_id} started")

        while True:
            # Fetch next pending item (ordered by priority desc)
            result = await self.db.execute(
                select(BulkImportQueue)
                .filter(BulkImportQueue.status == ImportStatus.PENDING)
                .order_by(BulkImportQueue.priority.desc(), BulkImportQueue.queued_at)
                .limit(1)
            )
            queue_item = result.scalar_one_or_none()

            if not queue_item:
                logger.info(f"Worker {worker_id}: No more items in queue")
                break

            # Mark as in progress
            queue_item.status = ImportStatus.IN_PROGRESS
            queue_item.started_at = datetime.now(timezone.utc)
            queue_item.attempt_count = (queue_item.attempt_count or 0) + 1
            await self.db.commit()

            # Rate limiting
            async with semaphore:
                try:
                    # Process company
                    process_result = await self.process_single_company(queue_item.orgnr)

                    # Update queue item
                    if process_result["error"]:
                        queue_item.status = ImportStatus.FAILED
                        queue_item.last_error = process_result["error"]
                    else:
                        queue_item.status = ImportStatus.COMPLETED
                        queue_item.company_fetched = 1 if process_result["company_fetched"] else 0
                        queue_item.financials_count = process_result["financials_count"]

                    queue_item.completed_at = datetime.now(timezone.utc)
                    await self.db.commit()

                    logger.info(
                        f"Worker {worker_id}: Processed {queue_item.orgnr} - "
                        f"Company: {process_result['company_fetched']}, "
                        f"Financials: {process_result['financials_count']}"
                    )

                except Exception as e:
                    logger.error(f"Worker {worker_id}: Unexpected error for {queue_item.orgnr}: {e}")
                    queue_item.status = ImportStatus.FAILED
                    queue_item.last_error = str(e)
                    queue_item.completed_at = datetime.now(timezone.utc)
                    await self.db.commit()

                # Delay for rate limiting (additional to semaphore)
                await asyncio.sleep(1.0 / self.requests_per_second)

        logger.info(f"Worker {worker_id} finished")

    async def start_bulk_import(self, batch_name: str = "default") -> dict[str, Any]:
        """
        Start the bulk import process with multiple workers

        Args:
            batch_name: Name for this import batch

        Returns:
            Batch information and statistics
        """
        # Create batch record
        batch = ImportBatch(batch_name=batch_name, started_at=datetime.now(timezone.utc))

        # Count pending items
        result = await self.db.execute(
            select(func.count(BulkImportQueue.orgnr)).filter(BulkImportQueue.status == ImportStatus.PENDING)
        )
        batch.total_companies = int(result.scalar() or 0)

        self.db.add(batch)
        await self.db.commit()

        logger.info(f"Starting bulk import batch '{batch_name}' with {batch.total_companies} companies")

        # Create semaphore for rate limiting
        semaphore = asyncio.Semaphore(self.requests_per_second)

        # Create and run workers
        workers = [asyncio.create_task(self.worker(i, semaphore)) for i in range(self.max_concurrent_workers)]

        # Wait for all workers to complete
        await asyncio.gather(*workers)

        # Update batch statistics
        batch.completed_at = datetime.now(timezone.utc)

        # Count results
        completed = await self.db.execute(
            select(func.count(BulkImportQueue.orgnr)).filter(BulkImportQueue.status == ImportStatus.COMPLETED)
        )
        batch.completed_count = int(completed.scalar() or 0)

        failed = await self.db.execute(
            select(func.count(BulkImportQueue.orgnr)).filter(BulkImportQueue.status == ImportStatus.FAILED)
        )
        batch.failed_count = int(failed.scalar() or 0)

        await self.db.commit()

        duration = 0.0
        if batch.completed_at and batch.started_at:
            duration = (batch.completed_at - batch.started_at).total_seconds()
        companies_per_hour = int(((batch.completed_count or 0) / duration) * 3600) if duration > 0 else 0

        return {
            "batch_id": batch.id,
            "batch_name": batch_name,
            "total": batch.total_companies,
            "completed": batch.completed_count,
            "failed": batch.failed_count,
            "duration_seconds": duration,
            "companies_per_hour": companies_per_hour,
        }

    async def get_progress(self) -> dict[str, Any]:
        """
        Get current import progress statistics
        """
        # Count by status
        statuses = {}
        for status in ImportStatus:
            result = await self.db.execute(
                select(func.count(BulkImportQueue.orgnr)).filter(BulkImportQueue.status == status)
            )
            statuses[status.value] = result.scalar() or 0

        total = sum(statuses.values())
        completed = statuses.get(ImportStatus.COMPLETED.value, 0) or 0

        progress_pct = (completed / total * 100) if total > 0 else 0.0

        return {"total": total, "statuses": statuses, "progress_percentage": round(progress_pct, 2)}

    async def retry_failed(self) -> int:
        """
        Reset failed items to pending for retry

        Returns:
            Number of items reset
        """
        cursor_result = await self.db.execute(
            update(BulkImportQueue)
            .where(BulkImportQueue.status == ImportStatus.FAILED)
            .values(status=ImportStatus.PENDING, last_error=None)
        )
        await self.db.commit()

        count = getattr(cursor_result, "rowcount", 0) or 0
        logger.info(f"Reset {count} failed items for retry")
        return count
