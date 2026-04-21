"""Read-only ORM model for person_toplist_mv materialized view."""

from __future__ import annotations

from datetime import date

from sqlalchemy import BigInteger, Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class PersonToplist(Base):
    """Pre-aggregated person metrics from person_toplist_mv materialized view."""

    __tablename__ = "person_toplist_mv"
    __table_args__ = {"extend_existing": True}

    person_navn: Mapped[str] = mapped_column(String, primary_key=True)
    foedselsdato: Mapped[date] = mapped_column(Date, primary_key=True)
    total_roles: Mapped[int] = mapped_column(Integer)
    active_roles: Mapped[int] = mapped_column(Integer)
    styreleder_count: Mapped[int] = mapped_column(Integer)
    ceo_count: Mapped[int] = mapped_column(Integer)
    styremedlem_count: Mapped[int] = mapped_column(Integer)
    active_companies: Mapped[int] = mapped_column(Integer)
    industry_diversity: Mapped[int] = mapped_column(Integer)
    total_revenue: Mapped[int] = mapped_column(BigInteger, default=0)
