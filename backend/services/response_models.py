"""Data Transfer Objects for API responses

Shared response models to avoid duplication across router versions.
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class Naeringskode(BaseModel):
    kode: str
    beskrivelse: str


class SubUnitResponse(BaseModel):
    """Response model for subunit (underenhet) data"""

    orgnr: str
    navn: str | None = None
    organisasjonsform: str | None = None
    beliggenhetsadresse: dict[str, Any] | None = None
    postadresse: dict[str, Any] | None = None
    antall_ansatte: int | None = 0
    naeringskode: str | Naeringskode | None = None
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


class RoleResponse(BaseModel):
    """Response model for company role data"""

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

    data: list[RoleResponse]
    total: int
    metadata: ResponseMetadata | None = None
