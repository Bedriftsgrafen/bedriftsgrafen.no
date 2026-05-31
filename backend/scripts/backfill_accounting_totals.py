"""Backfill accounting balance totals from stored raw Brreg JSON.

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
from collections.abc import Iterable
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


MAX_LIMIT = 500_000
DEFAULT_PREVIEW_LIMIT = 20

NUMERIC_PATTERN = r"^-?\d+(\.\d+)?([eE][+-]?\d+)?$"

NORMALIZED_CTE = f"""
WITH normalized AS (
    SELECT
        r.id,
        r.orgnr,
        r.aar,
        r.periode_til,
        r.sum_eiendeler,
        r.gjeld,
        r.sum_egenkapital_gjeld,
        r.gjeldsgrad,
        r.egenkapital,
        r.kortsiktig_gjeld,
        r.langsiktig_gjeld,
        CASE
            WHEN r.raw_data #>> '{{eiendeler,sumEiendeler}}' ~ '{NUMERIC_PATTERN}'
                THEN (r.raw_data #>> '{{eiendeler,sumEiendeler}}')::double precision
            ELSE NULL
        END AS raw_sum_eiendeler,
        CASE
            WHEN r.raw_data #>> '{{egenkapitalGjeld,gjeldOversikt,sumGjeld}}' ~ '{NUMERIC_PATTERN}'
                THEN (r.raw_data #>> '{{egenkapitalGjeld,gjeldOversikt,sumGjeld}}')::double precision
            ELSE NULL
        END AS raw_gjeld,
        CASE
            WHEN r.raw_data #>> '{{egenkapitalGjeld,sumEgenkapitalGjeld}}' ~ '{NUMERIC_PATTERN}'
                THEN (r.raw_data #>> '{{egenkapitalGjeld,sumEgenkapitalGjeld}}')::double precision
            ELSE NULL
        END AS raw_sum_egenkapital_gjeld
    FROM regnskap r
), calculated AS (
    SELECT
        normalized.*,
        COALESCE(
            raw_gjeld,
            gjeld,
            CASE
                WHEN kortsiktig_gjeld IS NOT NULL OR langsiktig_gjeld IS NOT NULL
                    THEN COALESCE(kortsiktig_gjeld, 0) + COALESCE(langsiktig_gjeld, 0)
                ELSE NULL
            END
        ) AS total_gjeld_for_ratio
    FROM normalized
), candidates AS (
    SELECT
        calculated.*,
        CASE
            WHEN egenkapital IS NOT NULL
                 AND egenkapital <> 0
                 AND total_gjeld_for_ratio IS NOT NULL
                THEN total_gjeld_for_ratio / egenkapital
            ELSE NULL
        END AS calculated_gjeldsgrad
    FROM calculated
    WHERE
        (raw_sum_eiendeler IS NOT NULL AND sum_eiendeler IS DISTINCT FROM raw_sum_eiendeler)
        OR (raw_gjeld IS NOT NULL AND gjeld IS DISTINCT FROM raw_gjeld)
        OR (raw_sum_egenkapital_gjeld IS NOT NULL AND sum_egenkapital_gjeld IS DISTINCT FROM raw_sum_egenkapital_gjeld)
        OR (
            egenkapital IS NOT NULL
            AND egenkapital <> 0
            AND total_gjeld_for_ratio IS NOT NULL
            AND gjeldsgrad IS DISTINCT FROM (total_gjeld_for_ratio / egenkapital)
        )
)
"""

DRY_RUN_SQL = (
    NORMALIZED_CTE
    + """
SELECT
    (SELECT COUNT(*) FROM normalized) AS total_rows,
    (SELECT COUNT(*) FROM normalized WHERE raw_sum_eiendeler IS NOT NULL) AS rows_with_raw_sum_eiendeler,
    (SELECT COUNT(*) FROM normalized WHERE raw_gjeld IS NOT NULL) AS rows_with_raw_gjeld,
    (SELECT COUNT(*) FROM normalized WHERE raw_sum_egenkapital_gjeld IS NOT NULL) AS rows_with_raw_sum_egenkapital_gjeld,
    (SELECT COUNT(*) FROM candidates) AS candidate_rows,
    (SELECT COUNT(*) FROM candidates WHERE raw_sum_eiendeler IS NOT NULL AND sum_eiendeler IS DISTINCT FROM raw_sum_eiendeler) AS sum_eiendeler_candidates,
    (SELECT COUNT(*) FROM candidates WHERE raw_gjeld IS NOT NULL AND gjeld IS DISTINCT FROM raw_gjeld) AS gjeld_candidates,
    (SELECT COUNT(*) FROM candidates WHERE raw_sum_egenkapital_gjeld IS NOT NULL AND sum_egenkapital_gjeld IS DISTINCT FROM raw_sum_egenkapital_gjeld) AS sum_egenkapital_gjeld_candidates,
    (SELECT COUNT(*) FROM candidates WHERE calculated_gjeldsgrad IS NOT NULL AND gjeldsgrad IS DISTINCT FROM calculated_gjeldsgrad) AS gjeldsgrad_candidates;
"""
)

PREVIEW_SQL = (
    NORMALIZED_CTE
    + """
SELECT
    id,
    orgnr,
    aar,
    periode_til,
    sum_eiendeler AS old_sum_eiendeler,
    raw_sum_eiendeler AS new_sum_eiendeler,
    gjeld AS old_gjeld,
    raw_gjeld AS new_gjeld,
    sum_egenkapital_gjeld AS old_sum_egenkapital_gjeld,
    raw_sum_egenkapital_gjeld AS new_sum_egenkapital_gjeld,
    gjeldsgrad AS old_gjeldsgrad,
    calculated_gjeldsgrad AS new_gjeldsgrad
FROM candidates
ORDER BY id
LIMIT :preview_limit;
"""
)

UPDATE_SQL = (
    NORMALIZED_CTE
    + """
, rows_to_update AS (
    SELECT *
    FROM candidates
    ORDER BY id
    LIMIT :limit
), updated AS (
    UPDATE regnskap target
    SET
        sum_eiendeler = COALESCE(rows_to_update.raw_sum_eiendeler, target.sum_eiendeler),
        gjeld = COALESCE(rows_to_update.raw_gjeld, target.gjeld),
        sum_egenkapital_gjeld = COALESCE(
            rows_to_update.raw_sum_egenkapital_gjeld,
            target.sum_egenkapital_gjeld
        ),
        gjeldsgrad = COALESCE(rows_to_update.calculated_gjeldsgrad, target.gjeldsgrad),
        updated_at = now()
    FROM rows_to_update
    WHERE target.id = rows_to_update.id
    RETURNING target.id
)
SELECT COUNT(*) AS updated_count FROM updated;
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
        description="Backfill regnskap balance totals and gjeldsgrad from stored raw Brreg JSON."
    )
    parser.add_argument("--limit", type=int, required=True, help="Maximum candidate rows to update or inspect.")
    parser.add_argument("--apply", action="store_true", help="Apply updates. Without this flag, the script dry-runs.")
    parser.add_argument("--dry-run", action="store_true", help="Report candidates without changing data.")
    parser.add_argument(
        "--preview-limit",
        type=int,
        default=DEFAULT_PREVIEW_LIMIT,
        help="Maximum candidate rows to include in dry-run output.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10_000,
        help="Maximum rows to update per write chunk when applying.",
    )
    parser.add_argument(
        "--statement-timeout-ms",
        type=int,
        default=120_000,
        help="Transaction-local statement timeout for each maintenance chunk.",
    )
    args = parser.parse_args()

    if args.apply and args.dry_run:
        parser.error("--apply and --dry-run cannot be used together")
    if args.limit < 1 or args.limit > MAX_LIMIT:
        parser.error(f"--limit must be between 1 and {MAX_LIMIT}")
    if args.preview_limit < 0 or args.preview_limit > 200:
        parser.error("--preview-limit must be between 0 and 200")
    if args.batch_size < 1 or args.batch_size > 50_000:
        parser.error("--batch-size must be between 1 and 50000")
    if args.statement_timeout_ms < 5_000 or args.statement_timeout_ms > 600_000:
        parser.error("--statement-timeout-ms must be between 5000 and 600000")

    return args


def rows_to_dicts(rows: Iterable[Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def dry_run(limit: int, preview_limit: int) -> None:
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        summary_result = await db.execute(text(DRY_RUN_SQL))
        preview_result = await db.execute(text(PREVIEW_SQL), {"preview_limit": preview_limit})

        print(
            json.dumps(
                {
                    "mode": "dry-run",
                    "limit": limit,
                    "preview_limit": preview_limit,
                    "summary": dict(summary_result.mappings().one()),
                    "preview": rows_to_dicts(preview_result.mappings().all()),
                },
                default=str,
                ensure_ascii=False,
                indent=2,
            )
        )


async def apply_backfill(limit: int, batch_size: int, statement_timeout_ms: int) -> None:
    from database import AsyncSessionLocal

    remaining = limit
    updated_total = 0
    batches: list[dict[str, int]] = []

    async with AsyncSessionLocal() as db:
        while remaining > 0:
            chunk_limit = min(batch_size, remaining)
            try:
                await db.execute(
                    text("SELECT set_config('statement_timeout', :timeout_ms, true)"),
                    {"timeout_ms": str(statement_timeout_ms)},
                )
                result = await db.execute(text(UPDATE_SQL), {"limit": chunk_limit})
                updated_count = int(result.scalar_one())
                await db.commit()
            except Exception:
                await db.rollback()
                raise

            batches.append({"limit": chunk_limit, "updated_count": updated_count})
            updated_total += updated_count
            remaining -= updated_count

            if updated_count == 0 or updated_count < chunk_limit:
                break

    print(
        json.dumps(
            {
                "mode": "apply",
                "limit": limit,
                "batch_size": batch_size,
                "updated_count": updated_total,
                "batches": batches,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


async def run() -> None:
    args = parse_args()
    if args.apply:
        await apply_backfill(args.limit, args.batch_size, args.statement_timeout_ms)
        return

    await dry_run(args.limit, args.preview_limit)


if __name__ == "__main__":
    load_environment()
    asyncio.run(run())
