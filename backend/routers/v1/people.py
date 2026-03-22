"""Router for Person Search and Role History.

Implements legally compliant person-role mapping per Enhetsregisterloven § 22.
Only commercial roles (næringsvirksomhet) are returned.
"""

import logging
import re
from datetime import date

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from repositories.role_repository import RoleRepository
from schemas.people import PersonRoleResponse, PersonSearchResult
from utils.auth import is_admin

logger = logging.getLogger(__name__)

router: APIRouter = APIRouter(prefix="/v1/people", tags=["people"])


@router.get("/search", response_model=list[PersonSearchResult])
async def search_people(
    request: Request,
    q: str = Query(..., min_length=3, description="Search query (min 3 characters)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results to return"),
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    db: AsyncSession = Depends(get_db),
) -> list[PersonSearchResult]:
    """
    Search for people across all company roles.

    Returns unique people identified by name + birthdate combination,
    sorted by the number of roles held (most active first).
    """
    role_repo = RoleRepository(db)
    results = await role_repo.search_people(q, limit=limit, include_all=is_admin(x_admin_key))
    return [PersonSearchResult(**r) for r in results]


@router.get("/roles", response_model=list[PersonRoleResponse])
async def get_person_roles(
    request: Request,
    name: str = Query(..., description="Person's full name"),
    birthdate: str | None = Query(None, description="Birth date or year for disambiguation"),
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    db: AsyncSession = Depends(get_db),
) -> list[PersonRoleResponse]:
    """
    Fetch all LEGALLY ALLOWED roles for a person.

    Only includes commercial entities (næringsvirksomhet) as per Enhetsregisterloven § 22.
    Roles in voluntary organizations, housing cooperatives, and other non-commercial
    entities are excluded to comply with Norwegian privacy regulations.

    The birthdate param accepts:
      - "1996"         → year-only lookup (EXTRACT)
      - "1996-03-12"   → exact date match
      - None / omitted → no birthdate filter
    """
    role_repo = RoleRepository(db)
    admin = is_admin(x_admin_key)

    # Parse birthdate param: year-only, full ISO date, or None
    parsed_date: date | None = None
    parsed_year: int | None = None

    if birthdate and birthdate not in ("unknown", "none"):
        if re.fullmatch(r"\d{4}", birthdate):
            parsed_year = int(birthdate)
        elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", birthdate):
            parsed_date = date.fromisoformat(birthdate)

    roles = await role_repo.get_person_commercial_roles(
        name, birthdate=parsed_date, birthyear=parsed_year, include_all=admin
    )

    return [
        PersonRoleResponse(
            orgnr=r.orgnr or "",
            type_kode=r.type_kode or "UKJENT",
            type_beskrivelse=r.type_beskrivelse or "Ukjent rolle",
            enhet_navn=r.enhet_navn or (r.company.navn if r.company else None) or "Ukjent virksomhet",
            fratraadt=r.fratraadt if r.fratraadt is not None else False,
            rekkefoelge=r.rekkefoelge,
            foedselsdato=r.foedselsdato,
        )
        for r in roles
    ]
