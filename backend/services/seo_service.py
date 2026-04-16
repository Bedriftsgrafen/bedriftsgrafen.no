"""Service for SEO related operations like dynamic OG images and sitemaps."""

import asyncio
import html
import json
import logging
import textwrap
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.concurrency import SITEMAP_CACHE_TIMEOUT, SITEMAP_URLS_PER_FILE
from constants.nace import get_nace_name
from repositories.company.repository import CompanyRepository
from repositories.role_repository import RoleRepository
from repositories.stats_repository import StatsRepository

logger = logging.getLogger(__name__)

# Constants for sitemap pagination
URLS_PER_SITEMAP = SITEMAP_URLS_PER_FILE

# Timeout for cache refresh operations (seconds)
CACHE_REFRESH_TIMEOUT = SITEMAP_CACHE_TIMEOUT

# Redis key for cross-container sitemap cache sharing
REDIS_SITEMAP_KEY = "sitemap:cache"
REDIS_SITEMAP_TTL = 6 * 3600  # 6 hours in seconds

STATIC_ROUTES = [
    "",  # Homepage
    "utforsk",
    "konkurser",
    "nyetableringer",
    "bransjer",
    "kart",
    "sammenlign",
    "om",
]


class SEOService:
    # Class-level cache to persist across instances (FastAPI creates a new service per request)
    # Using a dictionary shared by all instances
    _sitemap_cache: dict[str, Any] = {
        "total_companies": 0,
        "total_people": 0,
        "municipalities": [],
        "company_anchors": [],
        "person_anchors": [],
        "expiry": None,
        "populated": False,  # True once first successful refresh completes
        "is_warming": False,  # Flag to indicate warm-up in progress
    }
    CACHE_TTL = timedelta(hours=6)

    # Class-level lock to prevent thundering herd on cache refresh
    _cache_lock: asyncio.Lock | None = None

    @classmethod
    def _get_lock(cls) -> asyncio.Lock:
        """Get or create the cache lock (lazy init for event loop safety)."""
        if cls._cache_lock is None:
            cls._cache_lock = asyncio.Lock()
        return cls._cache_lock

    def __init__(self, db: AsyncSession):
        self.db = db
        self.company_repo = CompanyRepository(db)
        self.role_repo = RoleRepository(db)
        self.stats_repo = StatsRepository(db)

    @classmethod
    def is_cache_valid(cls) -> bool:
        """Check if cache is valid without acquiring lock."""
        cache = cls._sitemap_cache
        if cache["expiry"] is None:
            return False

        return datetime.now(UTC) < cache["expiry"]

    @classmethod
    def is_cache_warming(cls) -> bool:
        """Check if cache warm-up is in progress."""
        return cls._sitemap_cache.get("is_warming", False)

    @classmethod
    async def _load_from_redis(cls) -> bool:
        """Try to load sitemap cache from Redis (shared across containers).

        Returns True if Redis had valid data and in-memory cache was populated.
        Returns False on miss or error (caller should fall through to DB refresh).
        """
        try:
            from utils.redis_client import get_redis

            redis = get_redis()
            raw = await redis.get(REDIS_SITEMAP_KEY)
            if not raw:
                return False

            data = json.loads(raw)
            cache = cls._sitemap_cache

            cache["total_companies"] = data.get("total_companies", 0)
            cache["total_people"] = data.get("total_people", 0)
            cache["municipalities"] = [tuple(m) for m in data.get("municipalities", [])]
            cache["company_anchors"] = data.get("company_anchors", [])

            # Restore person_anchors with date objects for SQLAlchemy compatibility
            raw_people = data.get("person_anchors", [])
            cache["person_anchors"] = [
                (p[0], date.fromisoformat(p[1]) if len(p) > 1 and p[1] else None) for p in raw_people
            ]

            # Use Redis key's remaining TTL for in-memory expiry
            ttl = await redis.ttl(REDIS_SITEMAP_KEY)
            cache["expiry"] = datetime.now(UTC) + timedelta(seconds=max(ttl, 60))
            cache["populated"] = True

            logger.info(f"Loaded sitemap cache from Redis ({cache['total_companies']} companies, TTL {ttl}s remaining)")
            return True
        except Exception as e:
            logger.warning(f"Failed to load sitemap cache from Redis: {e}")
            return False

    @classmethod
    async def _save_to_redis(cls) -> None:
        """Save current sitemap cache to Redis for cross-container sharing."""
        try:
            from utils.redis_client import get_redis

            redis = get_redis()
            cache = cls._sitemap_cache

            data = {
                "total_companies": cache["total_companies"],
                "total_people": cache["total_people"],
                "municipalities": cache["municipalities"],
                "company_anchors": cache["company_anchors"],
                "person_anchors": [
                    [p[0], p[1].isoformat() if isinstance(p[1], date) else str(p[1]) if p[1] else None]
                    for p in cache["person_anchors"]
                ],
            }

            await redis.setex(
                REDIS_SITEMAP_KEY,
                REDIS_SITEMAP_TTL,
                json.dumps(data, default=str),
            )
            logger.info("Saved sitemap cache to Redis")
        except Exception as e:
            logger.warning(f"Failed to save sitemap cache to Redis: {e}")

    async def get_sitemap_data(self, force_refresh: bool = False) -> dict[str, Any]:
        """
        Get total counts and pagination anchors with 6-hour caching.

        Uses asyncio.Lock to prevent thundering herd - only one request
        will perform the expensive refresh while others wait or use stale data.
        """
        cache = SEOService._sitemap_cache

        # Fast path: in-memory cache is valid, return immediately
        if not force_refresh and SEOService.is_cache_valid():
            return cache

        # Try loading from Redis (shared cache written by worker's scheduler)
        if not force_refresh and await SEOService._load_from_redis():
            return SEOService._sitemap_cache

        # Expensive path: need to query DB directly
        lock = SEOService._get_lock()

        # If another request is already refreshing and we have stale data, return it
        if lock.locked() and cache["populated"]:
            logger.debug("Cache refresh in progress, returning stale data")
            return cache

        async with lock:
            # Double-check after acquiring lock (another request may have refreshed)
            if not force_refresh and SEOService.is_cache_valid():
                return cache

            try:
                cache["is_warming"] = True
                await self._refresh_cache_with_timeout()
            except TimeoutError:
                logger.error(f"Cache refresh timed out after {CACHE_REFRESH_TIMEOUT}s")
                await self.db.rollback()
                # If we have successfully populated data before, extend expiry
                if cache["populated"]:
                    cache["expiry"] = datetime.now(UTC) + timedelta(minutes=30)
                    logger.warning("Using stale cache data due to timeout")
            except Exception as e:
                logger.error(f"Cache refresh failed: {e}")
                await self.db.rollback()
                # Circuit breaker: extend expiry on failure to avoid retry storm
                if cache["populated"]:
                    cache["expiry"] = datetime.now(UTC) + timedelta(minutes=5)
            finally:
                cache["is_warming"] = False

        return cache

    async def _refresh_cache_with_timeout(self) -> None:
        """Refresh cache with timeout protection."""
        async with asyncio.timeout(CACHE_REFRESH_TIMEOUT):
            await self._do_refresh_cache()

    async def _do_refresh_cache(self) -> None:
        """Perform the actual cache refresh.

        Builds all results in temporary variables first, then assigns
        to the shared cache dict atomically to avoid partial updates
        on failure.
        """
        cache = SEOService._sitemap_cache
        logger.info("Refreshing sitemap anchors and counts...")

        start_time = datetime.now(UTC)

        # Build all results in temp vars before touching the shared cache
        company_stmt = select(func.count(models.Company.orgnr))
        company_result = await self.db.execute(company_stmt)
        total_companies = company_result.scalar() or 0

        total_people = await self.role_repo.count_commercial_people()
        municipalities = await self.stats_repo.get_municipality_codes_with_updates() or []

        first_page_meta_count = len(STATIC_ROUTES) + len(municipalities)

        logger.debug("Fetching company sitemap anchors...")
        company_anchors = await self.company_repo.get_sitemap_anchors_optimized(URLS_PER_SITEMAP, first_page_meta_count)

        logger.debug("Fetching person sitemap anchors...")
        person_anchors = await self.role_repo.get_person_sitemap_anchors_optimized(URLS_PER_SITEMAP)

        # All queries succeeded — assign to shared cache atomically
        cache["total_companies"] = total_companies
        cache["total_people"] = total_people
        cache["municipalities"] = municipalities
        cache["company_anchors"] = company_anchors
        cache["person_anchors"] = person_anchors
        cache["populated"] = True
        cache["expiry"] = datetime.now(UTC) + SEOService.CACHE_TTL
        elapsed = (datetime.now(UTC) - start_time).total_seconds()
        logger.info(f"Sitemap cache refreshed in {elapsed:.2f}s. Next expiry: {cache['expiry']}")

        # Save to Redis so other containers (backend ↔ worker) share this data
        await SEOService._save_to_redis()

    # ------------------------------------------------------------------
    # Sitemap pagination — thin delegations so routers don't touch repos
    # ------------------------------------------------------------------

    async def get_paginated_orgnrs(
        self,
        offset: int = 0,
        limit: int = 50000,
        after_orgnr: str | None = None,
    ) -> list[tuple[str, Any]]:
        """Get paginated org numbers for sitemap generation."""
        return await self.company_repo.get_paginated_orgnrs(offset=offset, limit=limit, after_orgnr=after_orgnr)

    async def get_paginated_commercial_people(
        self,
        offset: int = 0,
        limit: int = 50000,
        after_name: str | None = None,
        after_birthdate: date | None = None,
    ) -> list[tuple[str, Any, Any]]:
        """Get paginated people for sitemap generation."""
        return await self.role_repo.get_paginated_commercial_people(
            offset=offset, limit=limit, after_name=after_name, after_birthdate=after_birthdate
        )

    async def get_company_og_data(self, orgnr: str) -> dict[str, Any] | None:
        """Fetch optimized data for company OG image."""
        # Query only needed fields for performance
        query = (
            select(
                models.Company.navn,
                models.Company.naeringskode,
                models.Company.antall_ansatte,
                models.LatestFinancials.salgsinntekter,
                models.LatestFinancials.aarsresultat,
            )
            .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            .where(models.Company.orgnr == orgnr)
        )

        result = await self.db.execute(query)
        row = result.first()

        if not row:
            return None

        nace_desc = get_nace_name(row.naeringskode) if row.naeringskode else "Virksomhet"

        return {
            "navn": row.navn or "Ukjent virksomhet",
            "orgnr": orgnr,
            "nace_name": nace_desc,
            "revenue": row.salgsinntekter,
            "profit": row.aarsresultat,
            "employees": row.antall_ansatte,
        }

    def generate_company_og_svg(self, data: dict[str, Any]) -> str:
        """Generates a dynamic SVG OpenGraph card for a company."""
        # Sanitize inputs for SVG safety
        name = html.escape(data["navn"])
        orgnr = html.escape(data["orgnr"])
        industry = html.escape(data["nace_name"])

        # Format numbers
        def format_curr(val):
            if val is None:
                return "—"
            if val >= 1_000_000:
                return f"{val / 1_000_000:.1f}M".replace(".", ",")
            if val >= 1_000:
                return f"{val / 1_000:.0f}K".replace(".", ",")
            return str(val)

        rev = format_curr(data["revenue"])
        prof = format_curr(data["profit"])
        emp = data["employees"] if data["employees"] is not None else "—"

        # SVG template - optimized for high-impact social sharing
        svg = f"""
        <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="1200" height="630" fill="url(#grad)" />

            <!-- Pattern -->
            <circle cx="1100" cy="100" r="250" fill="white" opacity="0.03" />
            <rect x="50" y="50" width="1100" height="530" rx="30" fill="none" stroke="white" stroke-opacity="0.1" stroke-width="2" />

            <!-- Brand -->
            <text x="80" y="100" font-family="sans-serif" font-size="28" font-weight="bold" fill="#60a5fa">BEDRIFTSGRAFEN.NO</text>

            <!-- Company Info -->
            <text x="80" y="240" font-family="sans-serif" font-size="64" font-weight="900" fill="white">{name[:60]}{"..." if len(name) > 60 else ""}</text>
            <text x="80" y="300" font-family="sans-serif" font-size="28" font-weight="bold" fill="#94a3b8">{industry[:70]}{"..." if len(industry) > 70 else ""}</text>
            <text x="80" y="345" font-family="sans-serif" font-size="24" fill="#64748b">Org.nr: {orgnr}</text>

            <!-- Stats Row -->
            <g transform="translate(80, 480)">
                <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="bold" fill="#94a3b8" letter-spacing="2">OMSETNING</text>
                <text x="0" y="55" font-family="sans-serif" font-size="64" font-weight="bold" fill="white">{rev}</text>
            </g>

            <g transform="translate(450, 480)">
                <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="bold" fill="#94a3b8" letter-spacing="2">ÅRSRESULTAT</text>
                <text x="0" y="55" font-family="sans-serif" font-size="64" font-weight="bold" fill="white">{prof}</text>
            </g>

            <g transform="translate(850, 480)">
                <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="bold" fill="#94a3b8" letter-spacing="2">ANSATTE</text>
                <text x="0" y="55" font-family="sans-serif" font-size="64" font-weight="bold" fill="white">{emp}</text>
            </g>

            <!-- Status Pill -->
            <rect x="80" y="130" width="120" height="32" rx="16" fill="#3b82f6" opacity="0.2" />
            <text x="140" y="152" font-family="sans-serif" font-size="14" font-weight="bold" fill="#93c5fd" text-anchor="middle">OFFISIELL DATA</text>

            <!-- Bottom Line -->
            <rect x="0" y="620" width="1200" height="10" fill="#3b82f6" />
        </svg>
        """
        return textwrap.dedent(svg)
