from sqlalchemy import (
    Column,
    Computed,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Index,
)
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


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

    # id = Column(Integer, primary_key=True, index=True) # DB seems to use composite PK? No, migration creates id.
    # Migration said: op.drop_constraint('fk_regnskap_orgnr'... foreignkey)
    # And op.create_unique_constraint(uq_regnskap_orgnr_aar...)

    # Actually, migration line 22 (check_schema_drift) implies 'id' is adding? No.
    # Let's keep existing columns but fix names.

    id = Column(Integer, primary_key=True, index=True)
    orgnr = Column(String, ForeignKey("bedrifter.orgnr"), index=True)
    # navn = Column(String)  # Not in DB
    # stiftelsesdato = Column(Date) # Not in DB

    # Period info
    periode_fra = Column(Date)
    periode_til = Column(Date)
    aar = Column(Integer, index=True)

    # Financial data
    salgsinntekter = Column(Float)
    annen_driftsinntekt = Column(Float)
    varekostnad = Column(Float)
    lonnskostnad = Column(Float)
    avskrivninger = Column(Float)  # DB name
    nedskrivning = Column(Float)
    annen_driftskostnad = Column(Float)
    driftsresultat = Column(Float)
    finansinntekt = Column(Float)
    finanskostnad = Column(Float)
    ordinaert_resultat_for_skatt = Column(Float)
    skattekostnad = Column(Float)
    aarsresultat = Column(Float)

    # Balanse - Eiendeler
    anleggsmidler = Column(Float)
    omloepsmidler = Column(Float)
    sum_eiendeler = Column(Float)

    # Balanse - Egenkapital og gjeld
    egenkapital = Column(Float)
    gjeld = Column(Float)
    kortsiktig_gjeld = Column(Float)
    langsiktig_gjeld = Column(Float)
    sum_egenkapital_gjeld = Column(Float)

    # Computed/Derived columns present in DB
    total_inntekt = Column(Float)
    gjeldsgrad = Column(Float)
    ebitda = Column(Float)
    ebitda_margin = Column(Float)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Raw data for completeness
    raw_data = Column(JSONB)

    # Computed columns
    likviditetsgrad1 = Column(
        Float,
        Computed("omloepsmidler / NULLIF(kortsiktig_gjeld, 0)", persisted=True),
        nullable=True,
    )
    egenkapitalandel = Column(
        Float,
        Computed(
            "egenkapital / (egenkapital + COALESCE(kortsiktig_gjeld, 0) + COALESCE(langsiktig_gjeld, 0))",
            persisted=True,
        ),
        nullable=True,
    )

    company = relationship("Company", back_populates="regnskap")


class LatestFinancials(Base):
    """
    Read-only model mapping to the materialized view 'latest_financials'.
    Used for efficient filtering and sorting on latest financial data.
    """

    __tablename__ = "latest_financials"
    
    # Map to existing materialized view
    __table_args__ = {'extend_existing': True}

    orgnr = Column(String, primary_key=True)
    aar = Column(Integer)
    salgsinntekter = Column(Float)
    aarsresultat = Column(Float)
    egenkapital = Column(Float)
    driftsresultat = Column(Float)
    likviditetsgrad1 = Column("likviditetsgrad", Float)
    egenkapitalandel = Column(Float)
    operating_margin = Column(Float)


class LatestAccountings(Base):
    """
    Read-only model mapping to the materialized view 'latest_accountings'.
    Used for efficient benchmark/stats queries (avoids expensive MAX(aar) subquery).
    """

    __tablename__ = "latest_accountings"
    
    # Map to existing materialized view
    __table_args__ = {'extend_existing': True}

    orgnr = Column(String, primary_key=True)
    aar = Column(Integer)
    salgsinntekter = Column(Float)
    aarsresultat = Column(Float)
    driftsresultat = Column(Float)
    total_inntekt = Column(Float)
    avskrivninger = Column(Float)
