"""Backfill selected company_events rows from existing Bedriftsgrafen data.

This script is intentionally bounded. It does not scan request-time paths and writes
only when run manually with an explicit --limit and --apply.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


ACCOUNTING_BACKFILL_SQL = """
WITH source_rows AS (
    SELECT
        r.id,
        r.orgnr,
        r.aar,
        r.periode_til,
        r.created_at
    FROM regnskap r
    ORDER BY r.id DESC
    LIMIT :limit
), inserted AS (
    INSERT INTO company_events (
        orgnr,
        event_type,
        source,
        source_update_id,
        event_key,
        occurred_at,
        observed_at,
        new_value,
        payload
    )
    SELECT
        source_rows.orgnr,
        'accounting_added',
        'Bedriftsgrafen backfill',
        'regnskap:' || source_rows.id::text,
        'accounting_added:' || source_rows.orgnr || ':' || md5('regnskap:' || source_rows.id::text),
        CASE
            WHEN source_rows.periode_til IS NULL THEN NULL
            ELSE source_rows.periode_til::timestamp with time zone
        END,
        COALESCE(source_rows.created_at, now()),
        jsonb_build_object(
            'aar', source_rows.aar,
            'periode_til', source_rows.periode_til,
            'regnskap_id', source_rows.id
        ),
        jsonb_build_object(
            'source_table', 'regnskap',
            'time_semantics', 'Backfill fra Bedriftsgrafens regnskapstabell. observed_at er regnskap.created_at nar tilgjengelig.'
        )
    FROM source_rows
    ON CONFLICT (event_key) DO NOTHING
    RETURNING id
)
SELECT COUNT(*) AS inserted_count FROM inserted;
"""

DRY_RUN_SQL = """
SELECT
    COUNT(*) AS candidate_count,
    MIN(id) AS min_regnskap_id,
    MAX(id) AS max_regnskap_id,
    MIN(created_at) AS oldest_created_at,
    MAX(created_at) AS newest_created_at
FROM (
    SELECT id, created_at
    FROM regnskap
    ORDER BY id DESC
    LIMIT :limit
) source_rows;
"""


def load_environment() -> None:
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(project_root, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)

    if os.getenv("DATABASE_HOST") == "bedriftsgrafen-db":
        os.environ["DATABASE_HOST"] = "localhost"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill company_events from existing accounting rows.")
    parser.add_argument("--limit", type=int, required=True, help="Maximum number of recent accounting rows to inspect.")
    parser.add_argument(
        "--apply", action="store_true", help="Insert missing events. Without this flag, the script dry-runs."
    )
    parser.add_argument("--dry-run", action="store_true", help="Report candidate rows without inserting events.")
    args = parser.parse_args()
    if args.apply and args.dry_run:
        parser.error("--apply and --dry-run cannot be used together")
    return args


async def backfill_accounting_events(limit: int, *, dry_run: bool) -> int:
    from database import AsyncSessionLocal

    if limit < 1 or limit > 100_000:
        raise ValueError("--limit must be between 1 and 100000")

    async with AsyncSessionLocal() as db:
        if dry_run:
            result = await db.execute(text(DRY_RUN_SQL), {"limit": limit})
            row = result.mappings().one()
            print(json.dumps({"mode": "dry-run", **dict(row)}, default=str, ensure_ascii=False))
            return 0

        result = await db.execute(text(ACCOUNTING_BACKFILL_SQL), {"limit": limit})
        inserted_count = int(result.scalar_one())
        await db.commit()
        print(json.dumps({"mode": "apply", "inserted_count": inserted_count, "inspected_limit": limit}))
        return inserted_count


if __name__ == "__main__":
    load_environment()
    args = parse_args()
    asyncio.run(backfill_accounting_events(args.limit, dry_run=not args.apply))
