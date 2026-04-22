"""Service for managing company roles with on-demand caching"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

import models
from repositories.role_repository import RoleRepository
from services.brreg_api_service import BrregApiService
from services.brreg_mappers import map_role_from_api
from utils.logging_config import sanitize_log

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
                return await self.role_repo.get_by_orgnr(orgnr)

        # Safety Check: Prevent force_refresh spam (max once per 60s)
        if force_refresh:
            last_update = await self.role_repo.get_cache_timestamp(orgnr)
            if last_update:
                elapsed = datetime.now(UTC) - last_update
                if elapsed < timedelta(seconds=60):
                    logger.info(
                        "Skipping force refresh for %s (last update %ds ago)", sanitize_log(orgnr), elapsed.seconds
                    )
                    return await self.role_repo.get_by_orgnr(orgnr)

        # Fetch from API
        try:
            logger.info("Fetching roles from API for %s", sanitize_log(orgnr))
            api_roles = await self.brreg_api.fetch_roles(orgnr)

            if not api_roles:
                # No roles found - still valid response
                # Delete any old cached roles
                await self.role_repo.delete_by_orgnr(orgnr)
                return []

            # Delete old roles and insert new ones
            await self.role_repo.delete_by_orgnr(orgnr, commit=False)

            # Parse API response into Role models using shared mapper
            new_roles = []
            for role_data in api_roles:
                try:
                    new_roles.append(map_role_from_api(role_data, orgnr))
                except Exception as e:
                    logger.warning(f"Error parsing role: {e}")
                    continue

            # Save to database
            await self.role_repo.create_batch(new_roles, commit=True)

            return new_roles

        except Exception as e:
            logger.error("Error fetching roles for %s: %s", sanitize_log(orgnr), e)
            # Return cached data if available, even if stale
            cached = await self.role_repo.get_by_orgnr(orgnr)
            if cached:
                logger.info("Returning stale cached roles for %s", sanitize_log(orgnr))
                return cached
            raise
