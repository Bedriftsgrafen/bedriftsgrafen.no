"""Router for Person Search and Role History.

Implements legally compliant person-role mapping per Enhetsregisterloven § 22.
Only commercial roles (næringsvirksomhet) are returned.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from repositories.role_repository import RoleRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/people", tags=["people"])


class PersonSearchResult(BaseModel):
    """A unique person found in the roles database."""

    name: str = Field(..., description="Full name of the person")
    birthdate: date | None = Field(None, description="Birth date if available")
    role_count: int = Field(..., description="Number of commercial roles held")

    model_config = {"from_attributes": True}


class RoleResponse(BaseModel):
    """A commercial role held by a person."""

    orgnr: str = Field(..., description="Organization number")
    type_kode: str = Field(..., description="Role type code (e.g., DAGL, STYR)")
    type_beskrivelse: str = Field(..., description="Human-readable role description")
    enhet_navn: str = Field(..., description="Company name")
    fratraadt: bool = Field(..., description="Whether the person has resigned from this role")
    rekkefoelge: int | None = Field(None, description="Role sequence/priority")

    model_config = {"from_attributes": True}


@router.get("/search", response_model=list[PersonSearchResult])
async def search_people(
    request: Request,
    q: str = Query(..., min_length=3, description="Search query (min 3 characters)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results to return"),
    db: AsyncSession = Depends(get_db),
) -> list[PersonSearchResult]:
    """
    Search for people across all company roles.

    Returns unique people identified by name + birthdate combination,
    sorted by the number of roles held (most active first).
    """
    role_repo = RoleRepository(db)
    results = await role_repo.search_people(q, limit=limit)
    return [PersonSearchResult(**r) for r in results]


@router.get("/roles", response_model=list[RoleResponse])
async def get_person_roles(
    request: Request,
    name: str = Query(..., description="Person's full name"),
    birthdate: date | None = Query(None, description="Birth date for disambiguation"),
    db: AsyncSession = Depends(get_db),
) -> list[RoleResponse]:
    """
    Fetch all LEGALLY ALLOWED roles for a person.

    Only includes commercial entities (næringsvirksomhet) as per Enhetsregisterloven § 22.
    Roles in voluntary organizations, housing cooperatives, and other non-commercial
    entities are excluded to comply with Norwegian privacy regulations.
    """
    role_repo = RoleRepository(db)
    roles = await role_repo.get_person_commercial_roles(name, birthdate)

    return [
        RoleResponse(
            orgnr=r.orgnr or "",
            type_kode=r.type_kode or "UKJENT",
            type_beskrivelse=r.type_beskrivelse or "Ukjent rolle",
            enhet_navn=r.enhet_navn or (r.company.navn if r.company else None) or "Ukjent virksomhet",
            fratraadt=r.fratraadt if r.fratraadt is not None else False,
            rekkefoelge=r.rekkefoelge,
        )
        for r in roles
    ]
