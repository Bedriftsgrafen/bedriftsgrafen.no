"""Service for managing company roles with on-demand caching"""

import contextlib
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

import models
from repositories.role_repository import RoleRepository
from services.brreg_api_service import BrregApiService

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
                logger.debug(f"Using cached roles for {orgnr}")
                return await self.role_repo.get_by_orgnr(orgnr)

        # Safety Check: Prevent force_refresh spam (max once per 60s)
        if force_refresh:
            last_update = await self.role_repo.get_cache_timestamp(orgnr)
            if last_update:
                elapsed = datetime.now(timezone.utc) - last_update
                if elapsed < timedelta(seconds=60):
                    logger.info(f"Skipping force refresh for {orgnr} (last update {elapsed.seconds}s ago)")
                    return await self.role_repo.get_by_orgnr(orgnr)

        # Fetch from API
        try:
            logger.info(f"Fetching roles from API for {orgnr}")
            api_roles = await self.brreg_api.fetch_roles(orgnr)

            if not api_roles:
                # No roles found - still valid response
                # Delete any old cached roles
                await self.role_repo.delete_by_orgnr(orgnr)
                return []

            # Delete old roles and insert new ones
            await self.role_repo.delete_by_orgnr(orgnr, commit=False)

            # Parse API response into Role models
            new_roles = []
            for role_data in api_roles:
                try:
                    # Parse date if present
                    foedselsdato = None
                    if role_data.get("foedselsdato"):
                        with contextlib.suppress(ValueError, TypeError):
                            foedselsdato = datetime.strptime(role_data["foedselsdato"], "%Y-%m-%d").date()

                    role = models.Role(
                        orgnr=orgnr,
                        type_kode=role_data.get("type_kode"),
                        type_beskrivelse=role_data.get("type_beskrivelse"),
                        person_navn=role_data.get("person_navn"),
                        foedselsdato=foedselsdato,
                        enhet_orgnr=role_data.get("enhet_orgnr"),
                        enhet_navn=role_data.get("enhet_navn"),
                        fratraadt=role_data.get("fratraadt", False),
                        rekkefoelge=role_data.get("rekkefoelge"),
                    )
                    new_roles.append(role)
                except Exception as e:
                    logger.warning(f"Error parsing role: {e}")
                    continue

            # Save to database
            await self.role_repo.create_batch(new_roles, commit=True)

            return new_roles

        except Exception as e:
            logger.error(f"Error fetching roles for {orgnr}: {e}")
            # Return cached data if available, even if stale
            cached = await self.role_repo.get_by_orgnr(orgnr)
            if cached:
                logger.info(f"Returning stale cached roles for {orgnr}")
                return cached
            raise
