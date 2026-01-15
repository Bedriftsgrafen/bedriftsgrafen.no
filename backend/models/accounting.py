from sqlalchemy import (
    Computed,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from typing import TYPE_CHECKING
from datetime import date, datetime

from database import Base

if TYPE_CHECKING:
    from models.company import Company


class Accounting(Base):
    __tablename__ = "regnskap"

    __table_args__ = (
        UniqueConstraint("orgnr", "periode_til", name="regnskap_orgnr_periode_unique"),
        Index("idx_regnskap_orgnr_aar", "orgnr", sa_text("aar DESC")),
        Index(
            "idx_regnskap_aarsresultat",
            sa_text("aarsresultat DESC NULLS LAST"),
            postgresql_where=sa_text("aarsresultat IS NOT NULL"),
        ),
        Index(
            "idx_regnskap_driftsresultat",
            sa_text("driftsresultat DESC NULLS LAST"),
            postgresql_where=sa_text("driftsresultat IS NOT NULL"),
        ),
        Index(
            "idx_regnskap_salgsinntekter",
            sa_text("salgsinntekter DESC NULLS LAST"),
            postgresql_where=sa_text("salgsinntekter IS NOT NULL"),
        ),
        Index(
            "idx_regnskap_latest_lookup",
            "orgnr",
            sa_text("aar DESC"),
            "salgsinntekter",
            "aarsresultat",
            "driftsresultat",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    orgnr: Mapped[str] = mapped_column(String, ForeignKey("bedrifter.orgnr"), index=True)

    # Period info
    periode_fra: Mapped[date | None] = mapped_column(Date, nullable=True)
    periode_til: Mapped[date | None] = mapped_column(Date, nullable=True)
    aar: Mapped[int] = mapped_column(Integer, index=True)

    # Financial data
    salgsinntekter: Mapped[float | None] = mapped_column(Float, nullable=True)
    annen_driftsinntekt: Mapped[float | None] = mapped_column(Float, nullable=True)
    varekostnad: Mapped[float | None] = mapped_column(Float, nullable=True)
    lonnskostnad: Mapped[float | None] = mapped_column(Float, nullable=True)
    avskrivninger: Mapped[float | None] = mapped_column(Float, nullable=True)  # DB name
    nedskrivning: Mapped[float | None] = mapped_column(Float, nullable=True)
    annen_driftskostnad: Mapped[float | None] = mapped_column(Float, nullable=True)
    driftsresultat: Mapped[float | None] = mapped_column(Float, nullable=True)
    finansinntekt: Mapped[float | None] = mapped_column(Float, nullable=True)
    finanskostnad: Mapped[float | None] = mapped_column(Float, nullable=True)
    ordinaert_resultat_for_skatt: Mapped[float | None] = mapped_column(Float, nullable=True)
    skattekostnad: Mapped[float | None] = mapped_column(Float, nullable=True)
    aarsresultat: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Balanse - Eiendeler
    anleggsmidler: Mapped[float | None] = mapped_column(Float, nullable=True)
    omloepsmidler: Mapped[float | None] = mapped_column(Float, nullable=True)
    sum_eiendeler: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Balanse - Egenkapital og gjeld
    egenkapital: Mapped[float | None] = mapped_column(Float, nullable=True)
    gjeld: Mapped[float | None] = mapped_column(Float, nullable=True)
    kortsiktig_gjeld: Mapped[float | None] = mapped_column(Float, nullable=True)
    langsiktig_gjeld: Mapped[float | None] = mapped_column(Float, nullable=True)
    sum_egenkapital_gjeld: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Computed/Derived columns present in DB
    total_inntekt: Mapped[float | None] = mapped_column(Float, nullable=True)
    gjeldsgrad: Mapped[float | None] = mapped_column(Float, nullable=True)
    ebitda: Mapped[float | None] = mapped_column(Float, nullable=True)
    ebitda_margin: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Raw data for completeness
    raw_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Computed columns
    likviditetsgrad1: Mapped[float | None] = mapped_column(
        Float,
        Computed("omloepsmidler / NULLIF(kortsiktig_gjeld, 0)", persisted=True),
        nullable=True,
    )
    egenkapitalandel: Mapped[float | None] = mapped_column(
        Float,
        Computed(
            "egenkapital / (egenkapital + COALESCE(kortsiktig_gjeld, 0) + COALESCE(langsiktig_gjeld, 0))",
            persisted=True,
        ),
        nullable=True,
    )

    company: Mapped["Company"] = relationship("Company", back_populates="regnskap")


class LatestFinancials(Base):
    """
    Read-only model mapping to the materialized view 'latest_financials'.
    Used for efficient filtering and sorting on latest financial data.
    """

    __tablename__ = "latest_financials"

    # Map to existing materialized view
    __table_args__ = {"extend_existing": True}

    orgnr: Mapped[str] = mapped_column(String, primary_key=True)
    aar: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salgsinntekter: Mapped[float | None] = mapped_column(Float, nullable=True)
    aarsresultat: Mapped[float | None] = mapped_column(Float, nullable=True)
    egenkapital: Mapped[float | None] = mapped_column(Float, nullable=True)
    driftsresultat: Mapped[float | None] = mapped_column(Float, nullable=True)
    likviditetsgrad1: Mapped[float | None] = mapped_column("likviditetsgrad", Float, nullable=True)
    egenkapitalandel: Mapped[float | None] = mapped_column(Float, nullable=True)
    operating_margin: Mapped[float | None] = mapped_column(Float, nullable=True)


class LatestAccountings(Base):
    """
    Read-only model mapping to the materialized view 'latest_accountings'.
    Used for efficient benchmark/stats queries (avoids expensive MAX(aar) subquery).
    """

    __tablename__ = "latest_accountings"

    # Map to existing materialized view
    __table_args__ = {"extend_existing": True}

    orgnr: Mapped[str] = mapped_column(String, primary_key=True)
    aar: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salgsinntekter: Mapped[float | None] = mapped_column(Float, nullable=True)
    aarsresultat: Mapped[float | None] = mapped_column(Float, nullable=True)
    driftsresultat: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_inntekt: Mapped[float | None] = mapped_column(Float, nullable=True)
    avskrivninger: Mapped[float | None] = mapped_column(Float, nullable=True)
