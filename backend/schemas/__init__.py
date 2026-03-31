"""Schemas package - Pydantic models for API request/response."""

from schemas.brreg import (
    BrregAdresse,
    BrregCompany,
    BrregFinancialStatement,
    BrregNaeringskode,
    BrregOrganisasjonsform,
    BrregRegnskapsperiode,
    BrregUpdateEntity,
    FetchResult,
    UpdateBatchResult,
)
from schemas.companies import (
    AccountingBase,
    AccountingWithKpis,
    CompanyBase,
    CompanyWithAccounting,
    FetchCompanyRequest,
    FetchCompanyResponse,
    IndustryCompaniesResponse,
    MapMarker,
    MarkersResponse,
    NaceSubclass,
    Naeringskode,
)
from schemas.county import (
    CountyListResponse,
    CountyPremiumResponse,
)
from schemas.industry import (
    IndustryPremiumResponse,
    SubclassStat,
)
from schemas.municipality import (
    MunicipalityListResponse,
    MunicipalityPremiumResponse,
)
from schemas.people import (
    PersonRoleResponse,
    PersonSearchResult,
)
from schemas.responses import (
    CompanyRoleResponse,
    ResponseMetadata,
    RolesWithMetadata,
    SubUnitResponse,
    SubUnitsWithMetadata,
)
from schemas.stats import (
    GeoAveragesResponse,
    GeoLevel,
    GeoMetric,
    GeoStatResponse,
    IndustryStatResponse,
    IndustryStatsDTO,
)

__all__ = [  # noqa: RUF022  -- grouped by category for readability
    # Brreg API schemas
    "BrregAdresse",
    "BrregCompany",
    "BrregFinancialStatement",
    "BrregNaeringskode",
    "BrregOrganisasjonsform",
    "BrregRegnskapsperiode",
    "BrregUpdateEntity",
    "FetchResult",
    "UpdateBatchResult",
    # Company schemas
    "AccountingBase",
    "AccountingWithKpis",
    "CompanyBase",
    "CompanyWithAccounting",
    "FetchCompanyRequest",
    "FetchCompanyResponse",
    "IndustryCompaniesResponse",
    "MapMarker",
    "MarkersResponse",
    "NaceSubclass",
    "Naeringskode",
    # County schemas
    "CountyListResponse",
    "CountyPremiumResponse",
    # Industry schemas
    "IndustryPremiumResponse",
    "SubclassStat",
    # Municipality schemas
    "MunicipalityListResponse",
    "MunicipalityPremiumResponse",
    # People schemas
    "PersonRoleResponse",
    "PersonSearchResult",
    # Response schemas
    "CompanyRoleResponse",
    "ResponseMetadata",
    "RolesWithMetadata",
    "SubUnitResponse",
    "SubUnitsWithMetadata",
    # Stats schemas
    "GeoAveragesResponse",
    "GeoLevel",
    "GeoMetric",
    "GeoStatResponse",
    "IndustryStatResponse",
    "IndustryStatsDTO",
]
