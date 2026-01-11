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
]
