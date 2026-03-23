"""County-related Pydantic schemas for Premium Dashboards."""

from pydantic import BaseModel, ConfigDict, Field

from .companies import CompanyBase
from .municipality import RankingInfo, SectorStat, TrendPoint


class MunicipalitySummary(BaseModel):
    """Lightweight municipality info for county drill-down navigation."""

    code: str
    name: str
    company_count: int
    population: int | None = None

    model_config = ConfigDict(from_attributes=True)


class CountyPremiumResponse(BaseModel):
    """Consolidated premium response for a county dashboard."""

    code: str
    name: str

    # Coordinates for mapping (centroid)
    lat: float | None = None
    lng: float | None = None

    # SSB Population Data (aggregated)
    population: int
    population_growth_1y: float | None = Field(None, description="Percentage growth last year")

    # Business Metrics (aggregated from municipalities)
    company_count: int
    municipality_count: int
    business_density: float | None = Field(None, description="Companies per 1000 residents")
    business_density_national_avg: float | None = None

    # Performance Stats (aggregated)
    total_revenue: float | None = None
    avg_profit_margin: float | None = None

    # Trends
    establishment_trend: list[TrendPoint] = []
    bankrupt_trend: list[TrendPoint] = []

    # Categorical Data
    top_sectors: list[SectorStat] = []
    top_companies: list[CompanyBase] = []
    newest_companies: list[CompanyBase] = []
    latest_bankruptcies: list[CompanyBase] = []

    # Rankings
    ranking_national_density: RankingInfo | None = None
    ranking_national_revenue: RankingInfo | None = None
    ranking_national_population: RankingInfo | None = None

    # Drill-down navigation
    municipalities: list[MunicipalitySummary] = []

    model_config = ConfigDict(from_attributes=True)


class CountyListResponse(BaseModel):
    """Lightweight response for county index page and sitemaps."""

    code: str
    name: str
    company_count: int
    municipality_count: int
    population: int | None = None
    lat: float | None = None
    lng: float | None = None

    model_config = ConfigDict(from_attributes=True)
