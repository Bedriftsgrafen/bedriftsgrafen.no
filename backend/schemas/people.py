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


class PersonSearchResultDetailed(BaseModel):
    """Enriched person result for the search results page."""

    name: str = Field(..., description="Full name of the person")
    birthdate: date | None = Field(None, description="Birth date if available")
    role_count: int = Field(..., description="Total number of commercial roles held")
    active_role_count: int = Field(..., description="Number of non-resigned roles")
    top_roles: list[str] = Field(default_factory=list, description='Top role types, e.g. ["Daglig leder (3)"]')
    notable_companies: list[str] = Field(default_factory=list, description="1-2 notable company names")

    model_config = ConfigDict(from_attributes=True)


class PaginatedPersonSearch(BaseModel):
    """Paginated person search result set."""

    results: list[PersonSearchResultDetailed] = Field(..., description="List of person results")
    total_count: int = Field(..., description="Total number of matching people")
    query: str = Field(..., description="The search query that was executed")


class PersonRoleResponse(BaseModel):
    """A commercial role held by a person, enriched with company context and latest financials.

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

    # Company context (from eager-loaded Company model)
    organisasjonsform: str | None = Field(None, description="Legal form (e.g. AS, ASA, ENK)")
    antall_ansatte: int | None = Field(None, description="Number of employees")
    naeringskode: str | None = Field(None, description="NACE industry code (e.g. '62.010')")
    stiftelsesdato: date | None = Field(None, description="Company founding date")
    konkurs: bool = Field(False, description="Whether the company is bankrupt")
    under_avvikling: bool = Field(False, description="Whether the company is being liquidated")

    # Latest financials (from LatestFinancials materialized view)
    latest_aar: int | None = Field(None, description="Year of latest financial data")
    latest_salgsinntekter: float | None = Field(None, description="Latest revenue (NOK)")
    latest_aarsresultat: float | None = Field(None, description="Latest annual profit/loss (NOK)")
    latest_driftsresultat: float | None = Field(None, description="Latest operating profit (NOK)")
    latest_egenkapitalandel: float | None = Field(None, description="Latest equity ratio (%)")

    model_config = ConfigDict(from_attributes=True)


class SharedCompanyInfo(BaseModel):
    """A company shared between two people."""

    orgnr: str = Field(..., description="Company organization number")
    navn: str = Field(..., description="Company name")
    person_role: str = Field(..., description="Role the target person holds")
    connection_role: str = Field(..., description="Role the connected person holds")


class PersonConnectionResponse(BaseModel):
    """A person connected via shared board/role memberships.

    GDPR: birth_year (int) instead of full birthdate for third parties
    to comply with data minimization principles.
    """

    name: str = Field(..., description="Connected person's full name")
    birth_year: int | None = Field(None, description="Birth year only (GDPR data minimization)")
    shared_company_count: int = Field(..., description="Number of companies shared")
    shared_companies: list[SharedCompanyInfo] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
