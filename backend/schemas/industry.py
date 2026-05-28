"""Industry-related Pydantic schemas for Premium Dashboards."""

from pydantic import BaseModel, ConfigDict, Field

from .companies import CompanyBase
from .municipality import RankingInfo, SectorStat, TrendPoint


class SubclassStat(BaseModel):
    """Statistics for a NACE subclass within a division."""

    nace_code: str = Field(..., description="5-digit NACE subclass code (e.g. 62.010)")
    nace_name: str | None = None
    company_count: int = 0
    total_employees: int | None = None
    avg_revenue: float | None = None
    avg_operating_margin: float | None = None

    model_config = ConfigDict(from_attributes=True)


class IndustryPremiumResponse(BaseModel):
    """Consolidated premium response for an industry dashboard page."""

    nace_division: str = Field(..., description="2-digit NACE division code")
    nace_name: str | None = None
    nace_section: str | None = Field(None, description="Parent section letter (A-V)")
    nace_section_name: str | None = None

    # Core metrics
    company_count: int = 0
    total_employees: int | None = None
    avg_employees: float | None = None
    total_revenue: float | None = None
    avg_revenue: float | None = None
    median_revenue: float | None = None
    total_profit: float | None = None
    avg_profit: float | None = None
    profitable_count: int | None = None
    avg_operating_margin: float | None = None

    # Activity
    new_last_year: int = 0
    bankruptcies_last_year: int = 0
    bankrupt_count: int = 0

    # Trends
    establishment_trend: list[TrendPoint] = []
    bankrupt_trend: list[TrendPoint] = []

    # Subclass breakdown
    subclasses: list[SubclassStat] = []

    # Geographic distribution (top counties)
    top_counties: list[SectorStat] = []

    # Company lists
    top_companies: list[CompanyBase] = []
    newest_companies: list[CompanyBase] = []
    latest_bankruptcies: list[CompanyBase] = []

    # Rankings vs other industries
    ranking_by_revenue: RankingInfo | None = None
    ranking_by_companies: RankingInfo | None = None
    ranking_by_employees: RankingInfo | None = None

    model_config = ConfigDict(from_attributes=True)
