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
WITH candidate_rows AS (
    SELECT
        r.id,
        r.orgnr,
        r.aar,
        r.periode_til,
        r.created_at,
        NULLIF(r.raw_data ->> 'id', '') AS raw_source_id,
        NULLIF(r.raw_data ->> 'journalnr', '') AS journalnr,
        COALESCE(
            NULLIF(r.raw_data ->> 'id', ''),
            NULLIF(r.raw_data ->> 'journalnr', ''),
            r.orgnr || ':' || COALESCE(r.aar::text, 'unknown') || ':' || COALESCE(r.periode_til::text, 'unknown'),
            'regnskap:' || r.id::text
        ) AS source_update_id
    FROM regnskap r
    WHERE r.id <= :max_regnskap_id
    ORDER BY r.id DESC
    LIMIT :limit
    OFFSET :offset
), source_rows AS (
    SELECT
        candidate_rows.*,
        'accounting_added:' || candidate_rows.orgnr || ':' || md5(candidate_rows.source_update_id) AS event_key
    FROM candidate_rows
    WHERE NOT EXISTS (
        SELECT 1
        FROM company_events existing
        WHERE existing.event_key = 'accounting_added:' || candidate_rows.orgnr || ':' || md5(candidate_rows.source_update_id)
    )
    AND NOT EXISTS (
        SELECT 1
        FROM company_events existing
        WHERE existing.event_type = 'accounting_added'
          AND existing.orgnr = candidate_rows.orgnr
          AND existing.source_update_id = candidate_rows.source_update_id
    )
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
        'Regnskapsregisteret via Brreg',
        source_rows.source_update_id,
        source_rows.event_key,
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
            'journalnr', source_rows.journalnr,
            'source_table', 'regnskap',
            'time_semantics', 'Backfill fra Bedriftsgrafens regnskapstabell. observed_at er regnskap.created_at nar tilgjengelig.'
        )
    FROM source_rows
    ON CONFLICT (event_key) DO NOTHING
    RETURNING id
)
SELECT COUNT(*) AS inserted_count FROM inserted;
"""

MAX_REGNSKAP_ID_SQL = """
SELECT COALESCE(MAX(id), 0) AS max_regnskap_id FROM regnskap;
"""

SUMMARY_SQL = """
WITH candidate_rows AS (
    SELECT
        r.id,
        r.orgnr,
        r.aar,
        r.periode_til,
        r.created_at,
        NULLIF(r.raw_data ->> 'id', '') AS raw_source_id,
        NULLIF(r.raw_data ->> 'journalnr', '') AS journalnr,
        COALESCE(
            NULLIF(r.raw_data ->> 'id', ''),
            NULLIF(r.raw_data ->> 'journalnr', ''),
            r.orgnr || ':' || COALESCE(r.aar::text, 'unknown') || ':' || COALESCE(r.periode_til::text, 'unknown'),
            'regnskap:' || r.id::text
        ) AS source_update_id
    FROM regnskap r
    WHERE r.id <= :max_regnskap_id
    ORDER BY r.id DESC
    LIMIT :limit
), candidate_keys AS (
    SELECT
        candidate_rows.*,
        'accounting_added:' || candidate_rows.orgnr || ':' || md5(candidate_rows.source_update_id) AS event_key
    FROM candidate_rows
)
SELECT
    COUNT(*) AS candidate_count,
    COUNT(*) FILTER (
        WHERE EXISTS (
            SELECT 1
            FROM company_events existing
            WHERE existing.event_key = candidate_keys.event_key
        )
        OR EXISTS (
            SELECT 1
            FROM company_events existing
            WHERE existing.event_type = 'accounting_added'
              AND existing.orgnr = candidate_keys.orgnr
              AND existing.source_update_id = candidate_keys.source_update_id
        )
    ) AS existing_event_count,
    COUNT(*) FILTER (
        WHERE NOT EXISTS (
            SELECT 1
            FROM company_events existing
            WHERE existing.event_key = candidate_keys.event_key
        )
        AND NOT EXISTS (
            SELECT 1
            FROM company_events existing
            WHERE existing.event_type = 'accounting_added'
              AND existing.orgnr = candidate_keys.orgnr
              AND existing.source_update_id = candidate_keys.source_update_id
        )
    ) AS missing_event_count,
    MIN(id) AS min_regnskap_id,
    MAX(id) AS max_regnskap_id,
    MIN(created_at) AS oldest_created_at,
    MAX(created_at) AS newest_created_at
FROM candidate_keys;
"""

MISSING_PREVIEW_SQL = """
WITH candidate_rows AS (
    SELECT
        r.id,
        r.orgnr,
        r.aar,
        r.periode_til,
        r.created_at,
        COALESCE(
            NULLIF(r.raw_data ->> 'id', ''),
            NULLIF(r.raw_data ->> 'journalnr', ''),
            r.orgnr || ':' || COALESCE(r.aar::text, 'unknown') || ':' || COALESCE(r.periode_til::text, 'unknown'),
            'regnskap:' || r.id::text
        ) AS source_update_id
    FROM regnskap r
    WHERE r.id <= :max_regnskap_id
    ORDER BY r.id DESC
    LIMIT :limit
), candidate_keys AS (
    SELECT
        candidate_rows.*,
        'accounting_added:' || candidate_rows.orgnr || ':' || md5(candidate_rows.source_update_id) AS event_key
    FROM candidate_rows
)
SELECT id, orgnr, aar, periode_til, created_at, source_update_id
FROM candidate_keys
WHERE NOT EXISTS (
    SELECT 1
    FROM company_events existing
    WHERE existing.event_key = candidate_keys.event_key
)
  AND NOT EXISTS (
    SELECT 1
    FROM company_events existing
    WHERE existing.event_type = 'accounting_added'
      AND existing.orgnr = candidate_keys.orgnr
      AND existing.source_update_id = candidate_keys.source_update_id
)
ORDER BY id DESC
LIMIT :preview_limit;
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
    parser.add_argument(
        "--preview-limit", type=int, default=5, help="Maximum missing rows to include in dry-run output."
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5000,
        help="Maximum accounting rows to inspect per write chunk when applying.",
    )
    parser.add_argument(
        "--statement-timeout-ms",
        type=int,
        default=120_000,
        help="Transaction-local statement timeout for each maintenance write chunk.",
    )
    args = parser.parse_args()
    if args.apply and args.dry_run:
        parser.error("--apply and --dry-run cannot be used together")
    return args


async def backfill_accounting_events(
    limit: int,
    *,
    dry_run: bool,
    preview_limit: int,
    batch_size: int,
    statement_timeout_ms: int,
) -> int:
    from database import AsyncSessionLocal

    if limit < 1 or limit > 100_000:
        raise ValueError("--limit must be between 1 and 100000")
    if preview_limit < 0 or preview_limit > 100:
        raise ValueError("--preview-limit must be between 0 and 100")
    if batch_size < 1 or batch_size > 10_000:
        raise ValueError("--batch-size must be between 1 and 10000")
    if statement_timeout_ms < 5_000 or statement_timeout_ms > 600_000:
        raise ValueError("--statement-timeout-ms must be between 5000 and 600000")

    async with AsyncSessionLocal() as db:
        max_id_result = await db.execute(text(MAX_REGNSKAP_ID_SQL))
        max_regnskap_id = int(max_id_result.scalar_one())

        if dry_run:
            summary_result = await db.execute(text(SUMMARY_SQL), {"limit": limit, "max_regnskap_id": max_regnskap_id})
            summary = dict(summary_result.mappings().one())
            preview_result = await db.execute(
                text(MISSING_PREVIEW_SQL),
                {"limit": limit, "preview_limit": preview_limit, "max_regnskap_id": max_regnskap_id},
            )
            preview = [dict(row) for row in preview_result.mappings().all()]
            print(
                json.dumps(
                    {
                        "mode": "dry-run",
                        "limit": limit,
                        "preview_limit": preview_limit,
                        "max_regnskap_id": max_regnskap_id,
                        **summary,
                        "preview": preview,
                    },
                    default=str,
                    ensure_ascii=False,
                )
            )
            return 0

        inserted_count = 0
        batches: list[dict[str, int]] = []
        for offset in range(0, limit, batch_size):
            chunk_limit = min(batch_size, limit - offset)
            await db.execute(
                text("SELECT set_config('statement_timeout', :timeout_ms, true)"),
                {"timeout_ms": str(statement_timeout_ms)},
            )
            result = await db.execute(
                text(ACCOUNTING_BACKFILL_SQL),
                {
                    "limit": chunk_limit,
                    "offset": offset,
                    "max_regnskap_id": max_regnskap_id,
                },
            )
            chunk_inserted_count = int(result.scalar_one())
            await db.commit()
            inserted_count += chunk_inserted_count
            batches.append({"offset": offset, "limit": chunk_limit, "inserted_count": chunk_inserted_count})

        summary_result = await db.execute(text(SUMMARY_SQL), {"limit": limit, "max_regnskap_id": max_regnskap_id})
        summary = dict(summary_result.mappings().one())
        print(
            json.dumps(
                {
                    "mode": "apply",
                    "inserted_count": inserted_count,
                    "inspected_limit": limit,
                    "max_regnskap_id": max_regnskap_id,
                    "batch_size": batch_size,
                    "batches": batches,
                    "post_summary": summary,
                },
                default=str,
                ensure_ascii=False,
            )
        )
        return inserted_count


if __name__ == "__main__":
    load_environment()
    args = parse_args()
    asyncio.run(
        backfill_accounting_events(
            args.limit,
            dry_run=not args.apply,
            preview_limit=args.preview_limit,
            batch_size=args.batch_size,
            statement_timeout_ms=args.statement_timeout_ms,
        )
    )
