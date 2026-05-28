"""Repair accounting periods from raw Brreg metadata and remove legacy duplicates.

This script is intentionally bounded and dry-runs by default. It writes only
when run manually with an explicit --limit and --apply.
"""

# ruff: noqa: S608

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


MAX_LIMIT = 100_000
DEFAULT_PREVIEW_LIMIT = 20

NORMALIZED_CTE = """
WITH normalized AS (
    SELECT
        r.id,
        r.orgnr,
        r.aar,
        r.periode_fra,
        r.periode_til,
        r.created_at,
        r.updated_at,
        r.raw_data->>'id' AS source_id,
        r.raw_data->>'journalnr' AS journalnr,
        COALESCE(r.raw_data->>'id', r.raw_data->>'journalnr') AS source_key,
        CASE
            WHEN r.raw_data #>> '{regnskapsperiode,fraDato}' ~ '^\\d{4}-\\d{2}-\\d{2}'
                THEN left(r.raw_data #>> '{regnskapsperiode,fraDato}', 10)::date
            ELSE NULL
        END AS raw_periode_fra,
        CASE
            WHEN r.raw_data #>> '{regnskapsperiode,tilDato}' ~ '^\\d{4}-\\d{2}-\\d{2}'
                THEN left(r.raw_data #>> '{regnskapsperiode,tilDato}', 10)::date
            ELSE NULL
        END AS raw_periode_til
    FROM regnskap r
    WHERE r.raw_data ? 'regnskapsperiode'
), ranked_duplicates AS (
    SELECT
        normalized.*,
        first_value(id) OVER duplicate_window AS keep_id,
        row_number() OVER duplicate_window AS duplicate_rank
    FROM normalized
    WHERE source_key IS NOT NULL
    WINDOW duplicate_window AS (
        PARTITION BY orgnr, source_key
        ORDER BY
            (
                (periode_fra IS NOT DISTINCT FROM raw_periode_fra)::int +
                (periode_til IS NOT DISTINCT FROM raw_periode_til)::int
            ) DESC,
            ((periode_fra IS NOT NULL)::int + (periode_til IS NOT NULL)::int) DESC,
            updated_at DESC NULLS LAST,
            id DESC
    )
), survivor_rows AS (
    SELECT normalized.*
    FROM normalized
    LEFT JOIN ranked_duplicates USING (id)
    WHERE COALESCE(ranked_duplicates.duplicate_rank, 1) = 1
)
"""

DRY_RUN_SQL = (
    NORMALIZED_CTE
    + """
, duplicate_groups AS (
    SELECT orgnr, source_key, COUNT(*) AS row_count
    FROM ranked_duplicates
    GROUP BY orgnr, source_key
    HAVING COUNT(*) > 1
), duplicate_delete_candidates AS (
    SELECT *
    FROM ranked_duplicates
    WHERE duplicate_rank > 1
), repair_candidates AS (
    SELECT survivor_rows.*
    FROM survivor_rows
    WHERE raw_periode_til IS NOT NULL
      AND (
        periode_til IS DISTINCT FROM raw_periode_til
        OR (raw_periode_fra IS NOT NULL AND periode_fra IS DISTINCT FROM raw_periode_fra)
      )
), repair_candidates_without_conflict AS (
    SELECT repair_candidates.*
    FROM repair_candidates
    WHERE NOT EXISTS (
        SELECT 1
        FROM survivor_rows other
        WHERE other.orgnr = repair_candidates.orgnr
          AND other.id <> repair_candidates.id
          AND other.periode_til = repair_candidates.raw_periode_til
    )
), repair_candidates_with_conflict AS (
    SELECT repair_candidates.*
    FROM repair_candidates
    WHERE EXISTS (
        SELECT 1
        FROM survivor_rows other
        WHERE other.orgnr = repair_candidates.orgnr
          AND other.id <> repair_candidates.id
          AND other.periode_til = repair_candidates.raw_periode_til
    )
)
SELECT
    (SELECT COUNT(*) FROM normalized) AS rows_with_raw_period,
    (SELECT COUNT(*) FROM normalized WHERE periode_fra IS NULL AND raw_periode_fra IS NOT NULL) AS rows_missing_period_start,
    (SELECT COUNT(*) FROM normalized WHERE periode_til IS NULL AND raw_periode_til IS NOT NULL) AS rows_missing_period_end,
    (SELECT COUNT(*) FROM normalized WHERE periode_til IS NOT NULL AND raw_periode_til IS NOT NULL AND periode_til <> raw_periode_til) AS rows_with_wrong_period_end,
    (SELECT COUNT(*) FROM duplicate_groups) AS duplicate_source_groups,
    (SELECT COUNT(*) FROM duplicate_delete_candidates) AS duplicate_delete_candidates,
    (SELECT COUNT(*) FROM repair_candidates_without_conflict) AS period_repair_candidates,
    (SELECT COUNT(*) FROM repair_candidates_with_conflict) AS period_repair_conflicts;
"""
)

DUPLICATE_PREVIEW_SQL = (
    NORMALIZED_CTE
    + """
SELECT
    ranked_duplicates.orgnr,
    companies.navn,
    ranked_duplicates.source_id,
    ranked_duplicates.journalnr,
    ranked_duplicates.keep_id,
    ranked_duplicates.id AS delete_id,
    ranked_duplicates.aar,
    ranked_duplicates.periode_fra,
    ranked_duplicates.periode_til,
    ranked_duplicates.raw_periode_fra,
    ranked_duplicates.raw_periode_til
FROM ranked_duplicates
LEFT JOIN bedrifter companies ON companies.orgnr = ranked_duplicates.orgnr
WHERE ranked_duplicates.duplicate_rank > 1
ORDER BY ranked_duplicates.id DESC
LIMIT :preview_limit;
"""
)

REPAIR_PREVIEW_SQL = (
    NORMALIZED_CTE
    + """
, repair_candidates AS (
    SELECT survivor_rows.*
    FROM survivor_rows
    WHERE raw_periode_til IS NOT NULL
      AND (
        periode_til IS DISTINCT FROM raw_periode_til
        OR (raw_periode_fra IS NOT NULL AND periode_fra IS DISTINCT FROM raw_periode_fra)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM survivor_rows other
        WHERE other.orgnr = survivor_rows.orgnr
          AND other.id <> survivor_rows.id
          AND other.periode_til = survivor_rows.raw_periode_til
      )
)
SELECT
    repair_candidates.orgnr,
    companies.navn,
    repair_candidates.id,
    repair_candidates.aar,
    repair_candidates.source_id,
    repair_candidates.journalnr,
    repair_candidates.periode_fra AS old_periode_fra,
    repair_candidates.periode_til AS old_periode_til,
    repair_candidates.raw_periode_fra AS new_periode_fra,
    repair_candidates.raw_periode_til AS new_periode_til
FROM repair_candidates
LEFT JOIN bedrifter companies ON companies.orgnr = repair_candidates.orgnr
ORDER BY repair_candidates.id DESC
LIMIT :preview_limit;
"""
)

DELETE_DUPLICATES_SQL = (
    NORMALIZED_CTE
    + """
, rows_to_delete AS (
    SELECT id
    FROM ranked_duplicates
    WHERE duplicate_rank > 1
    ORDER BY id
    LIMIT :limit
)
DELETE FROM regnskap target
USING rows_to_delete
WHERE target.id = rows_to_delete.id
RETURNING target.id;
"""
)

REPAIR_PERIODS_SQL = (
    NORMALIZED_CTE
    + """
, repair_candidates AS (
    SELECT survivor_rows.*
    FROM survivor_rows
    WHERE raw_periode_til IS NOT NULL
      AND (
        periode_til IS DISTINCT FROM raw_periode_til
        OR (raw_periode_fra IS NOT NULL AND periode_fra IS DISTINCT FROM raw_periode_fra)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM survivor_rows other
        WHERE other.orgnr = survivor_rows.orgnr
          AND other.id <> survivor_rows.id
          AND other.periode_til = survivor_rows.raw_periode_til
      )
    ORDER BY id
    LIMIT :limit
)
UPDATE regnskap target
SET
    periode_fra = COALESCE(repair_candidates.raw_periode_fra, target.periode_fra),
    periode_til = repair_candidates.raw_periode_til
FROM repair_candidates
WHERE target.id = repair_candidates.id
RETURNING target.id;
"""
)


def load_environment() -> None:
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(project_root, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)

    if os.getenv("DATABASE_HOST") == "bedriftsgrafen-db":
        os.environ["DATABASE_HOST"] = "localhost"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Repair accounting periods from raw Brreg metadata and delete same-source duplicates."
    )
    parser.add_argument("--limit", type=int, required=True, help="Maximum duplicate rows and repair rows to apply.")
    parser.add_argument(
        "--preview-limit",
        type=int,
        default=DEFAULT_PREVIEW_LIMIT,
        help="Maximum preview rows in dry-run output.",
    )
    parser.add_argument("--apply", action="store_true", help="Apply cleanup. Without this flag, the script dry-runs.")
    parser.add_argument("--dry-run", action="store_true", help="Report candidates without changing data.")
    args = parser.parse_args()

    if args.apply and args.dry_run:
        parser.error("--apply and --dry-run cannot be used together")
    if args.limit < 1 or args.limit > MAX_LIMIT:
        parser.error(f"--limit must be between 1 and {MAX_LIMIT}")
    if args.preview_limit < 0 or args.preview_limit > 200:
        parser.error("--preview-limit must be between 0 and 200")

    return args


def rows_to_dicts(rows: list[Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def dry_run(limit: int, preview_limit: int) -> None:
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        summary_result = await db.execute(text(DRY_RUN_SQL))
        duplicate_preview_result = await db.execute(text(DUPLICATE_PREVIEW_SQL), {"preview_limit": preview_limit})
        repair_preview_result = await db.execute(text(REPAIR_PREVIEW_SQL), {"preview_limit": preview_limit})

        print(
            json.dumps(
                {
                    "mode": "dry-run",
                    "limit": limit,
                    "preview_limit": preview_limit,
                    "summary": dict(summary_result.mappings().one()),
                    "duplicate_delete_preview": rows_to_dicts(duplicate_preview_result.mappings().all()),
                    "period_repair_preview": rows_to_dicts(repair_preview_result.mappings().all()),
                },
                default=str,
                ensure_ascii=False,
                indent=2,
            )
        )


async def apply_cleanup(limit: int) -> None:
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            duplicate_result = await db.execute(text(DELETE_DUPLICATES_SQL), {"limit": limit})
            deleted_ids = [row[0] for row in duplicate_result.all()]

            repair_result = await db.execute(text(REPAIR_PERIODS_SQL), {"limit": limit})
            repaired_ids = [row[0] for row in repair_result.all()]

            await db.commit()
        except Exception:
            await db.rollback()
            raise

        print(
            json.dumps(
                {
                    "mode": "apply",
                    "limit": limit,
                    "deleted_duplicate_rows": len(deleted_ids),
                    "repaired_period_rows": len(repaired_ids),
                    "deleted_duplicate_preview_ids": deleted_ids[:DEFAULT_PREVIEW_LIMIT],
                    "repaired_period_preview_ids": repaired_ids[:DEFAULT_PREVIEW_LIMIT],
                },
                ensure_ascii=False,
                indent=2,
            )
        )


async def run() -> None:
    args = parse_args()
    if args.apply:
        await apply_cleanup(args.limit)
        return

    await dry_run(args.limit, args.preview_limit)


if __name__ == "__main__":
    load_environment()
    asyncio.run(run())
