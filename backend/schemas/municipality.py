"""Municipality-related Pydantic schemas for Premium Dashboards."""

from pydantic import BaseModel, ConfigDict, Field
from .companies import CompanyBase

class TrendPoint(BaseModel):
    """A single data point in a time-series trend."""
    label: str  # e.g., "Jan 23"
    value: float | int

class SectorStat(BaseModel):
    """Industry sector statistics for a municipality."""
    nace_division: str
    nace_name: str
    company_count: int
    total_employees: int | None = None
    percentage_of_total: float | None = None

class RankingInfo(BaseModel):
    """Rank position relative to total entities in group."""
    rank: int
    out_of: int

class MunicipalityPremiumResponse(BaseModel):
    """Consolidated premium response for a municipality dashboard."""
    code: str
    name: str
    county_code: str
    county_name: str
    
    # Coordinates for mapping
    lat: float | None = None
    lng: float | None = None
    
    # SSB Population Data
    population: int
    population_growth_1y: float | None = Field(None, description="Percentage growth last year")
    
    # Business Metrics
    company_count: int
    business_density: float | None = Field(None, description="Companies per 1000 residents")
    business_density_national_avg: float | None = None
    
    # Performance Stats
    total_revenue: float | None = None
    avg_profit_margin: float | None = None
    
    # Trends
    establishment_trend: list[TrendPoint] = []
    
    # Categorical Data
    top_sectors: list[SectorStat] = []
    top_companies: list[CompanyBase] = []
    newest_companies: list[CompanyBase] = []
    latest_bankruptcies: list[CompanyBase] = []
    
    # Rankings
    ranking_in_county_density: RankingInfo | None = None
    ranking_in_county_revenue: RankingInfo | None = None
    
    model_config = ConfigDict(from_attributes=True)

class MunicipalityListResponse(BaseModel):
    """Lightweight response for sitemaps and lists."""
    code: str
    name: str
    slug: str
    company_count: int
    population: int | None = None
    lat: float | None = None
    lng: float | None = None

    model_config = ConfigDict(from_attributes=True)
