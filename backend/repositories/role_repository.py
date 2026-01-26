"""Repository for Role database operations"""

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select, text, tuple_
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

        Note:
            This method assumes the calling code has already deleted old roles
            for the company (via delete_by_orgnr) to avoid potential duplicates.
            Role model uses auto-increment ID primary key, so duplicates are
            possible if the same role data is inserted multiple times.
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
            logger.error(f"Failed to save role batch: {e}", exc_info=True)
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

    async def search_people(self, query: str, limit: int = 10, include_all: bool = False) -> list[dict]:
        """
        Search for unique people names across the roles table.
        Uses trigram similarity for fuzzy matching.
        Applying commercial filtering unless include_all is True.
        """
        if len(query) < 3:
            return []

        from constants.org_forms import COMMERCIAL_ORG_FORMS, NON_COMMERCIAL_ORG_FORMS

        try:
            # We want unique combinations of name and birthdate
            stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    func.count(models.Role.id).label("role_count"),
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.ilike(f"%{query}%"))
                .where(models.Role.person_navn.is_not(None))
            )

            # Apply commercial filtering unless admin
            if not include_all:
                stmt = stmt.where(
                    (models.Company.registrert_i_foretaksregisteret == True)  # noqa: E712
                    | (
                        models.Company.organisasjonsform.in_(list(COMMERCIAL_ORG_FORMS))
                        & ~models.Company.organisasjonsform.in_(list(NON_COMMERCIAL_ORG_FORMS))
                        & (models.Company.organisasjonsform != "STI")
                    )
                )

            stmt = stmt.group_by(models.Role.person_navn, models.Role.foedselsdato).order_by(
                func.count(models.Role.id).desc()
            )
            stmt = stmt.limit(limit)

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

    async def get_person_commercial_roles(
        self, name: str, birthdate: date | None = None, include_all: bool = False
    ) -> list[models.Role]:
        """
        Fetch roles for a person. By default, only returns "commercial" (næringsvirksomhet) roles
        per Enhetsregisterloven § 22. If include_all is True, returns everything (admin view).
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
                if isinstance(birthdate, str):
                    birthdate = date.fromisoformat(birthdate)
                stmt = stmt.where(models.Role.foedselsdato == birthdate)

            # Apply legal commercial filtering per Enhetsregisterloven § 22 unless admin
            if not include_all:
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

    async def count_total_roles(self) -> int:
        """Count total number of roles in the database."""
        try:
            # Use pg_class for fast estimate if possible, otherwise count
            result = await self.db.execute(
                text("SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname='roller'")
            )
            count = result.scalar()
            if count and count > 0:
                return int(count)

            result = await self.db.execute(select(func.count(models.Role.id)))
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"Error counting total roles: {e}")
            return 0

    async def get_average_board_age(self) -> float:
        """
        Calculate the average age of active board members.
        Board members are defined as day manager, chairman, and board members.
        """
        try:
            # Board roles: dagligLeder (MD), styreleder (Chairman), styremedlem (Board Member)
            board_role_codes = ["dagligLeder", "styreleder", "styremedlem"]

            # Age calculation: current_year - birth_year
            # We filter for roles where foedselsdato is not null and fratraadt is False
            current_year = date.today().year

            stmt = select(func.avg(current_year - func.extract("year", models.Role.foedselsdato))).where(
                models.Role.type_kode.in_(board_role_codes),
                models.Role.fratraadt.is_(False),
                models.Role.foedselsdato.is_not(None),
            )

            result = await self.db.execute(stmt)
            avg_age = result.scalar()
            return round(float(avg_age), 1) if avg_age else 0.0
        except Exception as e:
            logger.error(f"Error calculating average board age: {e}")
            return 0.0

    async def count_commercial_people(self) -> int:
        """
        Count total unique people with commercial roles.
        Used for sitemap generation.
        """
        from constants.org_forms import COMMERCIAL_ORG_FORMS, NON_COMMERCIAL_ORG_FORMS

        try:
            # Subquery for commercial filtering
            commercial_stmt = (
                select(models.Role.person_navn, models.Role.foedselsdato)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.is_not(None))
                .where(models.Role.foedselsdato.is_not(None))
                .where(
                    (models.Company.registrert_i_foretaksregisteret == True)  # noqa: E712
                    | (
                        models.Company.organisasjonsform.in_(list(COMMERCIAL_ORG_FORMS))
                        & ~models.Company.organisasjonsform.in_(list(NON_COMMERCIAL_ORG_FORMS))
                        & (models.Company.organisasjonsform != "STI")
                    )
                )
                .group_by(models.Role.person_navn, models.Role.foedselsdato)
            )

            stmt = select(func.count()).select_from(commercial_stmt.subquery())
            result = await self.db.execute(stmt)
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"Error counting commercial people: {e}")
            return 0

    async def get_paginated_commercial_people(
        self,
        offset: int = 0,
        limit: int = 50000,
        after_name: str | None = None,
        after_birthdate: date | None = None,
    ) -> list[tuple[str, date | None, datetime]]:
        """
        Fetch paginated unique people with commercial roles.
        Used for sitemap generation.
        Supports both OFFSET (slow) and Keyset (fast) pagination.
        """
        from constants.org_forms import COMMERCIAL_ORG_FORMS, NON_COMMERCIAL_ORG_FORMS

        try:
            stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    func.max(models.Role.updated_at).label("latest_update"),
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.is_not(None))
                .where(models.Role.foedselsdato.is_not(None))
                .where(
                    (models.Company.registrert_i_foretaksregisteret == True)  # noqa: E712
                    | (
                        models.Company.organisasjonsform.in_(list(COMMERCIAL_ORG_FORMS))
                        & ~models.Company.organisasjonsform.in_(list(NON_COMMERCIAL_ORG_FORMS))
                        & (models.Company.organisasjonsform != "STI")
                    )
                )
                .group_by(models.Role.person_navn, models.Role.foedselsdato)
                .order_by(models.Role.person_navn, models.Role.foedselsdato)
            )

            if after_name is not None:
                # Row-value comparison for stable keyset seeking
                stmt = stmt.where(
                    tuple_(models.Role.person_navn, models.Role.foedselsdato) > (after_name, after_birthdate)
                )
            else:
                stmt = stmt.offset(offset)

            stmt = stmt.limit(limit)

            result = await self.db.execute(stmt)
            return [(row.person_navn, row.foedselsdato, row.latest_update) for row in result]
        except Exception as e:
            logger.error(f"Error fetching paginated commercial people: {e}")
            return []

    async def get_person_sitemap_anchors(self, page_size: int = 50000) -> list[tuple[str, date | None]]:
        """
        Fetch the starting (name, birthdate) for each sitemap page.
        Allows 'jumping' to a specific page using keyset pagination.

        NOTE: This is the legacy O(n) implementation. Use get_person_sitemap_anchors_optimized instead.
        """
        # Get total count first
        total = await self.count_commercial_people()

        anchors = []
        # Page 1 contains page_size people.
        # Its last person is at index (page_size - 1).
        # We use the LAST person of page N as the anchor for page N+1.
        start_offset = page_size - 1

        for offset in range(start_offset, total, page_size):
            if offset < 0:
                continue

            from constants.org_forms import COMMERCIAL_ORG_FORMS, NON_COMMERCIAL_ORG_FORMS

            # Fetch just the (name, birthdate) at this offset
            anchor_stmt = (
                select(models.Role.person_navn, models.Role.foedselsdato)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.is_not(None))
                .where(models.Role.foedselsdato.is_not(None))
                .where(
                    (models.Company.registrert_i_foretaksregisteret == True)  # noqa: E712
                    | (
                        models.Company.organisasjonsform.in_(list(COMMERCIAL_ORG_FORMS))
                        & ~models.Company.organisasjonsform.in_(list(NON_COMMERCIAL_ORG_FORMS))
                        & (models.Company.organisasjonsform != "STI")
                    )
                )
                .group_by(models.Role.person_navn, models.Role.foedselsdato)
                .order_by(models.Role.person_navn, models.Role.foedselsdato)
                .offset(offset)
                .limit(1)
            )
            anchor_result = await self.db.execute(anchor_stmt)
            row = anchor_result.first()
            if row:
                anchors.append((row.person_navn, row.foedselsdato))

        return anchors

    async def get_person_sitemap_anchors_optimized(self, page_size: int = 50000) -> list[tuple[str, date | None]]:
        """
        Fetch all sitemap page anchors in a single query using window functions.

        This is O(1) queries instead of O(n) where n = number of pages.
        Uses ROW_NUMBER() to identify page boundaries efficiently.

        Args:
            page_size: Number of URLs per sitemap page (default 50000)

        Returns:
            List of (name, birthdate) tuples that start each page (page 2 onwards)
        """
        from sqlalchemy import text

        query = text("""
            WITH commercial_people AS (
                SELECT DISTINCT ON (r.person_navn, r.foedselsdato)
                    r.person_navn,
                    r.foedselsdato
                FROM roller r
                JOIN bedrifter b ON r.orgnr = b.orgnr
                WHERE r.person_navn IS NOT NULL
                  AND r.foedselsdato IS NOT NULL
                  AND (
                      b.registrert_i_foretaksregisteret = true
                      OR (
                          b.organisasjonsform IN ('AS','ASA','ENK','ANS','DA','NUF','KS','SAM','IKS')
                          AND b.organisasjonsform NOT IN ('FLI','BRL','ESEK','ANNA')
                          AND b.organisasjonsform != 'STI'
                      )
                  )
                ORDER BY r.person_navn, r.foedselsdato
            ),
            numbered AS (
                SELECT 
                    person_navn,
                    foedselsdato,
                    ROW_NUMBER() OVER (ORDER BY person_navn, foedselsdato) as rn
                FROM commercial_people
            )
            SELECT person_navn, foedselsdato
            FROM numbered
            WHERE MOD(rn, :page_size) = 0
            ORDER BY rn
        """)

        try:
            result = await self.db.execute(query, {"page_size": page_size})
            return [(row[0], row[1]) for row in result]
        except Exception as e:
            logger.error(f"Error fetching person sitemap anchors (optimized): {e}")
            # Fallback to legacy method
            return await self.get_person_sitemap_anchors(page_size)
