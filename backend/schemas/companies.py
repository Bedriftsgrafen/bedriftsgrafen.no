"""Company-related Pydantic schemas for API request/response models.

Extracted from routers/v1/companies.py to follow separation of concerns.
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class Naeringskode(BaseModel):
    """NACE code with description."""

    kode: str
    beskrivelse: str


class CompanyBase(BaseModel):
    """Base company response model for list views."""

    orgnr: str
    navn: str | None = None
    parent_orgnr: str | None = None
    parent_navn: str | None = None
    organisasjonsform: str | None = None
    naeringskode: Naeringskode | str | None = None
    naeringskoder: list[Naeringskode | str] = []
    antall_ansatte: int | None = None
    stiftelsesdato: date | None = None
    hjemmeside: str | None = None
    is_subunit: bool = False

    @model_validator(mode="wrap")
    @classmethod
    def _pick_enriched_naeringskode(cls, values: Any, handler: Any) -> Any:
        """Use enriched NACE codes from service layer if available."""
        # When constructing from an ORM object, check for enriched values
        if not isinstance(values, dict) and hasattr(values, "__dict__"):
            enriched = values.__dict__.get("_enriched_naeringskode")
            if enriched is not None:
                values.__dict__["naeringskode"] = enriched
            enriched_list = values.__dict__.get("_enriched_naeringskoder")
            if enriched_list is not None:
                values.__dict__["naeringskoder"] = enriched_list
        return handler(values)

    # Contact info (from raw_data)
    telefon: str | None = None
    mobil: str | None = None
    epostadresse: str | None = None
    postadresse: dict[str, Any] | None = None
    forretningsadresse: dict[str, Any] | None = None

    # Status flags
    konkurs: bool | None = None
    konkursdato: date | None = None
    under_avvikling: bool | None = None
    under_tvangsavvikling: bool | None = None
    registrert_i_foretaksregisteret: bool | None = None
    registrert_i_mvaregisteret: bool | None = None
    registrert_i_frivillighetsregisteret: bool | None = None
    registrert_i_stiftelsesregisteret: bool | None = None
    registrert_i_partiregisteret: bool | None = None
    registreringsdato_enhetsregisteret: date | None = None
    registreringsdato_foretaksregisteret: date | None = None

    vedtektsfestet_formaal: str | None = None

    # Capital info (from raw_data)
    aksjekapital: float | None = None
    antall_aksjer: int | None = None
    er_i_konsern: bool | None = None
    siste_innsendte_aarsregnskap: str | None = None
    institusjonell_sektor: str | None = None

    latest_profit: float | None = None
    latest_revenue: float | None = None
    latest_operating_profit: float | None = None
    latest_operating_margin: float | None = None  # Operating margin as percentage
    latest_equity_ratio: float | None = None  # Equity ratio as decimal (0.0 - 1.0)

    # Timestamps
    updated_at: datetime | None = None  # From Brreg data
    last_polled_regnskap: date | None = None  # Last check for accounting
    geocoded_at: datetime | None = None  # Last geocoding
    latitude: float | None = None
    longitude: float | None = None

    model_config = ConfigDict(from_attributes=True)


class AccountingBase(BaseModel):
    """Base accounting response model."""

    id: int
    aar: int
    periode_fra: date | None = None  # Fiscal period start date
    periode_til: date | None = None  # Fiscal period end date
    source_id: str | None = None  # Regnskapsregisteret statement id
    journalnr: str | None = None  # Brreg journal number
    total_inntekt: float | None = None
    aarsresultat: float | None = None
    egenkapital: float | None = None
    gjeldsgrad: float | None = None
    driftsresultat: float | None = None
    salgsinntekter: float | None = None
    omloepsmidler: float | None = None
    kortsiktig_gjeld: float | None = None
    avskrivninger: float | None = None

    model_config = ConfigDict(from_attributes=True)


class AccountingWithKpis(AccountingBase):
    """Accounting with computed KPIs."""

    kpis: dict[str, Any] | None = None


class CompanyWithAccounting(CompanyBase):
    """Company with full accounting history."""

    regnskap: list[AccountingBase] = []


class FetchCompanyRequest(BaseModel):
    """Request to fetch company from Brreg API."""

    fetch_financials: bool = True


class FetchCompanyResponse(BaseModel):
    """Response from fetching company from Brreg API."""

    orgnr: str
    company_fetched: bool
    financials_fetched: int
    errors: list[str] = []


class IndustryCompaniesResponse(BaseModel):
    """Paginated response for industry companies endpoint."""

    items: list[CompanyBase]
    total: int
    page: int
    pages: int
    limit: int
    nace_code: str
    has_more: bool


class NaceSubclass(BaseModel):
    """A NACE subclass with company count and SSB name."""

    code: str
    name: str
    count: int


class MapMarker(BaseModel):
    """Minimal marker data for map display."""

    orgnr: str
    navn: str
    lat: float
    lng: float
    nace: str | None = None
    ansatte: int | None = None

    model_config = ConfigDict(from_attributes=True)


class MarkersResponse(BaseModel):
    """Response for markers with count."""

    markers: list[MapMarker]
    total: int
    truncated: bool = False  # True if more markers exist than returned
