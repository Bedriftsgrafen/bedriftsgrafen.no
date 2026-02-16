"""Statistics-related Pydantic schemas for API request/response models."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ──────────────────────────────────────────────────────────────────────────────
# Shared type aliases — single source of truth for geographic stats typing
# ──────────────────────────────────────────────────────────────────────────────
GeoMetric = Literal["company_count", "new_last_year", "bankrupt_count", "total_employees"]
GeoLevel = Literal["county", "municipality"]


class IndustryStatsDTO(BaseModel):
    """DTO for aggregated industry statistics."""

    company_count: int = 0
    avg_revenue: float | None = None
    avg_profit: float | None = None
    avg_employees: float | None = None
    avg_operating_margin: float | None = None
    median_revenue: float | None = None


class IndustryStatResponse(BaseModel):
    """Industry statistics for a NACE division."""

    nace_division: str = Field(..., description="NACE division code (2 digits)")
    nace_name: str | None = Field(None, description="NACE division name")
    company_count: int
    bankrupt_count: int
    new_last_year: int
    bankruptcies_last_year: int = Field(0, description="Companies that went bankrupt in the last year")
    total_employees: int | None = None
    avg_employees: float | None = None
    total_revenue: float | None = None
    avg_revenue: float | None = None
    median_revenue: float | None = None
    total_profit: float | None = None
    avg_profit: float | None = None
    profitable_count: int | None = None
    avg_operating_margin: float | None = None

    model_config = ConfigDict(from_attributes=True)


class GeoStatResponse(BaseModel):
    """Geographic statistics for a region."""

    code: str = Field(..., description="Region code (county or municipality)")
    name: str = Field(..., description="Region name")
    value: int = Field(..., description="Metric value")
    population: int | None = Field(None, description="Population count")
    companies_per_capita: float | None = Field(None, description="Companies per 1000 inhabitants")
    lat: float | None = Field(None, description="Latitude")
    lng: float | None = Field(None, description="Longitude")

    model_config = ConfigDict(from_attributes=True)


class GeoAveragesResponse(BaseModel):
    """Average statistics for comparison."""

    national_avg: float = Field(..., description="National average")
    national_total: int = Field(..., description="National total")
    county_avg: float | None = Field(None, description="County average (when viewing municipalities)")
    county_total: int | None = Field(None, description="County total")
    county_name: str | None = Field(None, description="County name")
