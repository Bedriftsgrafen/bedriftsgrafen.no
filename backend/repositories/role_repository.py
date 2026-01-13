"""Repository for Role database operations"""

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager
from sqlalchemy.sql import func

import models

logger = logging.getLogger(__name__)

# Cache duration: roles are valid for 7 days before refresh
ROLE_CACHE_DAYS = 7


class RoleRepository:
    """Repository for managing company roles (roller) data"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_orgnr(self, orgnr: str) -> list[models.Role]:
        """Fetch all roles for a company, sorted by sequence and type."""
        try:
            stmt = (
                select(models.Role)
                .where(models.Role.orgnr == orgnr)
                .order_by(models.Role.rekkefoelge.asc().nullslast(), models.Role.type_beskrivelse)
            )
            result = await self.db.execute(stmt)
            roles = list(result.scalars().all())
            logger.debug(f"Fetched {len(roles)} roles for {orgnr}")
            return roles
        except Exception as e:
            logger.error(f"Failed to fetch roles for {orgnr}: {e}")
            return []

    async def get_cache_timestamp(self, orgnr: str) -> datetime | None:
        """
        Get the last update timestamp for roles of a company.
        Used for cache invalidation decisions.

        Args:
            orgnr: Company organization number

        Returns:
            Datetime of last update, or None if no roles exist
        """
        try:
            stmt = select(func.max(models.Role.updated_at)).where(models.Role.orgnr == orgnr)
            result = await self.db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting role cache timestamp for {orgnr}: {e}")
            return None

    async def is_cache_valid(self, orgnr: str) -> bool:
        """
        Check if cached roles are still valid (less than ROLE_CACHE_DAYS old).

        Args:
            orgnr: Company organization number

        Returns:
            True if cache is valid, False if refresh needed
        """
        last_updated = await self.get_cache_timestamp(orgnr)
        if not last_updated:
            return False

        # Handle timezone-aware vs naive datetime
        now = datetime.now(last_updated.tzinfo) if last_updated.tzinfo else datetime.now()
        cache_expiry = last_updated + timedelta(days=ROLE_CACHE_DAYS)
        return now < cache_expiry

    async def create_batch(self, roles: list[models.Role], commit: bool = True) -> int:
        """
        Batch create roles (more efficient than one-by-one).
        Uses add_all for bulk insert.

        Args:
            roles: List of Role models to create
            commit: Whether to commit the transaction (default True)

        Returns:
            Number of roles successfully saved
        """
        if not roles:
            return 0

        try:
            # Bulk insert using add_all for efficiency
            self.db.add_all(roles)
            if commit:
                await self.db.commit()
            logger.info(f"Successfully saved {len(roles)} roles (commit={commit})")
            return len(roles)

        except Exception as e:
            logger.error(f"Failed to save role batch: {e}")
            if commit:
                await self.db.rollback()
            return 0

    async def delete_by_orgnr(self, orgnr: str, commit: bool = True) -> int:
        """
        Delete all roles for a company.
        Used before re-syncing data.

        Args:
            orgnr: Company organization number
            commit: Whether to commit the transaction (default True)

        Returns:
            Number of roles deleted
        """
        try:
            stmt = delete(models.Role).where(models.Role.orgnr == orgnr)
            result = await self.db.execute(stmt)
            if commit:
                await self.db.commit()
            deleted: int = result.rowcount  # type: ignore[attr-defined]
            logger.info(f"Deleted {deleted} roles for {orgnr}")
            return deleted
        except Exception as e:
            logger.error(f"Error deleting roles for {orgnr}: {e}")
            await self.db.rollback()
            return 0

    async def count_by_orgnr(self, orgnr: str) -> int:
        """
        Count roles for a company.

        Args:
            orgnr: Company organization number

        Returns:
            Count of roles
        """
        try:
            stmt = select(func.count(models.Role.id)).where(models.Role.orgnr == orgnr)
            result = await self.db.execute(stmt)
            return result.scalar_one() or 0
        except Exception as e:
            logger.error("Error counting roles", extra={"orgnr": orgnr, "error": str(e)})
            return 0

    async def search_people(self, query: str, limit: int = 10) -> list[dict]:
        """
        Search for unique people names across the roles table.
        Uses trigram similarity for fuzzy matching.
        """
        if len(query) < 3:
            return []

        try:
            # We want unique combinations of name and birthdate
            # Using subquery for performance and grouping
            stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    func.count(models.Role.id).label("role_count"),
                )
                .where(models.Role.person_navn.ilike(f"%{query}%"))
                .where(models.Role.person_navn.is_not(None))
                .group_by(models.Role.person_navn, models.Role.foedselsdato)
                .order_by(func.count(models.Role.id).desc())
                .limit(limit)
            )
            result = await self.db.execute(stmt)
            return [
                {
                    "name": row.person_navn,
                    "birthdate": row.foedselsdato,
                    "role_count": row.role_count,
                }
                for row in result
            ]
        except Exception as e:
            logger.error("Error searching people", extra={"query": query, "error": str(e)})
            return []

    async def get_person_commercial_roles(self, name: str, birthdate: date | None = None) -> list[models.Role]:
        """
        Fetch all roles for a person that are considered "commercial" (næringsvirksomhet).
        Joins with Company to check registrert_i_foretaksregisteret and org form.
        """
        from constants.org_forms import COMMERCIAL_ORG_FORMS, NON_COMMERCIAL_ORG_FORMS

        try:
            # Build base query with join
            stmt = (
                select(models.Role)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .options(contains_eager(models.Role.company))
                .where(models.Role.person_navn == name)
            )

            # Handle birthdate filtering - match exactly or allow flexible matching
            if birthdate is not None:
                stmt = stmt.where(models.Role.foedselsdato == birthdate)
            # Note: If birthdate is None, we don't filter by it (matches all)

            # Apply legal commercial filtering per Enhetsregisterloven § 22
            # Rule 1: Registered in Foretaksregisteret = ALWAYS commercial
            # Rule 2: Fallback to org form whitelist (excluding explicit blacklist)
            stmt = stmt.where(
                (models.Company.registrert_i_foretaksregisteret == True)  # noqa: E712
                | (
                    models.Company.organisasjonsform.in_(list(COMMERCIAL_ORG_FORMS))
                    & ~models.Company.organisasjonsform.in_(list(NON_COMMERCIAL_ORG_FORMS))
                    & (models.Company.organisasjonsform != "STI")
                )
            )

            stmt = stmt.order_by(
                models.Role.fratraadt.asc(),  # Active roles first
                models.Role.updated_at.desc(),
            )
            result = await self.db.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(
                "Error fetching commercial roles",
                extra={"person_name": name, "birthdate": str(birthdate), "error": str(e)},
            )
            return []
