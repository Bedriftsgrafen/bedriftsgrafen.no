"""Service for managing company roles with on-demand caching"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

import models
from repositories.role_repository import RoleRepository
from services.brreg_api_service import BrregApiService
from services.brreg_egress_guard import brreg_traffic_class
from services.brreg_mappers import map_role_from_api
from utils.logging_config import sanitize_log
from utils.metrics import BRREG_CACHE_EVENTS_TOTAL

logger = logging.getLogger(__name__)


class RoleService:
    """
    Service for fetching and caching company roles.
    Uses on-demand fetching: checks DB first, fetches from API if not found or stale.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.role_repo = RoleRepository(db)
        self.brreg_api = BrregApiService()

    async def get_roles(self, orgnr: str, force_refresh: bool = False) -> list[models.Role]:
        """
        Get roles for a company, using cached data if available.

        Args:
            orgnr: Company organization number
            force_refresh: If True, always fetch from API

        Returns:
            List of Role models
        """
        # Check cache first (unless force refresh)
        if not force_refresh:
            cache_valid = await self.role_repo.is_cache_valid(orgnr)
            if cache_valid:
                logger.debug("Using cached roles for %s", sanitize_log(orgnr))
                roles = await self.role_repo.get_by_orgnr(orgnr)
                BRREG_CACHE_EVENTS_TOTAL.labels(
                    endpoint="roles",
                    traffic_class=brreg_traffic_class(),
                    result="hit" if roles else "negative_hit",
                ).inc()
                return roles
            BRREG_CACHE_EVENTS_TOTAL.labels(
                endpoint="roles",
                traffic_class=brreg_traffic_class(),
                result="miss",
            ).inc()

        # Do not let the public endpoint proxy arbitrary organization numbers
        # to Brreg. It also ensures a successful result can always be cached.
        if not await self.role_repo.company_exists(orgnr):
            logger.info("Skipping role refresh for unknown company %s", sanitize_log(orgnr))
            return []

        # Serialize cache misses for this organization number across all
        # uvicorn workers, then re-check because the waiter ahead of us may
        # already have populated the cache.
        await self.role_repo.acquire_refresh_lock(orgnr)

        if not force_refresh:
            cache_valid = await self.role_repo.is_cache_valid(orgnr)
            if cache_valid:
                logger.debug("Using roles cached by concurrent refresh for %s", sanitize_log(orgnr))
                roles = await self.role_repo.get_by_orgnr(orgnr)
                BRREG_CACHE_EVENTS_TOTAL.labels(
                    endpoint="roles",
                    traffic_class=brreg_traffic_class(),
                    result="hit" if roles else "negative_hit",
                ).inc()
                return roles

        # Safety check: prevent force_refresh spam. For known-empty role sets,
        # get_refresh_timestamp uses the persisted last_polled_roles marker.
        if force_refresh:
            last_update = await self.role_repo.get_refresh_timestamp(orgnr)
            if last_update:
                elapsed = datetime.now(UTC) - last_update
                if elapsed < timedelta(seconds=60):
                    elapsed_seconds = max(0, int(elapsed.total_seconds()))
                    logger.info(
                        "Skipping force refresh for %s (last update %ds ago)", sanitize_log(orgnr), elapsed_seconds
                    )
                    return await self.role_repo.get_by_orgnr(orgnr)

        # Fetch from API
        try:
            logger.info("Fetching roles from API for %s", sanitize_log(orgnr))
            api_roles = await self.brreg_api.fetch_roles(orgnr)

            if not api_roles:
                # A successful empty response is cacheable too. Store the poll
                # marker atomically with deletion so the next request does not
                # immediately hit Brreg again.
                await self.role_repo.delete_by_orgnr(orgnr, commit=False)
                await self.role_repo.mark_cache_refreshed(orgnr, commit=True)
                return []

            # Parse API response into Role models using shared mapper
            new_roles = []
            for role_data in api_roles:
                try:
                    new_roles.append(map_role_from_api(role_data, orgnr))
                except Exception as e:
                    logger.warning(f"Error parsing role: {e}")
                    continue

            if not new_roles:
                raise ValueError(f"Role API returned {len(api_roles)} entries, but none could be parsed")

            # Delete old roles only after the replacement payload has parsed successfully
            await self.role_repo.delete_by_orgnr(orgnr, commit=False)

            # Save to database
            saved_count = await self.role_repo.create_batch(new_roles, commit=True)
            if saved_count != len(new_roles):
                raise RuntimeError(f"Only saved {saved_count} of {len(new_roles)} roles for {orgnr}")

            return new_roles

        except Exception as e:
            logger.error("Error fetching roles for %s: %s", sanitize_log(orgnr), e)
            # Release the transaction-scoped refresh lock before querying the
            # stale cache, and ensure a failed replacement cannot leak into it.
            await self.db.rollback()
            # Return cached data if available, even if stale
            cached = await self.role_repo.get_by_orgnr(orgnr)
            if cached:
                logger.info("Returning stale cached roles for %s", sanitize_log(orgnr))
                BRREG_CACHE_EVENTS_TOTAL.labels(
                    endpoint="roles",
                    traffic_class=brreg_traffic_class(),
                    result="stale_fallback",
                ).inc()
                return cached
            raise
