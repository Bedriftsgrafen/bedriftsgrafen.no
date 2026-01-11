#!/usr/bin/env python3
"""
Script to backfill organisasjonsform column from JSON data.
Uses CTID-based batching for maximum speed on large tables.
Run: docker cp scripts/update_organisasjonsform.py bedriftsgrafen-backend:/app/ && \
     docker exec -it bedriftsgrafen-backend python /app/update_organisasjonsform.py
"""

import asyncio
import os
import sys
import time

from sqlalchemy import text

# Add backend directory to path for database imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from database import AsyncSessionLocal

BATCH_SIZE = 10000  # Rows per transaction


async def update_orgform_batched():
    print("=" * 60)
    print("Starting CTID-based update of organisasjonsform")
    print("=" * 60)
    print("Running batches until no more rows need updating...")
    print("(Press Ctrl+C to pause - progress saved after each batch)")
    print("-" * 60)

    processed = 0
    start_time = time.time()
    batch_num = 0

    while True:
        async with AsyncSessionLocal() as db:
            # Disable statement timeout for this session
            await db.execute(text("SET statement_timeout = '0';"))

            # Use CTID for efficient batching - no subquery needed!
            # This directly updates rows using physical location
            update_query = text("""
                UPDATE bedrifter
                SET organisasjonsform = data->'organisasjonsform'->>'kode'
                WHERE ctid IN (
                    SELECT ctid
                    FROM bedrifter
                    WHERE organisasjonsform IS NULL
                    LIMIT :batch_size
                )
                AND data->'organisasjonsform'->>'kode' IS NOT NULL;
            """)

            result = await db.execute(update_query, {"batch_size": BATCH_SIZE})
            rows_updated = result.rowcount

            # Commit to save this batch permanently
            await db.commit()

        batch_num += 1

        # If we updated less than batch size, we might be done or there are rows without JSON data
        if rows_updated == 0:
            # Double check - try to find any remaining nulls with JSON data
            async with AsyncSessionLocal() as db:
                await db.execute(text("SET statement_timeout = '60000';"))  # 60 sec timeout for check
                check_query = text("""
                    SELECT COUNT(*) FROM bedrifter
                    WHERE organisasjonsform IS NULL
                    AND data->'organisasjonsform'->>'kode' IS NOT NULL
                    LIMIT 1;
                """)
                try:
                    result = await db.execute(check_query)
                    remaining = result.scalar()
                    if remaining == 0:
                        break
                except Exception:
                    # If check times out, assume we're done
                    break
            continue

        processed += rows_updated

        # Calculate time and speed
        elapsed = time.time() - start_time
        speed = processed / elapsed if elapsed > 0 else 0

        # Print status
        print(
            f"   Batch {batch_num}: Updated {rows_updated} rows | "
            f"Total: {processed:,} | Speed: {int(speed)} rows/sec | "
            f"Elapsed: {int(elapsed)}s"
        )

    print("=" * 60)
    print(f"✅ Done! Updated {processed:,} rows total in {int(time.time() - start_time)}s")


if __name__ == "__main__":
    try:
        asyncio.run(update_orgform_batched())
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user. Progress so far is saved.")
