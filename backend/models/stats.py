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

    @property
    def avg_employees(self) -> float:
        """Calculate average employees per company."""
        if self.company_count and self.company_count > 0:
            return (self.total_employees or 0) / self.company_count
        return 0.0


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

    @property
    def avg_employees(self) -> float:
        """Calculate average employees per company."""
        if self.company_count and self.company_count > 0:
            return (self.total_employees or 0) / self.company_count
        return 0.0


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
    nace_division: Mapped[str] = mapped_column(String, primary_key=True)
    company_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_last_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bankrupt_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_employees: Mapped[int | None] = mapped_column(Integer, nullable=True)
