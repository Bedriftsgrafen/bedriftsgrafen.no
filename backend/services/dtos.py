"""Data Transfer Objects for service layer.

DTOs provide type-safe input validation and encapsulation for complex service methods.
"""

from datetime import date

from typing import Annotated
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
    skip: Annotated[int, Field(ge=0, description="Number of records to skip")] = 0
    limit: Annotated[int, Field(ge=1, le=1000, description="Maximum records to return")] = 100

    # Text search
    name: Annotated[str | None, Field(description="Search by company name or organization number")] = None

    # Basic filters
    organisasjonsform: Annotated[
        list[str] | None, Field(description="Filter by organization forms (AS, ASA, etc.)")
    ] = None
    naeringskode: Annotated[str | None, Field(description="Filter by industry code (NACE)")] = None
    municipality: Annotated[str | None, Field(description="Filter by municipality (kommune) name")] = None
    municipality_code: Annotated[
        str | None,
        Field(min_length=4, max_length=4, pattern=r"^\d{4}$", description="Filter by 4-digit municipality code"),
    ] = None
    county: Annotated[str | None, Field(description="Filter by county (fylke) - uses 2-digit code prefix")] = None

    # Employee range
    min_employees: Annotated[int | None, Field(ge=0, description="Minimum number of employees")] = None
    max_employees: Annotated[int | None, Field(ge=0, description="Maximum number of employees")] = None

    # Date range
    founded_from: Annotated[date | None, Field(description="Minimum founding date")] = None
    founded_to: Annotated[date | None, Field(description="Maximum founding date")] = None

    bankrupt_from: Annotated[date | None, Field(description="Minimum bankruptcy date")] = None
    bankrupt_to: Annotated[date | None, Field(description="Maximum bankruptcy date")] = None

    # Registration dates
    registered_from: Annotated[date | None, Field(description="Minimum registration date")] = None
    registered_to: Annotated[date | None, Field(description="Maximum registration date")] = None

    # Status flags
    is_bankrupt: Annotated[bool | None, Field(description="Filter by bankruptcy status")] = None
    in_liquidation: Annotated[bool | None, Field(description="Filter by liquidation status")] = None
    in_forced_liquidation: Annotated[bool | None, Field(description="Filter by forced liquidation status")] = None
    has_accounting: Annotated[bool | None, Field(description="Filter by existence of accounting data")] = None

    # Financial filters (grouped as ranges)
    revenue_range: Annotated[RangeFilter | None, Field(description="Revenue range filter")] = None
    profit_range: Annotated[RangeFilter | None, Field(description="Profit range filter")] = None
    equity_range: Annotated[RangeFilter | None, Field(description="Equity range filter")] = None
    operating_profit_range: Annotated[RangeFilter | None, Field(description="Operating profit range filter")] = None
    liquidity_ratio_range: Annotated[RangeFilter | None, Field(description="Liquidity ratio range filter")] = None
    equity_ratio_range: Annotated[RangeFilter | None, Field(description="Equity ratio range filter")] = None

    # Exclusion filters
    exclude_org_form: Annotated[
        list[str] | None, Field(description="Exclude specific organization forms (e.g., KBO for konkursbo)")
    ] = None

    # Sorting
    sort_by: Annotated[
        str,
        Field(
            pattern="^(navn|orgnr|organisasjonsform|antall_ansatte|stiftelsesdato|registreringsdato_enhetsregisteret|konkursdato|naeringskode|revenue|profit|operating_profit|operating_margin|kommune)$",
            description="Field to sort by",
        ),
    ] = "navn"
    sort_order: Annotated[str, Field(pattern="^(asc|desc)$", description="Sort order (ascending or descending)")] = (
        "asc"
    )

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

    def is_empty(self) -> bool:
        """Check if all filter parameters are at their default values"""
        # Exclude skip, limit, sort_by, sort_order from empty check
        exclude = {"skip", "limit", "sort_by", "sort_order"}
        data = self.model_dump(exclude=exclude)
        return not any(v is not None for v in data.values())

    @model_validator(mode="after")
    def validate_founded_date_range(self):
        """Ensure founded_from <= founded_to when both are provided"""
        if self.founded_from is not None and self.founded_to is not None and self.founded_from > self.founded_to:
            raise ValueError(f"founded_from ({self.founded_from}) cannot be after founded_to ({self.founded_to})")
        return self

    @model_validator(mode="after")
    def validate_registered_date_range(self):
        """Ensure registered_from <= registered_to when both are provided"""
        if (
            self.registered_from is not None
            and self.registered_to is not None
            and self.registered_from > self.registered_to
        ):
            raise ValueError(
                f"registered_from ({self.registered_from}) cannot be after registered_to ({self.registered_to})"
            )
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
            "municipality_code": self.municipality_code,
            "county": self.county,
            "min_employees": self.min_employees,
            "max_employees": self.max_employees,
            "founded_from": self.founded_from,
            "founded_to": self.founded_to,
            "bankrupt_from": self.bankrupt_from,
            "bankrupt_to": self.bankrupt_to,
            "registered_from": self.registered_from,
            "registered_to": self.registered_to,
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
            "municipality_code": self.municipality_code,
            "county": self.county,
            "min_employees": self.min_employees,
            "max_employees": self.max_employees,
            "founded_from": self.founded_from,
            "founded_to": self.founded_to,
            "bankrupt_from": self.bankrupt_from,
            "bankrupt_to": self.bankrupt_to,
            "registered_from": self.registered_from,
            "registered_to": self.registered_to,
            "is_bankrupt": self.is_bankrupt,
            "in_liquidation": self.in_liquidation,
            "in_forced_liquidation": self.in_forced_liquidation,
            "has_accounting": self.has_accounting,
            "exclude_org_form": self.exclude_org_form,
        }

        # Unpack range filters
        self._unpack_range_filters(params)

        return params
