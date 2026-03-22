"""Person/people-related Pydantic schemas for API request/response models.

Moved from routers/v1/people.py to follow separation of concerns.
"""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class PersonSearchResult(BaseModel):
    """A unique person found in the roles database."""

    name: str = Field(..., description="Full name of the person")
    birthdate: date | None = Field(None, description="Birth date if available")
    role_count: int = Field(..., description="Number of commercial roles held")

    model_config = ConfigDict(from_attributes=True)


class PersonRoleResponse(BaseModel):
    """A commercial role held by a person.

    Renamed from RoleResponse (in people router) to avoid collision with
    CompanyRoleResponse (roles belonging to a company).
    """

    orgnr: str = Field(..., description="Organization number")
    type_kode: str = Field(..., description="Role type code (e.g., DAGL, STYR)")
    type_beskrivelse: str = Field(..., description="Human-readable role description")
    enhet_navn: str = Field(..., description="Company name")
    fratraadt: bool = Field(..., description="Whether the person has resigned from this role")
    rekkefoelge: int | None = Field(None, description="Role sequence/priority")
    foedselsdato: date | None = Field(None, description="Birth date for disambiguation (year-only URLs)")

    model_config = ConfigDict(from_attributes=True)
