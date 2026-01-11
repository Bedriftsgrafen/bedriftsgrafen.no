import asyncio
import csv
import logging
import os

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models

logger = logging.getLogger(__name__)


class NaceSubclass(BaseModel):
    """A NACE subclass with company count and SSB name"""

    code: str
    name: str
    count: int


class NaceService:
    _nace_codes_cache: dict[str, str] = {}
    _cache_lock = asyncio.Lock()

    def __init__(self, db: AsyncSession):
        self.db = db

    @classmethod
    async def get_nace_name(cls, code: str) -> str:
        """Get NACE name from cache, loading if necessary"""
        if not cls._nace_codes_cache:
            await cls._load_nace_codes()

        # Try with and without dot
        return cls._nace_codes_cache.get(code) or cls._nace_codes_cache.get(code.replace(".", "")) or f"Kode {code}"

    @classmethod
    async def get_all_nace_codes(cls) -> dict[str, str]:
        """Get all NACE codes mapping"""
        if not cls._nace_codes_cache:
            await cls._load_nace_codes()
        return cls._nace_codes_cache

    @classmethod
    async def _load_nace_codes(cls):
        """Load NACE codes from SSB CSV file in a thread to avoid blocking event loop"""
        async with cls._cache_lock:
            if cls._nace_codes_cache:
                return

            try:
                # Run blocking I/O in executor
                loop = asyncio.get_running_loop()
                csv_path = os.path.join(os.path.dirname(__file__), "..", "klass-version-3218-codes.csv")

                def _read_csv() -> dict[str, str]:
                    cache: dict[str, str] = {}
                    if not os.path.exists(csv_path):
                        logger.warning(f"NACE codes file not found: {csv_path}")
                        return cache

                    with open(csv_path, encoding="latin-1") as f:
                        reader = csv.DictReader(f, delimiter=";")
                        for row in reader:
                            code = row.get("code", "").strip('"')
                            name = row.get("shortName", row.get("name", "")).strip('"')
                            if code and name:
                                cache[code] = name
                    return cache

                cls._nace_codes_cache = await loop.run_in_executor(None, _read_csv)
                logger.info(f"Loaded {len(cls._nace_codes_cache)} NACE codes from SSB")

            except Exception as e:
                logger.error(f"Failed to load NACE codes: {e}")

    async def get_subclasses(self, prefix: str) -> list[NaceSubclass]:
        """
        Get NACE subclasses for a given prefix with company counts and SSB names.
        """
        try:
            # Query distinct NACE codes starting with prefix
            stmt = (
                select(models.Company.naeringskode, func.count(models.Company.orgnr).label("count"))
                .where(models.Company.naeringskode.like(f"{prefix}%"))
                .where(models.Company.naeringskode.isnot(None))
                .group_by(models.Company.naeringskode)
                .order_by(models.Company.naeringskode)
            )

            result = await self.db.execute(stmt)
            rows = result.all()

            # Build response with SSB names
            results = []
            for row in rows:
                code = row[0]
                count = row[1]
                name = await self.get_nace_name(code)
                results.append(NaceSubclass(code=code, name=name, count=count))

            return results
        except Exception as e:
            logger.error(f"Error fetching NACE subclasses for {prefix}: {e}")
            return []

    @classmethod
    async def get_hierarchy(cls) -> list[dict]:
        """Get full NACE hierarchy from CSV (non-blocking)"""
        try:
            loop = asyncio.get_running_loop()
            csv_path = os.path.join(os.path.dirname(__file__), "..", "klass-version-3218-codes.csv")

            def _read_hierarchy() -> list[dict[str, str | int]]:
                results: list[dict[str, str | int]] = []
                if not os.path.exists(csv_path):
                    return results

                with open(csv_path, encoding="latin-1") as f:
                    reader = csv.DictReader(f, delimiter=";")
                    for row in reader:
                        results.append(
                            {
                                "code": row.get("code", "").strip('"'),
                                "parent": row.get("parentCode", "").strip('"'),
                                "level": int(row.get("level", 0)),
                                "name": row.get("shortName", row.get("name", "")).strip('"'),
                            }
                        )
                return results

            return await loop.run_in_executor(None, _read_hierarchy)
        except Exception as e:
            logger.error(f"Error loading NACE hierarchy: {e}")
            return []
