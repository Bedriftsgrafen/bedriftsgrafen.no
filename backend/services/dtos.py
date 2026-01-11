"""Data Transfer Objects for service layer.

DTOs provide type-safe input validation and encapsulation for complex service methods.
"""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RangeFilter(BaseModel):
    """Generic range filter for numeric values"""

    model_config = ConfigDict(frozen=True)  # Immutable after creation

    min: float | None = Field(None, description="Minimum value (inclusive)")
    max: float | None = Field(None, description="Maximum value (inclusive)")

    @model_validator(mode="after")
    def validate_range(self):
        """Ensure min <= max when both are provided"""
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError(f"min ({self.min}) cannot be greater than max ({self.max})")
        return self


class IndustryStatsDTO(BaseModel):
    """DTO for aggregated industry statistics."""
    company_count: int = 0
    avg_revenue: float | None = None
    avg_profit: float | None = None
    avg_employees: float | None = None
    avg_operating_margin: float | None = None
    median_revenue: float | None = None


class CompanyFilterDTO(BaseModel):
    """Input DTO for filtering companies

    Encapsulates all filter parameters for company queries with validation.
    Used by CompanyService.get_companies() to reduce parameter complexity.
    """

    # Pagination
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(100, ge=1, le=1000, description="Maximum records to return")

    # Text search
    name: str | None = Field(None, description="Search by company name or organization number")

    # Basic filters
    organisasjonsform: list[str] | None = Field(None, description="Filter by organization forms (AS, ASA, etc.)")
    naeringskode: str | None = Field(None, description="Filter by industry code (NACE)")
    municipality: str | None = Field(None, description="Filter by municipality (kommune)")
    county: str | None = Field(None, description="Filter by county (fylke) - uses 2-digit code prefix")

    # Employee range
    min_employees: int | None = Field(None, ge=0, description="Minimum number of employees")
    max_employees: int | None = Field(None, ge=0, description="Maximum number of employees")

    # Date range
    founded_from: date | None = Field(None, description="Minimum founding date")
    founded_to: date | None = Field(None, description="Maximum founding date")

    bankrupt_from: date | None = Field(None, description="Minimum bankruptcy date")
    bankrupt_to: date | None = Field(None, description="Maximum bankruptcy date")

    # Status flags
    is_bankrupt: bool | None = Field(None, description="Filter by bankruptcy status")
    in_liquidation: bool | None = Field(None, description="Filter by liquidation status")
    in_forced_liquidation: bool | None = Field(None, description="Filter by forced liquidation status")
    has_accounting: bool | None = Field(None, description="Filter by existence of accounting data")

    # Financial filters (grouped as ranges)
    revenue_range: RangeFilter | None = Field(None, description="Revenue range filter")
    profit_range: RangeFilter | None = Field(None, description="Profit range filter")
    equity_range: RangeFilter | None = Field(None, description="Equity range filter")
    operating_profit_range: RangeFilter | None = Field(None, description="Operating profit range filter")
    liquidity_ratio_range: RangeFilter | None = Field(None, description="Liquidity ratio range filter")
    equity_ratio_range: RangeFilter | None = Field(None, description="Equity ratio range filter")

    # Exclusion filters
    exclude_org_form: list[str] | None = Field(
        None, description="Exclude specific organization forms (e.g., KBO for konkursbo)"
    )

    # Sorting
    sort_by: str = Field(
        "navn",
        pattern="^(navn|orgnr|organisasjonsform|antall_ansatte|stiftelsesdato|konkursdato|naeringskode|revenue|profit|operating_profit|operating_margin|kommune)$",
        description="Field to sort by",
    )
    sort_order: str = Field("asc", pattern="^(asc|desc)$", description="Sort order (ascending or descending)")

    @model_validator(mode="after")
    def validate_employee_range(self):
        """Ensure min_employees <= max_employees when both are provided"""
        if (
            self.min_employees is not None
            and self.max_employees is not None
            and self.min_employees > self.max_employees
        ):
            raise ValueError(
                f"min_employees ({self.min_employees}) cannot be greater than max_employees ({self.max_employees})"
            )
        return self

    @model_validator(mode="after")
    def validate_founded_date_range(self):
        """Ensure founded_from <= founded_to when both are provided"""
        if self.founded_from is not None and self.founded_to is not None and self.founded_from > self.founded_to:
            raise ValueError(f"founded_from ({self.founded_from}) cannot be after founded_to ({self.founded_to})")
        return self

    def _unpack_range_filters(self, params: dict) -> None:
        """Unpack range filters into individual min/max parameters (in-place)

        Args:
            params: Dictionary to add unpacked range parameters to
        """
        range_mappings = [
            ("revenue", self.revenue_range),
            ("profit", self.profit_range),
            ("equity", self.equity_range),
            ("operating_profit", self.operating_profit_range),
            ("liquidity_ratio", self.liquidity_ratio_range),
            ("equity_ratio", self.equity_ratio_range),
        ]

        for field_name, range_filter in range_mappings:
            params[f"min_{field_name}"] = range_filter.min if range_filter else None
            params[f"max_{field_name}"] = range_filter.max if range_filter else None

    def to_repository_params(self) -> dict:
        """Convert DTO to repository method parameters

        Unpacks grouped range filters into individual min/max parameters
        for backward compatibility with existing repository interface.

        Returns:
            Dictionary of parameters for CompanyRepository.get_all()
        """
        params = {
            "skip": self.skip,
            "limit": self.limit,
            "name": self.name,
            "organisasjonsform": self.organisasjonsform,
            "naeringskode": self.naeringskode,
            "municipality": self.municipality,
            "county": self.county,
            "min_employees": self.min_employees,
            "max_employees": self.max_employees,
            "founded_from": self.founded_from,
            "founded_to": self.founded_to,
            "bankrupt_from": self.bankrupt_from,
            "bankrupt_to": self.bankrupt_to,
            "is_bankrupt": self.is_bankrupt,
            "in_liquidation": self.in_liquidation,
            "in_forced_liquidation": self.in_forced_liquidation,
            "has_accounting": self.has_accounting,
            "exclude_org_form": self.exclude_org_form,
            "sort_by": self.sort_by,
            "sort_order": self.sort_order,
        }

        # Unpack range filters
        self._unpack_range_filters(params)

        return params

    def to_count_params(self) -> dict:
        """Convert DTO to count parameters (excludes pagination and sorting)

        More efficient than to_repository_params() as it skips unnecessary fields.

        Returns:
            Dictionary of filter parameters without pagination/sorting
        """
        params = {
            "name": self.name,
            "organisasjonsform": self.organisasjonsform,
            "naeringskode": self.naeringskode,
            "municipality": self.municipality,
            "county": self.county,
            "min_employees": self.min_employees,
            "max_employees": self.max_employees,
            "founded_from": self.founded_from,
            "founded_to": self.founded_to,
            "bankrupt_from": self.bankrupt_from,
            "bankrupt_to": self.bankrupt_to,
            "is_bankrupt": self.is_bankrupt,
            "in_liquidation": self.in_liquidation,
            "in_forced_liquidation": self.in_forced_liquidation,
            "has_accounting": self.has_accounting,
            "exclude_org_form": self.exclude_org_form,
        }

        # Unpack range filters
        self._unpack_range_filters(params)

        return params
