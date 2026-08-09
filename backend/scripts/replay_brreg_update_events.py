"""Replay bounded Brreg company update rows into Bedriftsgrafen event ingestion.

This is intentionally dry-run-first. Apply mode is bounded by explicit source
window arguments and records progress separately from the live scheduler cursor.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Any

import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REPLAY_STATE_KEY = "company_event_replay_latest_id"
MAX_LIMIT = 50_000
MAX_BATCH_SIZE = 1_000
DEFAULT_PREVIEW_LIMIT = 20


def extract_next_link(data: dict[str, Any]) -> str | None:
    links = data.get("_links") or {}
    next_link = links.get("next") or {}
    if not isinstance(next_link, dict):
        return None

    href = next_link.get("href")
    return href if isinstance(href, str) and href else None


@dataclass(frozen=True)
class ReplayCandidate:
    orgnr: str
    source_update_id: str
    oppdateringsid: int
    source_change_type: str | None
    occurred_at: str | None
    event_types: list[str]
    change_paths: list[str]


def load_environment() -> None:
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(project_root, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)

    if os.getenv("DATABASE_HOST") == "bedriftsgrafen-db":
        os.environ["DATABASE_HOST"] = "localhost"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Dry-run or apply bounded replay of Brreg company update rows into company_events."
    )
    lower_bound = parser.add_mutually_exclusive_group(required=True)
    lower_bound.add_argument("--from-id", type=int, help="First Brreg oppdateringsid to include.")
    lower_bound.add_argument("--from-time", help="First Brreg update timestamp to request, ISO 8601.")
    parser.add_argument("--to-id", type=int, help="Last Brreg oppdateringsid to include.")
    parser.add_argument("--to-time", help="Last Brreg update timestamp to include, ISO 8601.")
    parser.add_argument("--limit", type=int, required=True, help="Maximum source update rows to inspect.")
    parser.add_argument("--batch-size", type=int, required=True, help="Brreg/API and apply chunk size.")
    parser.add_argument("--preview-limit", type=int, default=DEFAULT_PREVIEW_LIMIT)
    parser.add_argument("--apply", action="store_true", help="Apply bounded replay. Omit for dry-run.")
    parser.add_argument("--dry-run", action="store_true", help="Explicit dry-run mode. This is the default.")
    parser.add_argument("--api-timeout", type=float, default=30.0)
    args = parser.parse_args()
    validate_args(args)
    return args


def validate_args(args: argparse.Namespace) -> None:
    if args.apply and args.dry_run:
        raise SystemExit("--apply and --dry-run cannot be used together")
    if args.limit < 1 or args.limit > MAX_LIMIT:
        raise SystemExit(f"--limit must be between 1 and {MAX_LIMIT}")
    if args.batch_size < 1 or args.batch_size > MAX_BATCH_SIZE:
        raise SystemExit(f"--batch-size must be between 1 and {MAX_BATCH_SIZE}")
    if args.preview_limit < 0 or args.preview_limit > 100:
        raise SystemExit("--preview-limit must be between 0 and 100")
    if args.from_id is not None and args.from_id < 1:
        raise SystemExit("--from-id must be >= 1")
    if args.to_id is not None and args.to_id < 1:
        raise SystemExit("--to-id must be >= 1")
    if args.from_id is not None and args.to_id is not None and args.to_id < args.from_id:
        raise SystemExit("--to-id must be greater than or equal to --from-id")
    if args.from_id is None and args.to_id is not None:
        raise SystemExit("--to-id requires --from-id")
    if args.from_time is None and args.to_time is not None:
        raise SystemExit("--to-time requires --from-time")
    if args.api_timeout <= 0:
        raise SystemExit("--api-timeout must be positive")


def parse_brreg_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def entity_update_id(entity: dict[str, Any]) -> int | None:
    value = entity.get("oppdateringsid")
    if value is None:
        return None
    try:
        return int(value)
    except TypeError, ValueError:
        return None


def entity_in_window(entity: dict[str, Any], args: argparse.Namespace) -> tuple[bool, bool]:
    update_id = entity_update_id(entity)
    if args.from_id is not None:
        if update_id is None:
            return False, False
        if update_id < args.from_id:
            return False, False
        if args.to_id is not None and update_id > args.to_id:
            return False, True

    if args.from_time is not None or args.to_time is not None:
        event_time = parse_brreg_datetime(entity.get("dato"))
        if event_time is None:
            return False, False
        if args.from_time is not None:
            from_time = parse_brreg_datetime(args.from_time)
            if from_time is not None and event_time < from_time:
                return False, False
        if args.to_time is not None:
            to_time = parse_brreg_datetime(args.to_time)
            if to_time is not None and event_time > to_time:
                return False, True

    return True, False


def classify_company_update_event_types(entity: dict[str, Any]) -> list[str]:
    from schemas.brreg import BrregUpdateChange
    from services.update_service import BRREG_EMPLOYEE_CHANGE_PATHS, UpdateService

    change_type = entity.get("endringstype")
    if change_type == "Ny":
        return ["company_registered"]
    if change_type == "Sletting":
        return ["company_deleted"]
    if change_type == "Fjernet":
        return ["company_removed_from_open_data"]

    changes = [BrregUpdateChange.model_validate(change) for change in entity.get("endringer") or []]
    event_types = list(UpdateService._company_update_event_types(changes))
    if UpdateService._matching_change_paths(changes, BRREG_EMPLOYEE_CHANGE_PATHS):
        event_types.append("employee_count_changed")

    return list(dict.fromkeys(event_types))


def source_change_paths(entity: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    for change in entity.get("endringer") or []:
        path = change.get("path") if isinstance(change, dict) else None
        if path and path not in paths:
            paths.append(path)
    return paths


def build_replay_candidates(entities: list[dict[str, Any]]) -> list[ReplayCandidate]:
    candidates: list[ReplayCandidate] = []
    for entity in entities:
        update_id = entity_update_id(entity)
        orgnr = entity.get("organisasjonsnummer")
        if update_id is None or not orgnr:
            continue

        candidates.append(
            ReplayCandidate(
                orgnr=str(orgnr),
                source_update_id=str(update_id),
                oppdateringsid=update_id,
                source_change_type=entity.get("endringstype"),
                occurred_at=entity.get("dato"),
                event_types=classify_company_update_event_types(entity),
                change_paths=source_change_paths(entity),
            )
        )
    return candidates


def event_identity_pairs(candidates: list[ReplayCandidate]) -> set[tuple[str, str, str]]:
    return {
        (candidate.orgnr, event_type, candidate.source_update_id)
        for candidate in candidates
        for event_type in candidate.event_types
    }


async def fetch_company_update_rows(args: argparse.Namespace) -> tuple[list[dict[str, Any]], int]:
    from constants.urls import BRREG_UPDATES_URL
    from services.brreg_api_service import BrregApiService

    initial_params: dict[str, Any] = {
        "includeChanges": "true",
        "size": min(args.batch_size, MAX_BATCH_SIZE),
        "sort": "id,ASC",
    }
    if args.from_id is not None:
        initial_params["oppdateringsid"] = max(args.from_id - 1, 0)
    else:
        initial_params["dato"] = args.from_time

    rows: list[dict[str, Any]] = []
    pages_fetched = 0
    next_url: str | None = BRREG_UPDATES_URL
    params: dict[str, Any] | None = initial_params
    stop = False

    brreg_api = BrregApiService()
    brreg_api.timeout = httpx.Timeout(args.api_timeout)
    brreg_api._record_brreg_logical_operation("updates_company")
    while next_url and len(rows) < args.limit and not stop:
        response = await brreg_api._get(next_url, params=params, context="updates_company")
        params = None
        if response.status_code != 200:
            raise RuntimeError(f"Brreg update API returned {response.status_code}: {response.text[:500]}")

        data = response.json()
        pages_fetched += 1
        entities = data.get("_embedded", {}).get("oppdaterteEnheter", [])
        if not entities:
            break

        for entity in entities:
            include, past_upper_bound = entity_in_window(entity, args)
            if past_upper_bound:
                stop = True
                break
            if not include:
                continue

            rows.append(entity)
            if len(rows) >= args.limit:
                stop = True
                break

        next_url = extract_next_link(data)

    return rows, pages_fetched


async def load_existing_event_pairs(candidates: list[ReplayCandidate]) -> set[tuple[str, str, str]]:
    from sqlalchemy import select

    import models
    from database import AsyncSessionLocal

    source_update_ids = sorted({candidate.source_update_id for candidate in candidates if candidate.event_types})
    event_types = sorted({event_type for candidate in candidates for event_type in candidate.event_types})
    if not source_update_ids or not event_types:
        return set()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(
                models.CompanyEvent.orgnr,
                models.CompanyEvent.event_type,
                models.CompanyEvent.source_update_id,
            ).where(
                models.CompanyEvent.source_update_id.in_(source_update_ids),
                models.CompanyEvent.event_type.in_(event_types),
            )
        )
        return {
            (row["orgnr"], row["event_type"], row["source_update_id"])
            for row in result.mappings().all()
            if row["source_update_id"] is not None
        }


def build_summary(
    *,
    mode: str,
    rows: list[dict[str, Any]],
    pages_fetched: int,
    candidates: list[ReplayCandidate],
    existing_pairs: set[tuple[str, str, str]],
    preview_limit: int,
) -> dict[str, Any]:
    all_pairs = event_identity_pairs(candidates)
    missing_pairs = all_pairs - existing_pairs
    event_type_counts = Counter(event_type for candidate in candidates for event_type in candidate.event_types)
    ids = [candidate.oppdateringsid for candidate in candidates]

    return {
        "mode": mode,
        "stream": "companies",
        "pages_fetched": pages_fetched,
        "source_rows_fetched": len(rows),
        "candidate_rows": len(candidates),
        "rows_without_candidate_event": sum(1 for candidate in candidates if not candidate.event_types),
        "candidate_events": len(all_pairs),
        "existing_events": len(existing_pairs),
        "estimated_missing_events": len(missing_pairs),
        "event_types": dict(sorted(event_type_counts.items())),
        "min_oppdateringsid": min(ids) if ids else None,
        "max_oppdateringsid": max(ids) if ids else None,
        "replay_state_key": REPLAY_STATE_KEY,
        "preview": [asdict(candidate) for candidate in candidates[:preview_limit]],
    }


async def apply_company_replay(rows: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    from database import AsyncSessionLocal
    from schemas.brreg import UpdateBatchResult
    from services.update_service import UpdateService

    async with AsyncSessionLocal() as db:
        service = UpdateService(db)
        if not service.event_ledger_enabled:
            raise RuntimeError("ENABLE_COMPANY_EVENT_LEDGER must be true before --apply replay can write events")

        result = UpdateBatchResult(since_date=date.today(), since_iso=args.from_time or str(args.from_id))
        for offset in range(0, len(rows), args.batch_size):
            chunk = rows[offset : offset + args.batch_size]
            fetch_results = await service._fetch_chunk_details(chunk)
            await service._persist_chunk(fetch_results, result)

            chunk_ids = [entity_update_id(entity) for entity in chunk]
            latest_chunk_id = max((value for value in chunk_ids if value is not None), default=None)
            if latest_chunk_id is not None:
                await service.system_repo.set_state(REPLAY_STATE_KEY, str(latest_chunk_id))

        return result.model_dump()


async def run(args: argparse.Namespace) -> int:
    load_environment()
    rows, pages_fetched = await fetch_company_update_rows(args)
    candidates = build_replay_candidates(rows)
    existing_pairs = await load_existing_event_pairs(candidates)
    summary = build_summary(
        mode="apply" if args.apply else "dry-run",
        rows=rows,
        pages_fetched=pages_fetched,
        candidates=candidates,
        existing_pairs=existing_pairs,
        preview_limit=args.preview_limit,
    )

    if args.apply:
        summary["apply_result"] = await apply_company_replay(rows, args)

    print(json.dumps(summary, default=str, ensure_ascii=False, indent=2))
    return 0


def main() -> None:
    args = parse_args()
    raise SystemExit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
