"""
CompanyFilterBuilder - Encapsulates filter logic for company queries.

This module extracts duplicate filter logic from CompanyRepository into a
reusable builder class with separate methods for each filter category.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import and_, exists, func, or_
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement

import models
from utils.county_codes import get_county_code, is_county_code
from utils.nace_codes import get_nace_division_prefixes

if TYPE_CHECKING:
    from services.dtos import CompanyFilterDTO


@dataclass
class FilterParams:
    """
    Lightweight parameter container for filter builder.

    Can be constructed from individual parameters (legacy repository interface)
    or from a CompanyFilterDTO.
    """

    # Text search
    name: str | None = None

    # Organization form
    organisasjonsform: list[str] | None = None

    # NACE code
    naeringskode: str | None = None

    # Employees
    min_employees: int | None = None
    max_employees: int | None = None

    # Location
    municipality: str | None = None
    county: str | None = None

    # Dates
    founded_from: date | None = None
    founded_to: date | None = None
    bankrupt_from: date | None = None
    bankrupt_to: date | None = None

    # Status
    is_bankrupt: bool | None = None
    in_liquidation: bool | None = None
    in_forced_liquidation: bool | None = None
    has_accounting: bool | None = None

    # Financial filters (min/max pairs)
    min_revenue: float | None = None
    max_revenue: float | None = None
    min_profit: float | None = None
    max_profit: float | None = None
    min_equity: float | None = None
    max_equity: float | None = None
    min_operating_profit: float | None = None
    max_operating_profit: float | None = None
    min_liquidity_ratio: float | None = None
    max_liquidity_ratio: float | None = None
    min_equity_ratio: float | None = None
    max_equity_ratio: float | None = None

    # Exclusion filter
    exclude_org_form: list[str] | None = None

    @classmethod
    def from_dto(cls, dto: CompanyFilterDTO) -> FilterParams:
        """Create FilterParams from a CompanyFilterDTO."""
        return cls(
            name=dto.name,
            organisasjonsform=dto.organisasjonsform,
            naeringskode=dto.naeringskode,
            min_employees=dto.min_employees,
            max_employees=dto.max_employees,
            municipality=dto.municipality,
            county=dto.county,
            founded_from=dto.founded_from,
            founded_to=dto.founded_to,
            bankrupt_from=dto.bankrupt_from,
            bankrupt_to=dto.bankrupt_to,
            is_bankrupt=dto.is_bankrupt,
            in_liquidation=dto.in_liquidation,
            in_forced_liquidation=dto.in_forced_liquidation,
            has_accounting=dto.has_accounting,
            min_revenue=dto.revenue_range.min if dto.revenue_range else None,
            max_revenue=dto.revenue_range.max if dto.revenue_range else None,
            min_profit=dto.profit_range.min if dto.profit_range else None,
            max_profit=dto.profit_range.max if dto.profit_range else None,
            min_equity=dto.equity_range.min if dto.equity_range else None,
            max_equity=dto.equity_range.max if dto.equity_range else None,
            min_operating_profit=dto.operating_profit_range.min if dto.operating_profit_range else None,
            max_operating_profit=dto.operating_profit_range.max if dto.operating_profit_range else None,
            min_liquidity_ratio=dto.liquidity_ratio_range.min if dto.liquidity_ratio_range else None,
            max_liquidity_ratio=dto.liquidity_ratio_range.max if dto.liquidity_ratio_range else None,
            min_equity_ratio=dto.equity_ratio_range.min if dto.equity_ratio_range else None,
            max_equity_ratio=dto.equity_ratio_range.max if dto.equity_ratio_range else None,
            exclude_org_form=dto.exclude_org_form,
        )

    def has_financial_filters(self) -> bool:
        """Check if any financial value filters are present (requires join)."""
        return any([
            self.min_revenue,
            self.max_revenue,
            self.min_profit,
            self.max_profit,
            self.min_equity,
            self.max_equity,
            self.min_operating_profit,
            self.max_operating_profit,
            self.min_liquidity_ratio,
            self.max_liquidity_ratio,
            self.min_equity_ratio,
            self.max_equity_ratio,
        ])

    def is_empty(self) -> bool:
        """Check if no filters are set (use for fast-path optimization)."""
        return not any([
            self.name,
            self.organisasjonsform,
            self.naeringskode,
            self.min_employees,
            self.max_employees,
            self.municipality,
            self.county,
            self.founded_from,
            self.founded_to,
            self.bankrupt_from,
            self.bankrupt_to,
            self.is_bankrupt,
            self.in_liquidation,
            self.in_forced_liquidation,
            self.has_financial_filters(),
            self.has_accounting,
            self.exclude_org_form,
        ])

    def has_only_org_form_filter(self) -> bool:
        """Check if only organisasjonsform filter is set (for pre-computed counts)."""
        return bool(self.organisasjonsform) and not any([
            self.name,
            self.naeringskode,
            self.min_employees,
            self.max_employees,
            self.municipality,
            self.county,
            self.founded_from,
            self.founded_to,
            self.bankrupt_from,
            self.bankrupt_to,
            self.is_bankrupt,
            self.in_liquidation,
            self.in_forced_liquidation,
            self.has_financial_filters(),
            self.has_accounting,
            self.exclude_org_form,
        ])


class CompanyFilterBuilder:
    """
    Builder for applying company filters to SQLAlchemy queries.

    Extracts filter logic into testable, composable methods.
    Each filter method returns self for fluent chaining.

    Usage:
        builder = CompanyFilterBuilder(filters)
        builder.apply_all(include_financial=True)
        query = builder.apply_to_query(query)
    """

    def __init__(self, filters: FilterParams):
        """Initialize builder with filter parameters."""
        self._f = filters
        self._clauses: list[ColumnElement[bool]] = []
        self._needs_financial_join = False

    @classmethod
    def from_dto(cls, dto: CompanyFilterDTO) -> CompanyFilterBuilder:
        """Create builder from a CompanyFilterDTO."""
        return cls(FilterParams.from_dto(dto))

    @property
    def clauses(self) -> list[ColumnElement[bool]]:
        """Get the accumulated filter clauses."""
        return self._clauses

    @property
    def needs_financial_join(self) -> bool:
        """Check if financial join is required for these filters."""
        return self._needs_financial_join

    # =========================================================================
    # Text Search Filters
    # =========================================================================

    def apply_text_search(self) -> CompanyFilterBuilder:
        """
        Apply text search filter (name/orgnr).

        Strategy:
        - Org number (digits only): prefix LIKE match
        - Short query (<3 chars): ILIKE prefix match
        - Longer query: Full-text search with Norwegian stemming
        """
        name = self._f.name
        if not name:
            return self

        if name.isdigit():
            # Org number search - prefix match
            self._clauses.append(models.Company.orgnr.like(f"{name}%"))
        elif len(name) < 3:
            # Short query - ILIKE prefix (FTS doesn't work well for short terms)
            self._clauses.append(models.Company.navn.ilike(f"{name}%"))
        else:
            # Full-text search with Norwegian language support
            search_query = func.websearch_to_tsquery("norwegian", name)
            self._clauses.append(models.Company.search_vector.op("@@")(search_query))

        return self

    # =========================================================================
    # Organization Form Filter
    # =========================================================================

    def apply_org_form_filter(self) -> CompanyFilterBuilder:
        """Apply filter by organization form (AS, ASA, ENK, etc.)."""
        org_forms = self._f.organisasjonsform
        if org_forms and len(org_forms) > 0:
            self._clauses.append(models.Company.organisasjonsform.in_(org_forms))
        return self

    def apply_exclude_org_form_filter(self) -> CompanyFilterBuilder:
        """Exclude specific organization forms (e.g., KBO for konkursbo)."""
        exclude_forms = self._f.exclude_org_form
        if exclude_forms and len(exclude_forms) > 0:
            self._clauses.append(~models.Company.organisasjonsform.in_(exclude_forms))
        return self

    # =========================================================================
    # NACE Code Filter
    # =========================================================================

    def apply_nace_filter(self) -> CompanyFilterBuilder:
        """
        Apply NACE code filter with prefix matching.

        Handles:
        - Full NACE codes (e.g., '68.100')
        - Division codes (e.g., '68')
        - Section letters (e.g., 'L' -> expands to all divisions in section)
        """
        naeringskode = self._f.naeringskode
        if not naeringskode:
            return self

        # Handle section letters by expanding to multiple prefixes
        prefixes = get_nace_division_prefixes(naeringskode)

        if not prefixes:
            # Empty/invalid input - skip
            return self
        elif len(prefixes) == 1:
            self._clauses.append(models.Company.naeringskode.like(f"{prefixes[0]}%"))
        else:
            # Multiple prefixes (section letter) - use OR
            self._clauses.append(or_(*[models.Company.naeringskode.like(f"{p}%") for p in prefixes]))

        return self

    # =========================================================================
    # Employee Filter
    # =========================================================================

    def apply_employee_filter(self) -> CompanyFilterBuilder:
        """Apply min/max employee count filters."""
        if self._f.min_employees is not None:
            self._clauses.append(models.Company.antall_ansatte >= self._f.min_employees)
        if self._f.max_employees is not None:
            self._clauses.append(models.Company.antall_ansatte <= self._f.max_employees)
        return self

    # =========================================================================
    # Location Filters
    # =========================================================================

    def apply_location_filter(self) -> CompanyFilterBuilder:
        """
        Apply municipality and county filters.

        Municipality: Exact match on kommune field (case-insensitive)
        County: Prefix match on kommunenummer (2-digit fylke code)
        """
        # Municipality filter
        if self._f.municipality:
            muni_upper = self._f.municipality.upper()
            muni_filter = or_(
                func.upper(models.Company.forretningsadresse["kommune"].astext) == muni_upper,
                func.upper(models.Company.postadresse["kommune"].astext) == muni_upper,
            )
            self._clauses.append(muni_filter)

        # County filter
        if self._f.county:
            county_code = get_county_code(self._f.county) if not is_county_code(self._f.county) else self._f.county
            if county_code:
                county_filter = or_(
                    func.left(models.Company.forretningsadresse["kommunenummer"].astext, 2) == county_code,
                    func.left(models.Company.postadresse["kommunenummer"].astext, 2) == county_code,
                )
                self._clauses.append(county_filter)

        return self

    # =========================================================================
    # Date Filters
    # =========================================================================

    def apply_date_filters(self) -> CompanyFilterBuilder:
        """Apply founding date and bankruptcy date range filters."""
        # Foundation date range
        if self._f.founded_from:
            self._clauses.append(models.Company.stiftelsesdato >= self._f.founded_from)
        if self._f.founded_to:
            self._clauses.append(models.Company.stiftelsesdato <= self._f.founded_to)

        # Bankruptcy date range
        if self._f.bankrupt_from:
            self._clauses.append(models.Company.konkursdato >= self._f.bankrupt_from)
        if self._f.bankrupt_to:
            self._clauses.append(models.Company.konkursdato <= self._f.bankrupt_to)

        return self

    # =========================================================================
    # Status Filters
    # =========================================================================

    def apply_status_filters(self) -> CompanyFilterBuilder:
        """
        Apply company status filters.

        Handles bankruptcy, liquidation, and forced liquidation status.
        Bankruptcy filter includes KBO (konkursbo) companies.
        """
        # Bankruptcy status
        if self._f.is_bankrupt is not None:
            if self._f.is_bankrupt:
                # Include both konkurs=TRUE and KBO companies
                self._clauses.append(or_(models.Company.konkurs.is_(True), models.Company.organisasjonsform == "KBO"))
            else:
                # Exclude konkurs AND KBO
                self._clauses.append(and_(models.Company.konkurs.isnot(True), models.Company.organisasjonsform != "KBO"))

        # Liquidation status
        if self._f.in_liquidation is not None:
            self._clauses.append(models.Company.under_avvikling == self._f.in_liquidation)

        # Forced liquidation status
        if self._f.in_forced_liquidation is not None:
            self._clauses.append(models.Company.under_tvangsavvikling == self._f.in_forced_liquidation)

        return self

    # =========================================================================
    # Accounting Existence Filter
    # =========================================================================

    def apply_has_accounting_filter(self) -> CompanyFilterBuilder:
        """Apply filter for presence/absence of accounting records."""
        if self._f.has_accounting is not None:
            if self._f.has_accounting:
                self._clauses.append(exists().where(models.Accounting.orgnr == models.Company.orgnr))
            else:
                self._clauses.append(~exists().where(models.Accounting.orgnr == models.Company.orgnr))
        return self

    # =========================================================================
    # Financial Filters
    # =========================================================================

    def apply_financial_filters(self) -> CompanyFilterBuilder:
        """
        Apply financial metric filters (revenue, profit, equity, ratios).

        These filters require a join with LatestFinancials materialized view.
        Sets needs_financial_join flag if any financial filters are present.
        """
        # Check if any financial filters are present
        has_financial = self._has_financial_filters()
        if not has_financial:
            return self

        self._needs_financial_join = True

        # Revenue filters
        if self._f.min_revenue is not None:
            self._clauses.append(models.LatestFinancials.salgsinntekter >= self._f.min_revenue)
        if self._f.max_revenue is not None:
            self._clauses.append(models.LatestFinancials.salgsinntekter <= self._f.max_revenue)

        # Profit filters
        if self._f.min_profit is not None:
            self._clauses.append(models.LatestFinancials.aarsresultat >= self._f.min_profit)
        if self._f.max_profit is not None:
            self._clauses.append(models.LatestFinancials.aarsresultat <= self._f.max_profit)

        # Equity filters
        if self._f.min_equity is not None:
            self._clauses.append(models.LatestFinancials.egenkapital >= self._f.min_equity)
        if self._f.max_equity is not None:
            self._clauses.append(models.LatestFinancials.egenkapital <= self._f.max_equity)

        # Operating profit filters
        if self._f.min_operating_profit is not None:
            self._clauses.append(models.LatestFinancials.driftsresultat >= self._f.min_operating_profit)
        if self._f.max_operating_profit is not None:
            self._clauses.append(models.LatestFinancials.driftsresultat <= self._f.max_operating_profit)

        # Liquidity ratio filters
        if self._f.min_liquidity_ratio is not None:
            self._clauses.append(models.LatestFinancials.likviditetsgrad1 >= self._f.min_liquidity_ratio)
        if self._f.max_liquidity_ratio is not None:
            self._clauses.append(models.LatestFinancials.likviditetsgrad1 <= self._f.max_liquidity_ratio)

        # Equity ratio filters
        if self._f.min_equity_ratio is not None:
            self._clauses.append(models.LatestFinancials.egenkapitalandel >= self._f.min_equity_ratio)
        if self._f.max_equity_ratio is not None:
            self._clauses.append(models.LatestFinancials.egenkapitalandel <= self._f.max_equity_ratio)

        return self

    def _has_financial_filters(self) -> bool:
        """Check if any financial filters are present."""
        return any(
            [
                self._f.min_revenue is not None,
                self._f.max_revenue is not None,
                self._f.min_profit is not None,
                self._f.max_profit is not None,
                self._f.min_equity is not None,
                self._f.max_equity is not None,
                self._f.min_operating_profit is not None,
                self._f.max_operating_profit is not None,
                self._f.min_liquidity_ratio is not None,
                self._f.max_liquidity_ratio is not None,
                self._f.min_equity_ratio is not None,
                self._f.max_equity_ratio is not None,
            ]
        )

    # =========================================================================
    # Composite Methods
    # =========================================================================

    def apply_all(self, include_financial: bool = False) -> CompanyFilterBuilder:
        """
        Apply all non-financial filters.

        Args:
            include_financial: If True, also apply financial filters
                             (caller must handle join)
        """
        self.apply_text_search()
        self.apply_org_form_filter()
        self.apply_exclude_org_form_filter()  # Exclude specific org forms (e.g., KBO)
        self.apply_nace_filter()
        self.apply_employee_filter()
        self.apply_location_filter()
        self.apply_date_filters()
        self.apply_status_filters()
        self.apply_has_accounting_filter()

        if include_financial:
            self.apply_financial_filters()

        return self

    def apply_to_query(self, query: Select) -> Select:
        """
        Apply accumulated filter clauses to a SQLAlchemy query.

        Args:
            query: The SQLAlchemy Select object to filter

        Returns:
            Filtered query with WHERE clause applied
        """
        if self._clauses:
            query = query.filter(and_(*self._clauses))
        return query

    def build(self) -> list[ColumnElement[bool]]:
        """
        Return the list of filter clauses without applying to a query.

        Useful for manually combining with other clauses.
        """
        return self._clauses.copy()
