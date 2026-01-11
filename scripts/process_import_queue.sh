#!/bin/bash
# Process pending items in the import queue
# Run this manually or via cron for bulk imports

set -e

# Project root directory (defaults to current directory if not set)
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"

BATCH_SIZE=100
LOG_FILE="${PROJECT_ROOT}/logs/import_worker.log"

echo "$(date): Starting import worker..." >> "$LOG_FILE"

# Process queue items using Python script
docker exec bedriftsgrafen-backend python3 << 'PYEOF'
import asyncio
import sys
from database import AsyncSessionLocal
from services.bulk_import_service import BulkImportService
from models_import import ImportStatus

async def process_batch():
    async with AsyncSessionLocal() as db:
        service = BulkImportService(db)
        
        # Get progress
        progress = await service.get_progress()
        pending = progress['statuses'].get('pending', 0)
        
        if pending == 0:
            print("No pending items in queue")
            return
        
        print(f"Processing {min(pending, 100)} companies...")
        
        # Process items one by one (simplified approach)
        from sqlalchemy import select
        from models_import import BulkImportQueue
        
        for i in range(min(pending, 100)):
            result = await db.execute(
                select(BulkImportQueue)
                .filter(BulkImportQueue.status == ImportStatus.PENDING)
                .order_by(BulkImportQueue.priority.desc())
                .limit(1)
            )
            item = result.scalar_one_or_none()
            
            if not item:
                break
            
            # Mark in progress
            item.status = ImportStatus.IN_PROGRESS
            await db.commit()
            
            # Process
            process_result = await service.process_single_company(item.orgnr)
            
            # Update status
            if process_result.get('error'):
                item.status = ImportStatus.FAILED
                item.last_error = process_result['error']
            else:
                item.status = ImportStatus.COMPLETED
                item.company_fetched = 1 if process_result['company_fetched'] else 0
                item.financials_count = process_result['financials_count']
            
            from datetime import datetime
            item.completed_at = datetime.utcnow()
            await db.commit()
            
            print(f"Processed {item.orgnr}: {item.status}")
            
            # Rate limiting
            await asyncio.sleep(0.1)

asyncio.run(process_batch())
PYEOF

echo "$(date): Import worker completed" >> "$LOG_FILE"
