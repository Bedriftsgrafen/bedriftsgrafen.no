from datetime import datetime
from sqlalchemy import (
    DateTime,
    Integer,
    String,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from database import Base


class MunicipalityPopulation(Base):
    """
    Population data per municipality (SSB).
    Used for per-capita statistics.
    """

    __tablename__ = "municipality_population"

    __table_args__ = (Index("idx_municipality_population_year_code", "year", "municipality_code"),)

    municipality_code: Mapped[str] = mapped_column(String, primary_key=True)
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)  # Denormalized for performance
    population: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
