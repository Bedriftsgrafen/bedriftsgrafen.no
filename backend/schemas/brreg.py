"""Pydantic schemas for Brønnøysund API responses.

These models validate external API data at the boundary before processing.
Uses strict validation to catch data integrity issues early.
"""

from datetime import date
from typing import Any

from pydantic import BaseModel, Field, field_validator


class BrregUpdateEntity(BaseModel):
    """Schema for a single entity in the updates (oppdateringer) endpoint.

    Validates the minimal fields required to process an update.
    """

    organisasjonsnummer: str = Field(..., min_length=9, max_length=9)
    oppdateringsid: int
    endringstype: str = Field(..., pattern=r"^(Ny|Endring|Sletting|Ukjent)$")
    dato: str  # ISO 8601 datetime string

    @field_validator("organisasjonsnummer")
    @classmethod
    def validate_orgnr(cls, v: str) -> str:
        """Ensure orgnr is exactly 9 digits."""
        if not v.isdigit():
            raise ValueError("organisasjonsnummer must contain only digits")
        return v


class BrregNaeringskode(BaseModel):
    """Schema for naeringskode (NACE code) in company data."""

    kode: str | None = None
    beskrivelse: str | None = None


class BrregOrganisasjonsform(BaseModel):
    """Schema for organisasjonsform (company type) in company data."""

    kode: str | None = None
    beskrivelse: str | None = None


class BrregAdresse(BaseModel):
    """Schema for address data."""

    land: str | None = None
    landkode: str | None = None
    postnummer: str | None = None
    poststed: str | None = None
    adresse: list[str] | None = None
    kommune: str | None = None
    kommunenummer: str | None = None


class BrregCompany(BaseModel):
    """Schema for company data from Enhetsregisteret.

    Uses permissive validation (most fields optional) since Brreg data
    can be incomplete for older/inactive companies.
    """

    organisasjonsnummer: str = Field(..., min_length=9, max_length=9)
    navn: str | None = None
    organisasjonsform: BrregOrganisasjonsform | None = None
    naeringskode1: BrregNaeringskode | None = None
    naeringskode2: BrregNaeringskode | None = None
    naeringskode3: BrregNaeringskode | None = None
    antallAnsatte: int | None = None
    stiftelsesdato: str | None = None  # ISO date string
    konkurs: bool = False
    konkursdato: str | None = None
    underAvvikling: bool = False
    underTvangsavvikling: bool = False
    vedtektsfestetFormaal: list[str] | str | None = None
    hjemmeside: str | None = None
    postadresse: BrregAdresse | None = None
    forretningsadresse: BrregAdresse | None = None

    model_config = {"extra": "allow"}  # Allow unknown fields from API

    @field_validator("organisasjonsnummer")
    @classmethod
    def validate_orgnr(cls, v: str) -> str:
        """Ensure orgnr is exactly 9 digits."""
        if not v.isdigit():
            raise ValueError("organisasjonsnummer must contain only digits")
        return v


class BrregRegnskapsperiode(BaseModel):
    """Schema for accounting period in financial data."""

    fraDato: str | None = None  # ISO date string
    tilDato: str | None = None  # ISO date string


class BrregFinancialStatement(BaseModel):
    """Schema for financial statement from Regnskapsregisteret.

    Uses permissive validation since structure varies by company type.
    """

    id: int | None = None
    journalnr: str | None = None
    regnskapsperiode: BrregRegnskapsperiode | None = None
    resultatregnskapResultat: dict[str, Any] | None = None
    eiendeler: dict[str, Any] | None = None
    egenkapitalGjeld: dict[str, Any] | None = None

    model_config = {"extra": "allow"}


# --- Result containers for phased processing ---


class FetchResult(BaseModel):
    """Result of fetching a single company's data.

    Used to collect API results before database persistence phase.
    """

    orgnr: str
    success: bool
    company_data: dict[str, Any] | None = None
    financial_statements: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None
    is_new: bool = False  # Whether this is a newly discovered company


class UpdateBatchResult(BaseModel):
    """Aggregated result for a batch of updates.

    Provides structured metrics for monitoring and logging.
    """

    since_date: date
    since_iso: str
    companies_processed: int = 0
    companies_updated: int = 0
    companies_created: int = 0
    companies_skipped: int = 0  # Deletions or invalid orgnr
    financials_updated: int = 0
    api_errors: int = 0
    db_errors: int = 0
    errors: list[str] = Field(default_factory=list)
    latest_oppdateringsid: int | None = None
    pages_fetched: int = 0
