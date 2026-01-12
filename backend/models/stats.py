from sqlalchemy import (
    Column,
    Float,
    Integer,
    String,
)

from database import Base


class IndustryStats(Base):
    """
    Read-only model mapping to the materialized view 'industry_stats'.
    Aggregated statistics per NACE division for industry benchmarking.
    """

    __tablename__ = "industry_stats"
    __table_args__ = {"extend_existing": True}

    nace_division = Column(String, primary_key=True)
    company_count = Column(Integer)
    total_employees = Column(Integer)
    new_last_year = Column(Integer)
    bankrupt_count = Column(Integer)
    bankruptcies_last_year = Column(Integer)
    total_revenue = Column(Float)
    avg_revenue = Column(Float)
    total_profit = Column(Float)
    avg_profit = Column(Float)
    median_revenue = Column(Float)
    profitable_count = Column(Integer)
    avg_operating_margin = Column(Float)

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

    nace_code = Column(String, primary_key=True)
    company_count = Column(Integer)
    total_employees = Column(Integer)
    new_last_year = Column(Integer)
    bankrupt_count = Column(Integer)
    bankruptcies_last_year = Column(Integer)
    total_revenue = Column(Float)
    avg_revenue = Column(Float)
    total_profit = Column(Float)
    avg_profit = Column(Float)
    median_revenue = Column(Float)
    profitable_count = Column(Integer)
    avg_operating_margin = Column(Float)

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

    county_code = Column(String, primary_key=True)
    nace_division = Column(String, primary_key=True)
    company_count = Column(Integer)
    new_last_year = Column(Integer)
    bankrupt_count = Column(Integer)
    total_employees = Column(Integer)


class MunicipalityStats(Base):
    """
    Read-only model mapping to materialized view 'municipality_stats'.
    Aggregated statistics per municipality (kommune) and NACE division.
    """

    __tablename__ = "municipality_stats"
    __table_args__ = {"extend_existing": True}

    municipality_code = Column(String, primary_key=True)
    nace_division = Column(String, primary_key=True)
    company_count = Column(Integer)
    new_last_year = Column(Integer)
    bankrupt_count = Column(Integer)
    total_employees = Column(Integer)
