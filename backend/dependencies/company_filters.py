from datetime import date

from fastapi import Query

from services.dtos import CompanyFilterDTO, RangeFilter


def _build_range_filter(min_val: float | None, max_val: float | None) -> RangeFilter | None:
    """Helper to build RangeFilter only if at least one value is provided"""
    return RangeFilter(min=min_val, max=max_val) if (min_val is not None or max_val is not None) else None


class CompanyQueryParams:
    """
    FastAPI Dependency for common company query parameters.
    Extracts all filter params from query string and converts to CompanyFilterDTO.

    Note: Using __init__ with Query() defaults for proper FastAPI query parameter extraction.
    This is the standard pattern for complex query parameter dependencies.
    """

    def __init__(
        self,
        # Text search
        name: str | None = Query(None, description="Search by company name or org number"),
        # Basic filters - list params need Query() for proper parsing
        organisasjonsform: list[str] | None = Query(None, description="Filter by organization form codes"),
        naeringskode: str | None = Query(None, max_length=12, description="NACE industry code (max 12 chars)"),
        municipality: str | None = Query(None, description="Filter by municipality (kommune) name"),
        municipality_code: str | None = Query(
            None, min_length=4, max_length=4, pattern=r"^\d{4}$", description="Filter by 4-digit municipality code"
        ),
        county: str | None = Query(
            None, description="Filter by county (fylke) - 2-digit county code (e.g., '18' for Nordland)"
        ),
        # Employee limits
        min_employees: int | None = Query(None, ge=0, description="Minimum number of employees"),
        max_employees: int | None = Query(None, ge=0, description="Maximum number of employees"),
        # Date filters
        founded_from: date | None = Query(None, description="Minimum founding date"),
        founded_to: date | None = Query(None, description="Maximum founding date"),
        bankrupt_from: date | None = Query(None, description="Minimum bankruptcy date"),
        bankrupt_to: date | None = Query(None, description="Maximum bankruptcy date"),
        # Status flags
        is_bankrupt: bool | None = Query(None, description="Filter by bankruptcy status"),
        in_liquidation: bool | None = Query(None, description="Filter by liquidation status"),
        in_forced_liquidation: bool | None = Query(None, description="Filter by forced liquidation status"),
        has_accounting: bool | None = Query(None, description="Filter by existence of accounting data"),
        # Financial Numeric filters (split into min/max for query params)
        min_revenue: float | None = Query(None, description="Minimum revenue"),
        max_revenue: float | None = Query(None, description="Maximum revenue"),
        min_profit: float | None = Query(None, description="Minimum profit"),
        max_profit: float | None = Query(None, description="Maximum profit"),
        min_equity: float | None = Query(None, description="Minimum equity"),
        max_equity: float | None = Query(None, description="Maximum equity"),
        min_operating_profit: float | None = Query(None, description="Minimum operating profit"),
        max_operating_profit: float | None = Query(None, description="Maximum operating profit"),
        min_liquidity_ratio: float | None = Query(None, description="Minimum liquidity ratio"),
        max_liquidity_ratio: float | None = Query(None, description="Maximum liquidity ratio"),
        min_equity_ratio: float | None = Query(None, description="Minimum equity ratio"),
        max_equity_ratio: float | None = Query(None, description="Maximum equity ratio"),
        # Exclusion - list param needs Query() for proper parsing
        exclude_org_form: list[str] | None = Query(None, description="Exclude specific organization forms (e.g., KBO)"),
    ):
        self.name = name
        self.organisasjonsform = organisasjonsform
        self.naeringskode = naeringskode
        self.municipality = municipality
        self.municipality_code = municipality_code
        self.county = county
        self.min_employees = min_employees
        self.max_employees = max_employees
        self.founded_from = founded_from
        self.founded_to = founded_to
        self.bankrupt_from = bankrupt_from
        self.bankrupt_to = bankrupt_to
        self.is_bankrupt = is_bankrupt
        self.in_liquidation = in_liquidation
        self.in_forced_liquidation = in_forced_liquidation
        self.has_accounting = has_accounting
        self.min_revenue = min_revenue
        self.max_revenue = max_revenue
        self.min_profit = min_profit
        self.max_profit = max_profit
        self.min_equity = min_equity
        self.max_equity = max_equity
        self.min_operating_profit = min_operating_profit
        self.max_operating_profit = max_operating_profit
        self.min_liquidity_ratio = min_liquidity_ratio
        self.max_liquidity_ratio = max_liquidity_ratio
        self.min_equity_ratio = min_equity_ratio
        self.max_equity_ratio = max_equity_ratio
        self.exclude_org_form = exclude_org_form

    def to_dto(
        self, skip: int = 0, limit: int = 100, sort_by: str = "navn", sort_order: str = "asc"
    ) -> CompanyFilterDTO:
        """Convert query params to Service DTO"""
        return CompanyFilterDTO(
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order,
            name=self.name,
            organisasjonsform=self.organisasjonsform,
            naeringskode=self.naeringskode,
            municipality=self.municipality,
            municipality_code=self.municipality_code,
            county=self.county,
            min_employees=self.min_employees,
            max_employees=self.max_employees,
            founded_from=self.founded_from,
            founded_to=self.founded_to,
            bankrupt_from=self.bankrupt_from,
            bankrupt_to=self.bankrupt_to,
            is_bankrupt=self.is_bankrupt,
            in_liquidation=self.in_liquidation,
            in_forced_liquidation=self.in_forced_liquidation,
            has_accounting=self.has_accounting,
            exclude_org_form=self.exclude_org_form,
            revenue_range=_build_range_filter(self.min_revenue, self.max_revenue),
            profit_range=_build_range_filter(self.min_profit, self.max_profit),
            equity_range=_build_range_filter(self.min_equity, self.max_equity),
            operating_profit_range=_build_range_filter(self.min_operating_profit, self.max_operating_profit),
            liquidity_ratio_range=_build_range_filter(self.min_liquidity_ratio, self.max_liquidity_ratio),
            equity_ratio_range=_build_range_filter(self.min_equity_ratio, self.max_equity_ratio),
        )
