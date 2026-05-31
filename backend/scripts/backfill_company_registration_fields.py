"""Backfill missing company registration dates and raw-true register flags.

This replaces the old root-level one-off script with a bounded dry-run/apply
maintenance script. It intentionally covers the observed drift only: missing
date columns where Brreg raw JSON has a date, and register flags where Brreg raw
JSON says true while the typed column is false/null.
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


MAX_LIMIT = 1_200_000
DEFAULT_PREVIEW_LIMIT = 20
TRUE_VALUES = "('true', 't', '1', 'yes', 'ja')"

DATE_FIELDS: dict[str, tuple[str, str]] = {
    "registreringsdato_enhetsregisteret": (
        "registreringsdato_enhetsregisteret",
        "registreringsdatoEnhetsregisteret",
    ),
    "registreringsdato_foretaksregisteret": (
        "registreringsdato_foretaksregisteret",
        "registreringsdatoForetaksregisteret",
    ),
}

TRUE_FLAG_FIELDS: dict[str, tuple[str, str]] = {
    "foretaksregisteret": ("registrert_i_foretaksregisteret", "registrertIForetaksregisteret"),
    "mvaregisteret": ("registrert_i_mvaregisteret", "registrertIMvaregisteret"),
    "frivillighetsregisteret": (
        "registrert_i_frivillighetsregisteret",
        "registrertIFrivillighetsregisteret",
    ),
    "stiftelsesregisteret": ("registrert_i_stiftelsesregisteret", "registrertIStiftelsesregisteret"),
    "partiregisteret": ("registrert_i_partiregisteret", "registrertIPartiregisteret"),
}

FIELD_ORDER = (*DATE_FIELDS.keys(), *TRUE_FLAG_FIELDS.keys())


def date_predicate(column_name: str, json_key: str, alias: str = "") -> str:
    table_prefix = f"{alias}." if alias else ""
    data_ref = f"{table_prefix}data"
    column_ref = f"{table_prefix}{column_name}"
    return f"{column_ref} IS NULL AND NULLIF({data_ref} ->> '{json_key}', '') IS NOT NULL"


def true_flag_predicate(column_name: str, json_key: str, alias: str = "") -> str:
    table_prefix = f"{alias}." if alias else ""
    data_ref = f"{table_prefix}data"
    column_ref = f"{table_prefix}{column_name}"
    return f"COALESCE({column_ref}, false) IS FALSE AND lower({data_ref} ->> '{json_key}') IN {TRUE_VALUES}"


FIELD_PREDICATES: dict[str, str] = {
    alias: date_predicate(column_name, json_key) for alias, (column_name, json_key) in DATE_FIELDS.items()
}
FIELD_PREDICATES.update(
    {alias: true_flag_predicate(column_name, json_key) for alias, (column_name, json_key) in TRUE_FLAG_FIELDS.items()}
)

COUNT_SQL_BY_FIELD = {
    alias: f"SELECT COUNT(*) FROM bedrifter WHERE {predicate}" for alias, predicate in FIELD_PREDICATES.items()
}

CANDIDATE_WHERE_SQL = "\n        OR ".join(f"({predicate})" for predicate in FIELD_PREDICATES.values())
CANDIDATE_ORGNRS_CTE = (
    """
WITH candidate_orgnrs AS (
"""
    + "\nUNION\n".join(f"    SELECT orgnr FROM bedrifter WHERE {predicate}" for predicate in FIELD_PREDICATES.values())
    + """
)
"""
)

PREVIEW_SQL = f"""
SELECT
    orgnr,
    registreringsdato_enhetsregisteret AS old_registreringsdato_enhetsregisteret,
    NULLIF(data ->> 'registreringsdatoEnhetsregisteret', '') AS new_registreringsdato_enhetsregisteret,
    registreringsdato_foretaksregisteret AS old_registreringsdato_foretaksregisteret,
    NULLIF(data ->> 'registreringsdatoForetaksregisteret', '') AS new_registreringsdato_foretaksregisteret,
    registrert_i_foretaksregisteret AS old_registrert_i_foretaksregisteret,
    lower(data ->> 'registrertIForetaksregisteret') IN {TRUE_VALUES} AS new_registrert_i_foretaksregisteret,
    registrert_i_mvaregisteret AS old_registrert_i_mvaregisteret,
    lower(data ->> 'registrertIMvaregisteret') IN {TRUE_VALUES} AS new_registrert_i_mvaregisteret,
    registrert_i_frivillighetsregisteret AS old_registrert_i_frivillighetsregisteret,
    lower(data ->> 'registrertIFrivillighetsregisteret') IN {TRUE_VALUES} AS new_registrert_i_frivillighetsregisteret,
    registrert_i_stiftelsesregisteret AS old_registrert_i_stiftelsesregisteret,
    lower(data ->> 'registrertIStiftelsesregisteret') IN {TRUE_VALUES} AS new_registrert_i_stiftelsesregisteret,
    registrert_i_partiregisteret AS old_registrert_i_partiregisteret,
    lower(data ->> 'registrertIPartiregisteret') IN {TRUE_VALUES} AS new_registrert_i_partiregisteret
FROM bedrifter
WHERE
    {CANDIDATE_WHERE_SQL}
LIMIT :preview_limit;
"""


def field_update_sql(alias: str) -> str:
    if alias in DATE_FIELDS:
        column_name, json_key = DATE_FIELDS[alias]
        predicate = date_predicate(column_name, json_key)
        set_expression = f"{column_name} = NULLIF(target.data ->> '{json_key}', '')::date"
    else:
        column_name, json_key = TRUE_FLAG_FIELDS[alias]
        predicate = true_flag_predicate(column_name, json_key)
        set_expression = f"{column_name} = true"

    return f"""
WITH rows_to_update AS (
    SELECT ctid AS row_ctid
    FROM bedrifter
    WHERE {predicate}
    LIMIT :limit
), updated AS (
    UPDATE bedrifter target
    SET {set_expression}
    FROM rows_to_update
    WHERE target.ctid = rows_to_update.row_ctid
    RETURNING target.orgnr
)
SELECT COUNT(*) AS updated_count FROM updated;
"""


FIELD_UPDATE_SQL_BY_FIELD = {alias: field_update_sql(alias) for alias in FIELD_ORDER}


def load_environment() -> None:
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(project_root, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)

    if os.getenv("DATABASE_HOST") == "bedriftsgrafen-db":
        os.environ["DATABASE_HOST"] = "localhost"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill missing company registration dates and raw-true register flags from raw Brreg JSON."
    )
    parser.add_argument("--limit", type=int, required=True, help="Maximum candidate companies to update or inspect.")
    parser.add_argument("--apply", action="store_true", help="Apply updates. Without this flag, the script dry-runs.")
    parser.add_argument("--dry-run", action="store_true", help="Report candidates without changing data.")
    parser.add_argument(
        "--preview-limit",
        type=int,
        default=DEFAULT_PREVIEW_LIMIT,
        help="Maximum candidate companies to include in dry-run output.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=25_000,
        help="Maximum companies to update per write chunk when applying.",
    )
    parser.add_argument(
        "--statement-timeout-ms",
        type=int,
        default=120_000,
        help="Transaction-local statement timeout for each maintenance chunk.",
    )
    parser.add_argument(
        "--full-counts",
        action="store_true",
        help="Run full-table per-field counts during dry-run. This can be expensive on JSONB fields.",
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


def rows_to_dicts(rows: list[Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def dry_run(limit: int, preview_limit: int, statement_timeout_ms: int, full_counts: bool) -> None:
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        summary: dict[str, Any] = {"full_counts": full_counts}
        if full_counts:
            for alias, count_sql in COUNT_SQL_BY_FIELD.items():
                await db.execute(
                    text("SELECT set_config('statement_timeout', :timeout_ms, true)"),
                    {"timeout_ms": str(statement_timeout_ms)},
                )
                result = await db.execute(text(count_sql))
                summary[f"{alias}_candidates"] = int(result.scalar_one())
        else:
            summary["note"] = "Full counts skipped. Use --full-counts or the runbook SQL for exact field counts."

        preview = []
        if preview_limit > 0:
            await db.execute(
                text("SELECT set_config('statement_timeout', :timeout_ms, true)"),
                {"timeout_ms": str(statement_timeout_ms)},
            )
            preview_result = await db.execute(text(PREVIEW_SQL), {"preview_limit": preview_limit})
            preview = rows_to_dicts(list(preview_result.mappings().all()))

        if full_counts:
            count_values = [value for key, value in summary.items() if key.endswith("_candidates")]
            total_field_differences = sum(int(value or 0) for value in count_values)
            summary["total_field_differences"] = total_field_differences
            summary["limit_exhausted"] = total_field_differences >= limit

        print(
            json.dumps(
                {
                    "mode": "dry-run",
                    "limit": limit,
                    "preview_limit": preview_limit,
                    "statement_timeout_ms": statement_timeout_ms,
                    "summary": summary,
                    "preview": preview,
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
    batches: list[dict[str, int | str]] = []

    async with AsyncSessionLocal() as db:
        for alias in FIELD_ORDER:
            while remaining > 0:
                chunk_limit = min(batch_size, remaining)
                try:
                    await db.execute(
                        text("SELECT set_config('statement_timeout', :timeout_ms, true)"),
                        {"timeout_ms": str(statement_timeout_ms)},
                    )
                    result = await db.execute(text(FIELD_UPDATE_SQL_BY_FIELD[alias]), {"limit": chunk_limit})
                    updated_count = int(result.scalar_one())
                    await db.commit()
                except Exception:
                    await db.rollback()
                    raise

                batches.append({"field": alias, "limit": chunk_limit, "updated_count": updated_count})
                updated_total += updated_count
                remaining -= updated_count

                if updated_count == 0:
                    break

            if remaining <= 0:
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

    await dry_run(args.limit, args.preview_limit, args.statement_timeout_ms, args.full_counts)


if __name__ == "__main__":
    load_environment()
    asyncio.run(run())
