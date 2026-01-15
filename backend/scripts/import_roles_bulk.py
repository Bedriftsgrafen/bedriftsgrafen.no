"""
Bulk Role Import Script (Production-Safe Version)

Imports roles from Brreg's gzipped JSON export into the database.
Uses streaming JSON parsing to minimize memory usage.
Pre-validates FK constraints to avoid constraint violations.

Usage:
    export DATABASE_HOST=localhost && export PYTHONPATH=.
    .venv/bin/python scripts/import_roles_bulk.py data/roller_*.json.gz

Safety features:
- Streaming JSON parser (ijson) - constant memory usage
- FK pre-validation - skips roles for companies not in bedrifter
- Batched inserts with periodic commits
- Progress logging with ETA
- Graceful error handling
"""

import asyncio
import gzip
import logging
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any

import ijson  # type: ignore[import-untyped]
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
import models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("import_roles_bulk")

BATCH_SIZE = 1000  # Roles per batch insert
COMMIT_EVERY = 10000  # Commit every N roles
LOG_EVERY = 50000  # Log progress every N roles


def parse_date(date_str: str | None) -> date | None:
    """Parse date string to date object."""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str[:10]).date()
    except (ValueError, TypeError):
        return None


def extract_roles_from_company(company_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract flat role records from nested Brreg JSON structure."""
    orgnr = company_data.get("organisasjonsnummer")
    if not orgnr:
        return []

    roles = []
    rollegrupper = company_data.get("rollegrupper", [])

    for gruppe in rollegrupper:
        for rolle in gruppe.get("roller", []):
            rolle_type = rolle.get("type", {})

            role_data: dict[str, Any] = {
                "orgnr": orgnr,
                "type_kode": rolle_type.get("kode"),
                "type_beskrivelse": rolle_type.get("beskrivelse"),
                "person_navn": None,
                "foedselsdato": None,
                "enhet_orgnr": None,
                "enhet_navn": None,
                "fratraadt": rolle.get("fratraadt", False),
                "rekkefoelge": rolle.get("rekkefolge"),
            }

            # Extract person info
            person = rolle.get("person")
            if person:
                navn = person.get("navn", {})
                fornavn = navn.get("fornavn", "")
                mellomnavn = navn.get("mellomnavn", "")
                etternavn = navn.get("etternavn", "")
                full_name_parts = [fornavn, mellomnavn, etternavn]
                role_data["person_navn"] = " ".join(p for p in full_name_parts if p)
                role_data["foedselsdato"] = parse_date(person.get("fodselsdato"))

            # Extract entity (enhet) info
            enhet = rolle.get("enhet")
            if enhet:
                role_data["enhet_orgnr"] = enhet.get("organisasjonsnummer")
                navn_list = enhet.get("navn", [])
                if isinstance(navn_list, list) and navn_list:
                    role_data["enhet_navn"] = navn_list[0]
                elif isinstance(navn_list, str):
                    role_data["enhet_navn"] = navn_list

            roles.append(role_data)

    return roles


async def load_valid_orgnrs(db: AsyncSession) -> set[str]:
    """Pre-load all valid company orgnrs for FK validation."""
    logger.info("Loading valid company orgnrs from bedrifter table...")
    stmt = select(models.Company.orgnr)
    result = await db.execute(stmt)
    orgnrs = {row[0] for row in result.fetchall()}
    logger.info(f"Loaded {len(orgnrs):,} valid orgnrs for FK validation.")
    return orgnrs


async def import_roles(file_path: Path) -> dict[str, int]:
    """Import roles from gzipped JSON file using streaming parser."""
    logger.info(f"Starting production-safe import from {file_path}")

    stats = {
        "companies_processed": 0,
        "roles_imported": 0,
        "roles_skipped_fk": 0,
        "errors": 0,
    }

    async with AsyncSessionLocal() as db:
        # Pre-load valid orgnrs for FK validation
        valid_orgnrs = await load_valid_orgnrs(db)

        # Clear existing roles for clean import
        logger.info("Clearing existing roles table...")
        await db.execute(text("TRUNCATE TABLE roller RESTART IDENTITY"))
        await db.commit()
        logger.info("Table cleared. Starting streaming import...")

        batch: list[dict[str, Any]] = []
        uncommitted_roles = 0
        start_time = time.time()

        # Stream JSON using ijson - constant memory usage
        with gzip.open(file_path, "rb") as f:
            for company in ijson.items(f, "item"):
                try:
                    roles = extract_roles_from_company(company)

                    # FK validation: filter to only valid orgnrs
                    orgnr = company.get("organisasjonsnummer")
                    if orgnr not in valid_orgnrs:
                        stats["roles_skipped_fk"] += len(roles)
                        continue

                    batch.extend(roles)
                    stats["companies_processed"] += 1

                    # Batch insert when threshold reached
                    if len(batch) >= BATCH_SIZE:
                        await insert_batch(db, batch)
                        stats["roles_imported"] += len(batch)
                        uncommitted_roles += len(batch)
                        batch = []

                        # Commit periodically
                        if uncommitted_roles >= COMMIT_EVERY:
                            await db.commit()
                            uncommitted_roles = 0

                        # Log progress with ETA
                        if stats["roles_imported"] % LOG_EVERY < BATCH_SIZE:
                            elapsed = time.time() - start_time
                            rate = stats["roles_imported"] / elapsed if elapsed > 0 else 0
                            logger.info(
                                f"Progress: {stats['companies_processed']:,} companies, "
                                f"{stats['roles_imported']:,} roles @ {rate:.0f}/s"
                            )

                except Exception as e:
                    stats["errors"] += 1
                    if stats["errors"] <= 10:  # Only log first 10 errors
                        logger.warning(f"Error processing company: {e}")

        # Final batch
        if batch:
            await insert_batch(db, batch)
            stats["roles_imported"] += len(batch)

        await db.commit()

        # Update last_polled_roles for all companies with roles
        logger.info("Updating last_polled_roles tracker...")
        await db.execute(
            text("""
                UPDATE bedrifter
                SET last_polled_roles = CURRENT_DATE
                WHERE orgnr IN (SELECT DISTINCT orgnr FROM roller)
            """)
        )
        await db.commit()

    logger.info(f"Import complete! {stats}")
    return stats


async def insert_batch(db: AsyncSession, roles: list[dict[str, Any]]) -> None:
    """Bulk insert roles using PostgreSQL upsert."""
    if not roles:
        return

    stmt = insert(models.Role).values(roles)
    stmt = stmt.on_conflict_do_nothing()  # Skip any edge-case duplicates
    await db.execute(stmt)


async def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python import_roles_bulk.py <path_to_roles.json.gz>")
        sys.exit(1)

    file_path = Path(sys.argv[1])
    if not file_path.exists():
        print(f"File not found: {file_path}")
        sys.exit(1)

    start_time = datetime.now()
    stats = await import_roles(file_path)
    duration = datetime.now() - start_time

    logger.info(f"Total time: {duration}")
    logger.info(f"Final stats: {stats}")

    # Summary
    logger.info("=" * 50)
    logger.info(f"Companies processed: {stats['companies_processed']:,}")
    logger.info(f"Roles imported: {stats['roles_imported']:,}")
    logger.info(f"Roles skipped (FK missing): {stats['roles_skipped_fk']:,}")
    logger.info(f"Errors: {stats['errors']}")


if __name__ == "__main__":
    asyncio.run(main())
