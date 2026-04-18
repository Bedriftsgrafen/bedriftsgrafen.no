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
from schemas.people import PersonConnectionResponse, PersonRoleResponse, SharedCompanyInfo

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


def get_person_service(db: AsyncSession = Depends(get_db)) -> PersonService:
    """FastAPI dependency for PersonService. Follows get_seo_service pattern."""
    return PersonService(db)
