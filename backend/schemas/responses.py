"""Shared API response models.

Moved from services/response_models.py to follow separation of concerns:
response models are presentation-layer concerns, not service-layer.
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from schemas.companies import Naeringskode


class SubUnitResponse(BaseModel):
    """Response model for subunit (underenhet) data"""

    orgnr: str
    navn: str | None = None
    organisasjonsform: str | None = None
    beliggenhetsadresse: dict[str, Any] | None = None
    postadresse: dict[str, Any] | None = None
    antall_ansatte: int | None = 0
    naeringskode: Naeringskode | str | None = None
    stiftelsesdato: date | None = None

    model_config = ConfigDict(from_attributes=True)


class ResponseMetadata(BaseModel):
    """Metadata about the response - when data was last updated, etc"""

    last_updated: datetime | None = None
    source: str | None = None  # 'cache', 'api', or 'database'
    fetched_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SubUnitsWithMetadata(BaseModel):
    """Subunits response with metadata about freshness"""

    data: list[SubUnitResponse]
    total: int
    metadata: ResponseMetadata | None = None


class CompanyRoleResponse(BaseModel):
    """Response model for company role data (roles belonging to a company).

    Renamed from RoleResponse to avoid collision with PersonRoleResponse.
    """

    id: int | None = None
    type_kode: str | None = None
    type_beskrivelse: str | None = None
    person_navn: str | None = None
    foedselsdato: date | None = None
    enhet_orgnr: str | None = None
    enhet_navn: str | None = None
    fratraadt: bool = False
    rekkefoelge: int | None = None

    model_config = ConfigDict(from_attributes=True)


class RolesWithMetadata(BaseModel):
    """Roles response with metadata about freshness"""

    data: list[CompanyRoleResponse]
    total: int
    metadata: ResponseMetadata | None = None
