from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Index,
)
from sqlalchemy.sql import func

from database import Base


class MunicipalityPopulation(Base):
    """
    Population data per municipality (SSB).
    Used for per-capita statistics.
    """

    __tablename__ = "municipality_population"

    __table_args__ = (Index("idx_municipality_population_year_code", "year", "municipality_code"),)

    municipality_code = Column(String, primary_key=True)
    year = Column(Integer, primary_key=True)
    population = Column(Integer, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
