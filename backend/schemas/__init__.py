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
    NaceSubclass,
    Naeringskode,
)

from schemas.stats import (
    GeoAveragesResponse,
    GeoLevel,
    GeoMetric,
    GeoStatResponse,
    IndustryStatResponse,
    IndustryStatsDTO,
)

from schemas.municipality import (
    MunicipalityListResponse,
    MunicipalityPremiumResponse,
)

__all__ = [
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
    "Naeringskode",
    "CompanyBase",
    "AccountingBase",
    "AccountingWithKpis",
    "CompanyWithAccounting",
    "FetchCompanyRequest",
    "FetchCompanyResponse",
    "IndustryCompaniesResponse",
    "NaceSubclass",
    # Stats schemas
    "GeoAveragesResponse",
    "GeoLevel",
    "GeoMetric",
    "GeoStatResponse",
    "IndustryStatResponse",
    "IndustryStatsDTO",
    # Municipality schemas
    "MunicipalityPremiumResponse",
    "MunicipalityListResponse",
]
