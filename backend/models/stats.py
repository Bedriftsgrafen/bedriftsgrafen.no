from sqlalchemy import (
    Float,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class IndustryStats(Base):
    """
    Read-only model mapping to the materialized view 'industry_stats'.
    Aggregated statistics per NACE division for industry benchmarking.
    """

    __tablename__ = "industry_stats"
    __table_args__ = {"extend_existing": True}

    nace_division: Mapped[str] = mapped_column(String, primary_key=True)
    company_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_employees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_employees: Mapped[float | None] = mapped_column(Float, nullable=True)
    new_last_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bankrupt_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bankruptcies_last_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    median_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    profitable_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_operating_margin: Mapped[float | None] = mapped_column(Float, nullable=True)


class IndustrySubclassStats(Base):
    """
    Read-only model mapping to the materialized view 'industry_subclass_stats'.
    Aggregated statistics per 5-digit NACE code (subclass).
    """

    __tablename__ = "industry_subclass_stats"
    __table_args__ = {"extend_existing": True}

    nace_code: Mapped[str] = mapped_column(String, primary_key=True)
    company_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_employees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_employees: Mapped[float | None] = mapped_column(Float, nullable=True)
    new_last_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bankrupt_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bankruptcies_last_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    median_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    profitable_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_operating_margin: Mapped[float | None] = mapped_column(Float, nullable=True)


class CountyStats(Base):
    """
    Read-only model mapping to materialized view 'county_stats'.
    Aggregated statistics per county (fylke) and NACE division for geographic visualization.
    """

    __tablename__ = "county_stats"
    __table_args__ = {"extend_existing": True}

    county_code: Mapped[str] = mapped_column(String, primary_key=True)
    nace_division: Mapped[str] = mapped_column(String, primary_key=True)
    company_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_last_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bankrupt_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_employees: Mapped[int | None] = mapped_column(Integer, nullable=True)


class MunicipalityStats(Base):
    """
    Read-only model mapping to materialized view 'municipality_stats'.
    Aggregated statistics per municipality (kommune) and NACE division.
    """

    __tablename__ = "municipality_stats"
    __table_args__ = {"extend_existing": True}

    municipality_code: Mapped[str] = mapped_column(String, primary_key=True)
    county_code: Mapped[str | None] = mapped_column(String, nullable=True)
    nace_division: Mapped[str] = mapped_column(String, primary_key=True)
    company_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_last_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bankrupt_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_employees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)


class CompanyTotals(Base):
    """
    Read-only model mapping to materialized view 'company_totals'.
    Single-row aggregate with platform-wide statistics for the landing page.
    """

    __tablename__ = "company_totals"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    total_count: Mapped[int] = mapped_column(Integer, default=0)
    total_roles: Mapped[int] = mapped_column(Integer, default=0)
    total_employees: Mapped[int] = mapped_column(Integer, default=0)
    geocoded_count: Mapped[int] = mapped_column(Integer, default=0)
    new_companies_30d: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue: Mapped[float] = mapped_column(Float, default=0.0)
    total_ebitda: Mapped[float] = mapped_column(Float, default=0.0)
    profitable_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    solid_company_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    avg_operating_margin: Mapped[float] = mapped_column(Float, default=0.0)
