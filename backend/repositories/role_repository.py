"""Repository for Role database operations"""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import Select, delete, select, text, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager
from sqlalchemy.sql import func

import models
from constants.org_forms import COMMERCIAL_ORG_FORMS, NON_COMMERCIAL_ORG_FORMS

logger = logging.getLogger(__name__)


def _escape_like(value: str) -> str:
    """Escape LIKE/ILIKE metacharacters so user input is treated as literal text.

    Relies on the default SQL backslash escape character used by asyncpg/PostgreSQL.
    Order matters: backslashes must be escaped first to avoid double-escaping.
    """
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# Cache duration: roles are valid for 7 days before refresh
ROLE_CACHE_DAYS = 7


class RoleRepository:
    """Repository for managing company roles (roller) data"""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _commercial_filter(stmt: Select[Any]) -> Select[Any]:
        """Apply Enhetsregisterloven § 22 commercial entity filter.

        Rule 1: Registered in Foretaksregisteret → ALWAYS commercial.
        Rule 2: Fallback to org-form whitelist (excluding blacklist + STI).

        Requires a prior JOIN on models.Company.
        """
        return stmt.where(
            (models.Company.registrert_i_foretaksregisteret == True)  # noqa: E712
            | (
                models.Company.organisasjonsform.in_(list(COMMERCIAL_ORG_FORMS))
                & ~models.Company.organisasjonsform.in_(list(NON_COMMERCIAL_ORG_FORMS))
                & (models.Company.organisasjonsform != "STI")
            )
        )

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

        # Handle timezone-aware datetimes (assume UTC as per project standard)

        now = datetime.now(UTC)
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
            logger.error(f"Failed to delete roles for {orgnr}: {e}")
            if commit:
                await self.db.rollback()
            return 0

    async def delete_batch(self, orgnrs: list[str], commit: bool = True) -> int:
        """
        Efficiently delete all roles for a list of companies.

        Args:
            orgnrs: List of company organization numbers
            commit: Whether to commit the transaction (default True)

        Returns:
            Total number of roles deleted
        """
        if not orgnrs:
            return 0

        try:
            stmt = delete(models.Role).where(models.Role.orgnr.in_(orgnrs))
            result = await self.db.execute(stmt)
            if commit:
                await self.db.commit()
            deleted: int = result.rowcount  # type: ignore[attr-defined]
            logger.info(f"Deleted {deleted} roles across {len(orgnrs)} companies")
            return deleted
        except Exception as e:
            logger.error(f"Failed to delete roles batch: {e}")
            if commit:
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

        try:
            # We want unique combinations of name and birthdate
            stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    func.count(models.Role.id).label("role_count"),
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.ilike(f"%{_escape_like(query)}%"))
                .where(models.Role.person_navn.is_not(None))
            )

            if not include_all:
                stmt = self._commercial_filter(stmt)

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

    async def search_people_detailed(
        self,
        query: str,
        offset: int = 0,
        limit: int = 20,
        include_all: bool = False,
        sort_by: str = "role_count",
        sort_order: str = "desc",
    ) -> list[dict]:
        """
        Enriched person search for the results page.
        Returns role counts (total + active), top role types, and notable companies.
        """
        if len(query) < 3:
            return []

        try:
            # Step 1: Get paginated people with counts
            role_count_expr = func.count(models.Role.id)
            active_count_expr = func.count(models.Role.id).filter(models.Role.fratraadt.is_(False))

            stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    role_count_expr.label("role_count"),
                    active_count_expr.label("active_role_count"),
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.ilike(f"%{_escape_like(query)}%"))
                .where(models.Role.person_navn.is_not(None))
            )

            if not include_all:
                stmt = self._commercial_filter(stmt)

            # Dynamic sort
            sort_column_map = {
                "role_count": role_count_expr,
                "active_roles": active_count_expr,
                "name": models.Role.person_navn,
            }
            sort_col = sort_column_map.get(sort_by, role_count_expr)
            order_clause = sort_col.asc() if sort_order == "asc" else sort_col.desc()

            stmt = (
                stmt.group_by(models.Role.person_navn, models.Role.foedselsdato)
                .order_by(order_clause)
                .offset(offset)
                .limit(limit)
            )

            result = await self.db.execute(stmt)
            people = [
                {
                    "name": row.person_navn,
                    "birthdate": row.foedselsdato,
                    "role_count": row.role_count,
                    "active_role_count": row.active_role_count,
                }
                for row in result
            ]

            if not people:
                return []

            # Step 2: Batch-enrich all people with top roles (single query)
            person_keys = [(p["name"], p["birthdate"]) for p in people]
            name_list = [k[0] for k in person_keys]

            # Top role types per person (batched)
            role_stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    models.Role.type_beskrivelse,
                    func.count(models.Role.id).label("cnt"),
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.in_(name_list))
                .where(models.Role.fratraadt.is_(False))
                .where(models.Role.type_beskrivelse.is_not(None))
            )
            if not include_all:
                role_stmt = self._commercial_filter(role_stmt)
            role_stmt = role_stmt.group_by(
                models.Role.person_navn, models.Role.foedselsdato, models.Role.type_beskrivelse
            ).order_by(func.count(models.Role.id).desc())

            role_result = await self.db.execute(role_stmt)
            # Build a map: (name, birthdate) -> top 3 role descriptions
            roles_map: dict[tuple[str, object], list[str]] = {}
            for row in role_result:
                key = (row.person_navn, row.foedselsdato)
                if key not in roles_map:
                    roles_map[key] = []
                if len(roles_map[key]) < 3:
                    roles_map[key].append(f"{row.type_beskrivelse} ({row.cnt})")

            # Step 3: Batch-enrich notable companies (single query)
            comp_stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    models.Company.navn,
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.in_(name_list))
                .where(models.Role.fratraadt.is_(False))
                .where(models.Company.navn.is_not(None))
            )
            if not include_all:
                comp_stmt = self._commercial_filter(comp_stmt)
            comp_stmt = comp_stmt.order_by(models.Role.updated_at.desc())

            comp_result = await self.db.execute(comp_stmt)
            # Build a map: (name, birthdate) -> top 2 company names
            companies_map: dict[tuple[str, object], list[str]] = {}
            for comp_row in comp_result:
                key = (comp_row.person_navn, comp_row.foedselsdato)
                if key not in companies_map:
                    companies_map[key] = []
                if len(companies_map[key]) < 2 and comp_row.navn not in companies_map[key]:
                    companies_map[key].append(comp_row.navn)

            # Step 4: Attach enrichment data to each person
            for person in people:
                key = (person["name"], person["birthdate"])
                person["top_roles"] = roles_map.get(key, [])
                person["notable_companies"] = companies_map.get(key, [])

            return people
        except Exception as e:
            logger.error("Error in detailed people search", extra={"query": query, "error": str(e)})
            return []

    async def count_people_search(self, query: str, include_all: bool = False) -> int:
        """Count total unique people matching a search query. For pagination."""
        if len(query) < 3:
            return 0

        try:
            sub = (
                select(models.Role.person_navn, models.Role.foedselsdato)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.ilike(f"%{_escape_like(query)}%"))
                .where(models.Role.person_navn.is_not(None))
            )

            if not include_all:
                sub = self._commercial_filter(sub)

            sub = sub.group_by(models.Role.person_navn, models.Role.foedselsdato)

            stmt = select(func.count()).select_from(sub.subquery())
            result = await self.db.execute(stmt)
            return result.scalar() or 0
        except Exception as e:
            logger.error("Error counting people search", extra={"query": query, "error": str(e)})
            return 0

    async def get_person_commercial_roles(
        self,
        name: str,
        birthdate: date | None = None,
        birthyear: int | None = None,
        include_all: bool = False,
    ) -> list[models.Role]:
        """
        Fetch roles for a person. By default, only returns "commercial" (næringsvirksomhet) roles
        per Enhetsregisterloven § 22. If include_all is True, returns everything (admin view).

        Args:
            name: Person's full name (exact match).
            birthdate: Exact birth date for disambiguation.
            birthyear: Birth year for year-only lookup (GDPR data minimization).
                       Mutually exclusive with birthdate; birthdate takes precedence.
            include_all: If True, skip commercial filter (admin view).
        """
        try:
            # Build base query with join
            stmt = (
                select(models.Role)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .options(contains_eager(models.Role.company))
                .where(models.Role.person_navn == name)
            )

            # Handle birthdate filtering
            if birthdate is not None:
                if isinstance(birthdate, str):
                    birthdate = date.fromisoformat(birthdate)
                stmt = stmt.where(models.Role.foedselsdato == birthdate)
            elif birthyear is not None:
                stmt = stmt.where(func.extract("year", models.Role.foedselsdato) == birthyear)

            if not include_all:
                stmt = self._commercial_filter(stmt)

            stmt = stmt.order_by(
                models.Role.fratraadt.asc(),  # Active roles first
                models.Role.updated_at.desc(),
            )
            result = await self.db.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(
                "Error fetching commercial roles",
                extra={"person_name": name, "birthdate": "REDACTED", "error": str(e)},
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
        try:
            commercial_stmt = (
                select(models.Role.person_navn, models.Role.foedselsdato)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.is_not(None))
                .where(models.Role.foedselsdato.is_not(None))
            )
            commercial_stmt = self._commercial_filter(commercial_stmt)
            commercial_stmt = commercial_stmt.group_by(models.Role.person_navn, models.Role.foedselsdato)

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
            )
            stmt = self._commercial_filter(stmt)
            stmt = stmt.group_by(models.Role.person_navn, models.Role.foedselsdato).order_by(
                models.Role.person_navn, models.Role.foedselsdato
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

            # Fetch just the (name, birthdate) at this offset
            anchor_stmt = (
                select(models.Role.person_navn, models.Role.foedselsdato)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn.is_not(None))
                .where(models.Role.foedselsdato.is_not(None))
            )
            anchor_stmt = self._commercial_filter(anchor_stmt)
            anchor_stmt = (
                anchor_stmt.group_by(models.Role.person_navn, models.Role.foedselsdato)
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

        # NOTE: The raw SQL WHERE clause below mirrors _commercial_filter().
        # If _commercial_filter() changes, update this query to match.
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
