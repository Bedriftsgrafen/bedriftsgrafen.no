"""Repository for Role database operations"""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import Select, and_, delete, or_, select, text
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
                stmt = stmt.where(
                    models.Role.foedselsdato >= date(birthyear, 1, 1),
                    models.Role.foedselsdato < date(birthyear + 1, 1, 1),
                )
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

    async def get_person_connections(
        self,
        name: str,
        birthdate: date | None = None,
        birthyear: int | None = None,
        include_all: bool = False,
        limit: int = 25,
    ) -> list[dict]:
        """Find people sharing companies with this person.

        Strategy:
        1. Get all orgnrs for the target person (commercial filter applied)
        2. Find distinct (person_navn, foedselsdato) from roller WHERE orgnr IN those orgnrs
        3. Exclude the target person themselves
        4. Group by connected person, aggregate shared company details
        5. Sort by shared_company_count DESC

        Uses existing ix_roller_orgnr and ix_roller_person_navn_foedselsdato indexes.
        """
        try:
            # Step 1: Get person's company orgnrs
            orgnr_stmt = (
                select(models.Role.orgnr)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.person_navn == name)
                .where(models.Role.fratraadt.is_(False))
            )

            if birthdate is not None:
                orgnr_stmt = orgnr_stmt.where(models.Role.foedselsdato == birthdate)
            elif birthyear is not None:
                orgnr_stmt = orgnr_stmt.where(
                    models.Role.foedselsdato >= date(birthyear, 1, 1),
                    models.Role.foedselsdato < date(birthyear + 1, 1, 1),
                )

            if not include_all:
                orgnr_stmt = self._commercial_filter(orgnr_stmt)

            orgnr_result = await self.db.execute(orgnr_stmt)
            person_orgnrs = [row[0] for row in orgnr_result.all()]

            if not person_orgnrs:
                return []

            # Step 2: Find other active people on those same companies
            conn_stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    models.Role.orgnr,
                    models.Role.type_beskrivelse,
                    models.Company.navn,
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(models.Role.orgnr.in_(person_orgnrs))
                .where(models.Role.fratraadt.is_(False))
                .where(models.Role.person_navn != name)
            )

            conn_result = await self.db.execute(conn_stmt)
            rows = conn_result.all()

            # Step 3: Get the target person's roles per company for context
            target_roles_stmt = (
                select(models.Role.orgnr, models.Role.type_beskrivelse)
                .where(models.Role.person_navn == name)
                .where(models.Role.orgnr.in_(person_orgnrs))
                .where(models.Role.fratraadt.is_(False))
            )
            if birthdate is not None:
                target_roles_stmt = target_roles_stmt.where(models.Role.foedselsdato == birthdate)
            elif birthyear is not None:
                target_roles_stmt = target_roles_stmt.where(
                    models.Role.foedselsdato >= date(birthyear, 1, 1),
                    models.Role.foedselsdato < date(birthyear + 1, 1, 1),
                )

            target_result = await self.db.execute(target_roles_stmt)
            target_role_map: dict[str, str] = {}
            for orgnr_val, role_desc in target_result.all():
                if orgnr_val not in target_role_map:
                    target_role_map[orgnr_val] = role_desc

            # Step 4: Group by connected person
            connections: dict[tuple[str, date | None], list[dict]] = {}
            for person_navn, foedselsdato, orgnr_val, type_beskrivelse, company_navn in rows:
                key = (person_navn, foedselsdato)
                if key not in connections:
                    connections[key] = []
                connections[key].append(
                    {
                        "orgnr": orgnr_val,
                        "navn": company_navn,
                        "person_role": target_role_map.get(orgnr_val, ""),
                        "connection_role": type_beskrivelse,
                    }
                )

            # Step 5: Sort by shared company count DESC, apply limit
            sorted_connections = sorted(connections.items(), key=lambda x: len(x[1]), reverse=True)[:limit]

            return [
                {
                    "name": conn_name,
                    "foedselsdato": conn_birthdate,
                    "shared_company_count": len(shared),
                    "shared_companies": shared,
                }
                for (conn_name, conn_birthdate), shared in sorted_connections
            ]
        except Exception as e:
            logger.error(
                "Error fetching person connections",
                extra={"person_name": name, "error": str(e)},
            )
            return []

    async def get_companies_for_person(
        self,
        name: str,
        birthdate: date | None,
        birthyear: int | None,
        include_all: bool = False,
    ) -> list[str]:
        """Return list of orgnrs where this person has active roles.

        Used as a BFS primitive for network path finding.
        Uses ix_roller_person_navn_foedselsdato index.
        """
        try:
            stmt = (
                select(models.Role.orgnr)
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(
                    models.Role.person_navn == name,
                    models.Role.fratraadt == False,  # noqa: E712
                )
                .distinct()
            )

            if birthdate:
                stmt = stmt.where(models.Role.foedselsdato == birthdate)
            elif birthyear:
                # Use date range instead of EXTRACT() to allow index usage
                stmt = stmt.where(
                    models.Role.foedselsdato >= date(birthyear, 1, 1),
                    models.Role.foedselsdato < date(birthyear + 1, 1, 1),
                )

            if not include_all:
                stmt = self._commercial_filter(stmt)

            result = await self.db.execute(stmt)
            return [row[0] for row in result.all()]
        except Exception as e:
            logger.error("Error in get_companies_for_person", extra={"person_name": name, "error": str(e)})
            return []

    async def get_companies_for_persons_batch(
        self,
        persons: list[tuple[str, date | None, int | None]],
        include_all: bool = False,
    ) -> dict[tuple[str, str | None], list[str]]:
        """Batch version: get companies for multiple persons in a single query.

        Returns mapping of (upper_name, date_iso_str | None) → list of orgnrs.
        Full-date precision avoids merging the ~1% of persons who share name+year.
        Uses OR conditions per person to leverage ix_roller_person_navn_foedselsdato.
        """
        if not persons:
            return {}
        try:
            conditions = []
            for name, bd, by in persons:
                name_cond = models.Role.person_navn == name
                if bd:
                    conditions.append(and_(name_cond, models.Role.foedselsdato == bd))
                elif by:
                    conditions.append(
                        and_(
                            name_cond,
                            models.Role.foedselsdato >= date(by, 1, 1),
                            models.Role.foedselsdato < date(by + 1, 1, 1),
                        )
                    )
                else:
                    conditions.append(name_cond)

            stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    models.Role.orgnr,
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(
                    or_(*conditions),
                    models.Role.fratraadt == False,  # noqa: E712
                )
                .distinct()
            )

            if not include_all:
                stmt = self._commercial_filter(stmt)

            result = await self.db.execute(stmt)
            rows = result.all()

            mapping: dict[tuple[str, str | None], list[str]] = {}
            for row in rows:
                key = (row.person_navn.upper(), str(row.foedselsdato) if row.foedselsdato else None)
                mapping.setdefault(key, []).append(row.orgnr)
            return mapping
        except Exception as e:
            logger.error("Error in get_companies_for_persons_batch", extra={"count": len(persons), "error": str(e)})
            return {}

    async def get_people_for_companies(
        self,
        orgnrs: list[str],
        include_all: bool = False,
        exclude_persons: set[tuple[str, str | None]] | None = None,
    ) -> list[dict]:
        """Return distinct people with active roles in the given companies.

        Excludes already-visited persons to prevent BFS cycles.
        Used as a BFS primitive for network path finding.

        Returns list of dicts with keys: name, foedselsdato, orgnr, role_beskrivelse, enhet_navn
        """
        if not orgnrs:
            return []
        try:
            stmt = (
                select(
                    models.Role.person_navn,
                    models.Role.foedselsdato,
                    models.Role.orgnr,
                    models.Role.type_beskrivelse,
                    models.Company.navn.label("enhet_navn"),
                )
                .join(models.Company, models.Role.orgnr == models.Company.orgnr)
                .where(
                    models.Role.orgnr.in_(orgnrs),
                    models.Role.fratraadt == False,  # noqa: E712
                )
            )

            if not include_all:
                stmt = self._commercial_filter(stmt)

            result = await self.db.execute(stmt)
            rows = result.all()

            people = []
            for row in rows:
                if not row.person_navn:
                    continue
                person_key = (row.person_navn.upper(), str(row.foedselsdato) if row.foedselsdato else None)
                if exclude_persons and person_key in exclude_persons:
                    continue
                people.append(
                    {
                        "name": row.person_navn,
                        "foedselsdato": row.foedselsdato,
                        "orgnr": row.orgnr,
                        "role_beskrivelse": row.type_beskrivelse,
                        "enhet_navn": row.enhet_navn,
                    }
                )
            return people
        except Exception as e:
            logger.error("Error in get_people_for_companies", extra={"orgnrs_count": len(orgnrs), "error": str(e)})
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
        Uses official BRREG type codes: DAGL, LEDE, MEDL.
        """
        try:
            board_role_codes = ["DAGL", "LEDE", "MEDL"]

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

        Reads from the commercial_people_mv materialized view (pre-aggregated)
        instead of joining 3.38M roller rows with 1.16M bedrifter rows.
        """
        try:
            result = await self.db.execute(text("SELECT COUNT(*) FROM commercial_people_mv"))
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"Error counting commercial people: {e}")
            await self.db.rollback()
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
        Supports both OFFSET and keyset pagination.

        Reads from the commercial_people_mv materialized view (pre-aggregated)
        instead of joining 3.38M roller rows with 1.16M bedrifter rows.
        """
        try:
            if after_name is not None:
                # Keyset pagination: row-value comparison on unique index columns
                query = text("""
                    SELECT person_navn, foedselsdato, latest_update
                    FROM commercial_people_mv
                    WHERE (person_navn, foedselsdato) > (:after_name, :after_date)
                    ORDER BY person_navn, foedselsdato
                    LIMIT :limit
                """)
                result = await self.db.execute(
                    query,
                    {"after_name": after_name, "after_date": after_birthdate, "limit": limit},
                )
            else:
                # Offset pagination (first page or no cursor)
                query = text("""
                    SELECT person_navn, foedselsdato, latest_update
                    FROM commercial_people_mv
                    ORDER BY person_navn, foedselsdato
                    LIMIT :limit OFFSET :offset
                """)
                result = await self.db.execute(query, {"limit": limit, "offset": offset})

            return [(row[0], row[1], row[2]) for row in result]
        except Exception as e:
            logger.error(f"Error fetching paginated commercial people: {e}")
            await self.db.rollback()
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
        Reads from the commercial_people_mv materialized view so there is no
        expensive JOIN at query time (pre-aggregated ~905K rows).

        Args:
            page_size: Number of URLs per sitemap page (default 50000)

        Returns:
            List of (name, birthdate) tuples that start each page (page 2 onwards)
        """
        query = text("""
            WITH numbered AS (
                SELECT
                    person_navn,
                    foedselsdato,
                    ROW_NUMBER() OVER (ORDER BY person_navn, foedselsdato) AS rn
                FROM commercial_people_mv
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
            await self.db.rollback()
            # Fallback to legacy method
            return await self.get_person_sitemap_anchors(page_size)

    async def get_all_person_toplists(self, limit: int = 10) -> list[Any]:
        """Fetch all toplist categories in a single UNION ALL query.

        Returns ~6*limit rows, each tagged with a 'category' column.
        Category keys use official BRREG type codes where applicable.
        Ref: https://data.brreg.no/enhetsregisteret/api/roller/rolletyper
        All reads from pre-aggregated person_toplist_mv for fast response.
        """
        query = text("""
            (SELECT 'salgsinntekter' AS category,
                    person_navn, foedselsdato,
                    total_revenue AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             WHERE total_revenue > 0
             ORDER BY total_revenue DESC
             LIMIT :lim)
            UNION ALL
            (SELECT 'total_profit' AS category,
                    person_navn, foedselsdato,
                    total_profit AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             WHERE total_profit > 0
             ORDER BY total_profit DESC
             LIMIT :lim)
            UNION ALL
            (SELECT 'total_employees' AS category,
                    person_navn, foedselsdato,
                    total_employees AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             WHERE total_employees > 0
             ORDER BY total_employees DESC
             LIMIT :lim)
            UNION ALL
            (SELECT 'DAGL' AS category,
                    person_navn, foedselsdato,
                    ceo_count AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             WHERE ceo_count > 0
             ORDER BY ceo_count DESC
             LIMIT :lim)
            UNION ALL
            (SELECT 'active_companies' AS category,
                    person_navn, foedselsdato,
                    active_companies AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             ORDER BY active_companies DESC
             LIMIT :lim)
            UNION ALL
            (SELECT 'industry_diversity' AS category,
                    person_navn, foedselsdato,
                    industry_diversity AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             WHERE industry_diversity > 0
             ORDER BY industry_diversity DESC
             LIMIT :lim)
            UNION ALL
            (SELECT 'LEDE' AS category,
                    person_navn, foedselsdato,
                    styreleder_count AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             WHERE styreleder_count > 0
             ORDER BY styreleder_count DESC
             LIMIT :lim)
            UNION ALL
            (SELECT 'MEDL' AS category,
                    person_navn, foedselsdato,
                    styremedlem_count AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             WHERE styremedlem_count > 0
             ORDER BY styremedlem_count DESC
             LIMIT :lim)
            UNION ALL
            (SELECT 'active_roles' AS category,
                    person_navn, foedselsdato,
                    active_roles AS value,
                    active_roles, active_companies
             FROM person_toplist_mv
             ORDER BY active_roles DESC
             LIMIT :lim)
        """)
        try:
            result = await self.db.execute(query, {"lim": limit})
            return list(result.fetchall())
        except Exception as e:
            logger.error("Error fetching person toplists", extra={"error": str(e)})
            return []

    async def get_person_aggregate_stats(self) -> dict[str, Any]:
        """Aggregate statistics for the person landing page.

        Reads from pre-computed person_landing_stats_mv (single-row MV).
        Includes full role type distribution from all BRREG types.
        """
        try:
            result = await self.db.execute(text("SELECT * FROM person_landing_stats_mv LIMIT 1"))
            row = result.fetchone()

            if not row:
                raise ValueError("person_landing_stats_mv is empty")

            total_persons = int(row.total_persons or 0)
            total_active_roles = int(row.total_active_roles or 0)

            # role_types is stored as JSON array in the MV
            import json

            raw_role_types = row.role_types
            if isinstance(raw_role_types, str):
                raw_role_types = json.loads(raw_role_types)
            role_type_distribution = raw_role_types or []

            generation_distribution = [
                {"generation": "Silent", "birth_year_range": "<1940", "count": int(row.silent or 0)},
                {"generation": "Boomers", "birth_year_range": "1940-1959", "count": int(row.boomers or 0)},
                {"generation": "Gen X", "birth_year_range": "1960-1979", "count": int(row.gen_x or 0)},
                {"generation": "Millennials", "birth_year_range": "1980-1999", "count": int(row.millennials or 0)},
                {"generation": "Gen Z", "birth_year_range": "2000+", "count": int(row.gen_z or 0)},
            ]

            avg_board_age = round(float(row.avg_board_age), 1) if row.avg_board_age else 0.0

            return {
                "total_persons": total_persons,
                "total_active_roles": total_active_roles,
                "role_type_distribution": role_type_distribution,
                "generation_distribution": generation_distribution,
                "avg_board_age": avg_board_age,
            }
        except Exception as e:
            logger.error("Error fetching person aggregate stats", extra={"error": str(e)})
            return {
                "total_persons": 0,
                "total_active_roles": 0,
                "role_type_distribution": [],
                "generation_distribution": [],
                "avg_board_age": 0.0,
            }
