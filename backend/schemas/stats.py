"""Statistics-related Pydantic schemas for API request/response models."""

from pydantic import BaseModel, Field


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

    class Config:
        from_attributes = True


class GeoStatResponse(BaseModel):
    """Geographic statistics for a region."""

    code: str = Field(..., description="Region code (county or municipality)")
    name: str = Field(..., description="Region name")
    value: int = Field(..., description="Metric value")
    population: int | None = Field(None, description="Population count")
    companies_per_capita: float | None = Field(None, description="Companies per 1000 inhabitants")

    class Config:
        from_attributes = True


class GeoAveragesResponse(BaseModel):
    """Average statistics for comparison."""

    national_avg: float = Field(..., description="National average")
    national_total: int = Field(..., description="National total")
    county_avg: float | None = Field(None, description="County average (when viewing municipalities)")
    county_total: int | None = Field(None, description="County total")
    county_name: str | None = Field(None, description="County name")
