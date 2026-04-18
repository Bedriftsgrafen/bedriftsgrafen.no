"""Person service for orchestrating role data with financial enrichment.

Follows the feature_implementation skill: business logic in service layer,
injected via Depends() in routers.
"""

import logging
from datetime import date

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

import models
from database import get_db
from repositories.accounting_repository import AccountingRepository
from repositories.role_repository import RoleRepository
from schemas.people import (
    CompanySparklineData,
    NetworkPathNode,
    NetworkPathResponse,
    PersonConnectionResponse,
    PersonRoleResponse,
    SharedCompanyInfo,
    SparklinePoint,
)

logger = logging.getLogger(__name__)


class PersonService:
    """Orchestrates person role data with financial enrichment."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.role_repo = RoleRepository(db)
        self.accounting_repo = AccountingRepository(db)

    async def get_enriched_roles(
        self, name: str, birthdate: date | None, birthyear: int | None, include_all: bool
    ) -> list[PersonRoleResponse]:
        """Fetch roles and enrich with company context + latest financials."""
        roles = await self.role_repo.get_person_commercial_roles(
            name, birthdate=birthdate, birthyear=birthyear, include_all=include_all
        )
        orgnrs = list({r.orgnr for r in roles if r.orgnr})
        financials_map = await self.accounting_repo.get_latest_financials_batch(orgnrs)

        return [self._map_enriched_role(r, financials_map) for r in roles]

    @staticmethod
    def _map_enriched_role(r: models.Role, financials_map: dict[str, models.LatestFinancials]) -> PersonRoleResponse:
        """Map a single Role + company + financials → enriched response."""
        fin = financials_map.get(r.orgnr) if r.orgnr else None
        company = r.company

        return PersonRoleResponse(
            orgnr=r.orgnr or "",
            type_kode=r.type_kode or "UKJENT",
            type_beskrivelse=r.type_beskrivelse or "Ukjent rolle",
            enhet_navn=r.enhet_navn or (company.navn if company else None) or "Ukjent virksomhet",
            fratraadt=r.fratraadt if r.fratraadt is not None else False,
            rekkefoelge=r.rekkefoelge,
            foedselsdato=r.foedselsdato,
            # Company context
            organisasjonsform=company.organisasjonsform if company else None,
            antall_ansatte=company.antall_ansatte if company else None,
            naeringskode=company.naeringskode if company else None,
            stiftelsesdato=company.stiftelsesdato if company else None,
            konkurs=company.konkurs if company else False,
            under_avvikling=company.under_avvikling if company else False,
            # Latest financials
            latest_aar=fin.aar if fin else None,
            latest_salgsinntekter=fin.salgsinntekter if fin else None,
            latest_aarsresultat=fin.aarsresultat if fin else None,
            latest_driftsresultat=fin.driftsresultat if fin else None,
            latest_egenkapitalandel=fin.egenkapitalandel if fin else None,
        )

    async def get_connections(
        self,
        name: str,
        birthdate: date | None,
        birthyear: int | None,
        include_all: bool,
        limit: int = 25,
    ) -> list[PersonConnectionResponse]:
        """Find people connected via shared board memberships.

        GDPR: Converts foedselsdato → birth_year (int) for third parties.
        """
        raw = await self.role_repo.get_person_connections(
            name,
            birthdate=birthdate,
            birthyear=birthyear,
            include_all=include_all,
            limit=limit,
        )
        return [
            PersonConnectionResponse(
                name=c["name"],
                birth_year=c["foedselsdato"].year if c.get("foedselsdato") else None,
                shared_company_count=c["shared_company_count"],
                shared_companies=[SharedCompanyInfo(**sc) for sc in c["shared_companies"]],
            )
            for c in raw
        ]

    async def get_role_sparklines(
        self,
        name: str,
        birthdate: date | None,
        birthyear: int | None,
        include_all: bool,
        years: int = 5,
    ) -> list[CompanySparklineData]:
        """Fetch mini financial time-series for all companies a person has roles in."""
        roles = await self.role_repo.get_person_commercial_roles(
            name, birthdate=birthdate, birthyear=birthyear, include_all=include_all
        )
        orgnrs = list({r.orgnr for r in roles if r.orgnr})
        if not orgnrs:
            return []

        sparkline_map = await self.accounting_repo.get_sparkline_data_batch(orgnrs, years=years)

        return [
            CompanySparklineData(
                orgnr=orgnr,
                data_points=[SparklinePoint(**dp) for dp in points],
            )
            for orgnr, points in sparkline_map.items()
        ]

    async def find_network_path(
        self,
        person_a: tuple[str, date | None, int | None],
        person_b: tuple[str, date | None, int | None],
        max_depth: int = 3,
        include_all: bool = False,
    ) -> NetworkPathResponse:
        """BFS: Person A → Companies → People → Companies → ... → Person B.

        Batched BFS: exactly 2 SQL queries per level (batch company lookup +
        batch people lookup) instead of N+1 per-person queries.
        Frontier is capped at 500 persons per level to bound query size.

        Dedup uses full-date precision (name, date_str) to avoid merging the
        ~1% of persons who share a name and birth year but have different dates.
        Year-only input (from user) is handled via prefix matching at seed level.
        """
        a_name, a_birthdate, a_birthyear = person_a
        b_name, b_birthdate, b_birthyear = person_b

        b_name_upper = b_name.upper()
        max_frontier = 500

        def _pk(name: str, bd: date | None) -> tuple[str, str | None]:
            """Full-precision dedup key: (UPPER_NAME, date_iso_str | None)."""
            return (name.upper(), str(bd) if bd else None)

        def _lookup_orgnrs(
            cmap: dict[tuple[str, str | None], list[str]],
            name: str,
            bd: date | None,
            by: int | None,
        ) -> list[str]:
            """Look up orgnrs, falling back to year-prefix scan for year-only."""
            if bd:
                return cmap.get(_pk(name, bd), [])
            # Year-only: collect all keys matching name + year prefix
            name_upper = name.upper()
            year_prefix = str(by) if by else ""
            orgnrs: list[str] = []
            for (k_name, k_date), k_orgnrs in cmap.items():
                if k_name != name_upper:
                    continue
                if year_prefix and k_date and not k_date.startswith(year_prefix):
                    continue
                orgnrs.extend(k_orgnrs)
            return orgnrs

        visited: set[tuple[str, str | None]] = set()
        visited.add(_pk(a_name, a_birthdate))

        # BFS state: each frontier entry is (name, birthdate, birthyear, path_so_far)
        frontier: list[tuple[str, date | None, int | None, list[NetworkPathNode]]] = [
            (
                a_name,
                a_birthdate,
                a_birthyear,
                [
                    NetworkPathNode(
                        type="person",
                        name=a_name,
                        identifier=f"{a_name}|{a_birthdate or a_birthyear or ''}",
                        role=None,
                    ),
                ],
            )
        ]

        for _depth in range(max_depth):
            if not frontier:
                break

            if len(frontier) > max_frontier:
                frontier = frontier[:max_frontier]

            # Batch Step 1: get companies for ALL frontier persons in ONE query
            persons_for_query = [(name, bd, by) for name, bd, by, _ in frontier]
            company_map = await self.role_repo.get_companies_for_persons_batch(
                persons_for_query, include_all=include_all
            )

            all_orgnrs: set[str] = set()
            for orgnrs in company_map.values():
                all_orgnrs.update(orgnrs)

            if not all_orgnrs:
                break

            # Batch Step 2: get ALL people in ALL companies in ONE query
            all_people = await self.role_repo.get_people_for_companies(
                list(all_orgnrs), include_all=include_all, exclude_persons=visited
            )

            people_by_orgnr: dict[str, list[dict]] = {}
            for p in all_people:
                people_by_orgnr.setdefault(p["orgnr"], []).append(p)

            next_frontier: list[tuple[str, date | None, int | None, list[NetworkPathNode]]] = []
            seen_this_level: set[tuple[str, str | None]] = set()

            for person_name, person_bd, person_by, path in frontier:
                person_orgnrs = _lookup_orgnrs(company_map, person_name, person_bd, person_by)

                for orgnr in person_orgnrs:
                    for new_person in people_by_orgnr.get(orgnr, []):
                        pk = _pk(new_person["name"], new_person["foedselsdato"])
                        if pk in visited or pk in seen_this_level:
                            continue
                        seen_this_level.add(pk)
                        visited.add(pk)

                        new_path = [
                            *path,
                            NetworkPathNode(
                                type="company",
                                name=new_person["enhet_navn"],
                                identifier=orgnr,
                                role=new_person["role_beskrivelse"],
                            ),
                            NetworkPathNode(
                                type="person",
                                name=new_person["name"],
                                identifier=f"{new_person['name']}|{new_person['foedselsdato'] or ''}",
                                role=None,
                            ),
                        ]

                        # Check if we found Person B
                        if pk[0] == b_name_upper and (
                            (b_birthdate and new_person["foedselsdato"] and new_person["foedselsdato"] == b_birthdate)
                            or (
                                not b_birthdate
                                and b_birthyear
                                and new_person["foedselsdato"]
                                and new_person["foedselsdato"].year == b_birthyear
                            )
                            or (b_birthdate is None and b_birthyear is None)
                        ):
                            return NetworkPathResponse(
                                found=True,
                                depth=len(new_path) // 2,
                                path=new_path,
                            )

                        # All DB-sourced persons have full dates
                        next_frontier.append(
                            (
                                new_person["name"],
                                new_person["foedselsdato"],
                                new_person["foedselsdato"].year if new_person["foedselsdato"] else None,
                                new_path,
                            )
                        )

            frontier = next_frontier

        return NetworkPathResponse(found=False, depth=None, path=[])


def get_person_service(db: AsyncSession = Depends(get_db)) -> PersonService:
    """FastAPI dependency for PersonService. Follows get_seo_service pattern."""
    return PersonService(db)
