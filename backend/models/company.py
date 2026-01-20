from datetime import date, datetime
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, relationship, mapped_column
from sqlalchemy.sql import func

from database import Base
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from models.accounting import Accounting


class Company(Base):
    __tablename__ = "bedrifter"

    __table_args__ = (
        # Functional index for efficient municipality filtering
        Index(
            "ix_bedrifter_kommunenummer",
            func.left(Column("forretningsadresse", JSONB)["kommunenummer"].astext, 4),
        ),
        # Full-text search index
        Index("ix_bedrifter_search_vector", "search_vector", postgresql_using="gin"),
        # Performance Indexes restoration
        Index("ix_bedrifter_konkursdato", "konkursdato"),
        Index(
            "idx_bedrifter_geocoded",
            "orgnr",
            postgresql_where=sa_text("latitude IS NOT NULL"),
        ),
        Index("ix_bedrifter_geocoding_attempts", "geocoding_attempts"),
        # Functional / Partial Indexes
        Index(
            "idx_bedrifter_active_only",
            "orgnr",
            postgresql_where=sa_text(
                "(konkurs IS NOT TRUE) AND (under_avvikling IS NOT TRUE) AND (under_tvangsavvikling IS NOT TRUE)"
            ),
        ),
        Index(
            "idx_bedrifter_active_navn",
            "navn",
            postgresql_where=sa_text(
                "(konkurs IS NOT TRUE) AND (under_avvikling IS NOT TRUE) AND (under_tvangsavvikling IS NOT TRUE)"
            ),
        ),
        Index(
            "idx_bedrifter_active_naeringskode",
            "naeringskode",
            postgresql_where=sa_text(
                "(konkurs IS NOT TRUE) AND (under_avvikling IS NOT TRUE) AND (under_tvangsavvikling IS NOT TRUE)"
            ),
        ),
        Index(
            "idx_bedrifter_active_ansatte",
            sa_text("antall_ansatte DESC NULLS LAST"),
            postgresql_where=sa_text(
                "(konkurs IS NOT TRUE) AND (under_avvikling IS NOT TRUE) AND (under_tvangsavvikling IS NOT TRUE)"
            ),
        ),
        Index(
            "idx_bedrifter_forr_kommune",
            sa_text("upper(forretningsadresse ->> 'kommune')"),
        ),
        Index(
            "idx_bedrifter_post_kommune",
            sa_text("upper(postadresse ->> 'kommune')"),
        ),
        Index(
            "idx_search_kommune_navn",
            sa_text("(forretningsadresse ->> 'kommune')"),
            "navn",
            postgresql_where=sa_text(
                "((konkurs IS NOT TRUE) AND (under_avvikling IS NOT TRUE) AND (under_tvangsavvikling IS NOT TRUE))"
            ),
        ),
        # Ordering indexes
        Index("idx_bedrifter_antall_ansatte_desc", sa_text("antall_ansatte DESC NULLS LAST")),
        Index("idx_bedrifter_stiftelsesdato_desc", sa_text("stiftelsesdato DESC NULLS LAST")),
        Index("idx_bedrifter_orgnr_desc", sa_text("orgnr DESC NULLS LAST")),
        Index("idx_bedrifter_navn_desc", sa_text("navn DESC NULLS LAST")),
        # Partial index for companies needing financial polling (NULL values not in regular B-tree index)
        Index(
            "idx_bedrifter_needs_financial_polling", "orgnr", postgresql_where=sa_text("last_polled_regnskap IS NULL")
        ),
        # --- RESTORED INDEXES to match Database definition ---
        Index(
            "idx_bedrifter_active_orgform",
            "organisasjonsform",
            postgresql_where=sa_text(
                "((konkurs IS NOT TRUE) AND (under_avvikling IS NOT TRUE) AND (under_tvangsavvikling IS NOT TRUE))"
            ),
        ),
        Index("idx_bedrifter_konkurs_partial", "konkurs", postgresql_where=sa_text("(konkurs = true)")),
        Index(
            "idx_bedrifter_konkursdato_partial",
            sa_text("konkursdato DESC NULLS LAST"),
            postgresql_where=sa_text("(konkursdato IS NOT NULL)"),
        ),
        Index(
            "idx_bedrifter_list_covering",
            "navn",
            postgresql_include=["orgnr", "organisasjonsform", "naeringskode", "antall_ansatte", "stiftelsesdato"],
        ),
        Index("idx_bedrifter_nace_active", "naeringskode", "konkurs", postgresql_where=sa_text("(konkurs = false)")),
        Index("idx_bedrifter_nace_ansatte", "naeringskode", sa_text("antall_ansatte DESC NULLS LAST")),
        Index("idx_bedrifter_nace_kommune", sa_text("(forretningsadresse ->> 'kommunenummer'::text)"), "naeringskode"),
        Index("idx_bedrifter_nace_stiftelse", "naeringskode", sa_text("stiftelsesdato DESC NULLS LAST")),
        Index(
            "idx_bedrifter_naeringskode_pattern", "naeringskode", postgresql_ops={"naeringskode": "text_pattern_ops"}
        ),
        Index("idx_bedrifter_navn_pattern", "navn", postgresql_ops={"navn": "text_pattern_ops"}),
        Index("idx_bedrifter_orgform_ansatte", "organisasjonsform", sa_text("antall_ansatte DESC NULLS LAST")),
        Index("idx_bedrifter_orgform_nace", "organisasjonsform", "naeringskode"),
        Index("idx_bedrifter_orgform_navn_asc", "organisasjonsform", "navn"),
        Index("idx_bedrifter_orgform_navn_desc", "organisasjonsform", sa_text("navn DESC")),
        Index("idx_bedrifter_orgform_stiftelse", "organisasjonsform", sa_text("stiftelsesdato DESC NULLS LAST")),
        Index(
            "idx_companies_geocoding_queue",
            sa_text("antall_ansatte DESC NULLS LAST"),
            postgresql_where=sa_text("(latitude IS NULL)"),
        ),
        Index(
            "idx_list_orgform_ansatte",
            "organisasjonsform",
            sa_text("antall_ansatte DESC"),
            postgresql_where=sa_text(
                "((konkurs IS NOT TRUE) AND (under_avvikling IS NOT TRUE) AND (under_tvangsavvikling IS NOT TRUE))"
            ),
        ),
        Index(
            "idx_similar_kommune",
            sa_text("left(naeringskode, 3)"),
            sa_text("upper(forretningsadresse ->> 'kommune'::text)"),
            sa_text("antall_ansatte DESC NULLS LAST"),
            postgresql_where=sa_text(
                "((konkurs = false) AND (under_avvikling = false) AND (under_tvangsavvikling = false))"
            ),
        ),
        Index(
            "idx_similar_postnummer",
            "naeringskode",
            sa_text("(forretningsadresse ->> 'postnummer'::text)"),
            sa_text("antall_ansatte DESC NULLS LAST"),
            postgresql_where=sa_text(
                "((konkurs = false) AND (under_avvikling = false) AND (under_tvangsavvikling = false))"
            ),
        ),
        Index("idx_bedrifter_reg_enhetsregisteret_desc", sa_text("registreringsdato_enhetsregisteret DESC NULLS LAST")),
        Index(
            "idx_bedrifter_reg_foretaksregisteret_desc", sa_text("registreringsdato_foretaksregisteret DESC NULLS LAST")
        ),
    )

    orgnr: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    navn: Mapped[str | None] = mapped_column(Text, index=True, nullable=True)
    organisasjonsform: Mapped[str | None] = mapped_column(String, nullable=True)
    naeringskode: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    antall_ansatte: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hjemmeside: Mapped[str | None] = mapped_column(Text, nullable=True)
    stiftelsesdato: Mapped[date | None] = mapped_column(Date, nullable=True)
    registreringsdato_enhetsregisteret: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    registreringsdato_foretaksregisteret: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    # Address data (stored as JSONB for flexibility)
    postadresse: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    forretningsadresse: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Bankruptcy info
    konkurs: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    konkursdato: Mapped[date | None] = mapped_column(Date, nullable=True)
    under_avvikling: Mapped[bool] = mapped_column(Boolean, default=False)
    under_tvangsavvikling: Mapped[bool] = mapped_column(Boolean, default=False)
    registrert_i_foretaksregisteret: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    registrert_i_mvaregisteret: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    registrert_i_frivillighetsregisteret: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    registrert_i_stiftelsesregisteret: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    registrert_i_partiregisteret: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Formal purpose as text
    vedtektsfestet_formaal: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Raw data from Brønnøysund for future proofing
    raw_data: Mapped[dict | None] = mapped_column("data", JSONB, nullable=True)

    # Geocoding fields
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geocoding_attempts: Mapped[int] = mapped_column(Integer, default=0)
    geocoded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Search vector
    search_vector: Mapped[Any] = mapped_column(TSVECTOR, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_polled_regnskap: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True
    )  # Tracks when financials were last fetched
    last_polled_roles: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True
    )  # Tracks when roles were last fetched

    # Relationships - Use noload to prevent N+1 queries
    # Queries that need these relationships MUST explicitly eager load with selectinload/joinedload
    regnskap: Mapped[list["Accounting"]] = relationship(
        "Accounting", back_populates="company", cascade="all, delete-orphan", lazy="noload"
    )
    underenheter: Mapped[list["SubUnit"]] = relationship(
        "SubUnit", back_populates="parent_company", cascade="all, delete-orphan", lazy="noload"
    )
    roller: Mapped[list["Role"]] = relationship(
        "Role", back_populates="company", cascade="all, delete-orphan", lazy="noload"
    )

    @property
    def naeringskoder(self):
        """Helper to get all NACE codes from raw_data json."""
        codes = []
        if self.naeringskode:
            codes.append(self.naeringskode)

        if self.raw_data:
            # Check for secondary NACE codes in raw data
            # Format depends on Enhetsregisteret response structure
            if "naeringskode2" in self.raw_data:
                codes.append(self.raw_data["naeringskode2"].get("kode"))
            if "naeringskode3" in self.raw_data:
                codes.append(self.raw_data["naeringskode3"].get("kode"))
        return [c for c in codes if c]

    @property
    def updated_at(self):
        """Extract last update timestamp from raw data"""
        if self.raw_data and "oppdatert" in self.raw_data:
            return self.raw_data["oppdatert"]
        return None


class SubUnit(Base):
    """
    Underenheter (subunits/branches) belonging to a parent company.
    Examples: retail stores, branch offices, production facilities.
    """

    __tablename__ = "underenheter"

    __table_args__ = (
        Index(
            "ix_underenheter_navn_trigram",
            "navn",
            postgresql_ops={"navn": "gin_trgm_ops"},
            postgresql_using="gin",
        ),
        Index(
            "ix_underenheter_navn_fulltext",
            sa_text("to_tsvector('norwegian'::regconfig, navn)"),
            postgresql_using="gin",
        ),
        Index(
            "ix_underenheter_navn_collate",
            "navn",
            postgresql_where=sa_text("navn IS NOT NULL"),
        ),
        Index(
            "ix_underenheter_parent_org_form",
            "parent_orgnr",
            "organisasjonsform",
        ),
        Index(
            "ix_underenheter_stiftelsesdato",
            "stiftelsesdato",
            postgresql_where=sa_text("stiftelsesdato IS NOT NULL"),
        ),
    )

    orgnr: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    parent_orgnr: Mapped[str] = mapped_column(String, ForeignKey("bedrifter.orgnr"), index=True)
    navn: Mapped[str] = mapped_column(String, index=True)
    organisasjonsform: Mapped[str | None] = mapped_column(String, index=True, nullable=True)  # Example: "BEDR"
    naeringskode: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    antall_ansatte: Mapped[int] = mapped_column(Integer, default=0, index=True)
    beliggenhetsadresse: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )  # Usually distinct from parent's address
    postadresse: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # data = Column(JSONB)  # DB seems to lack this
    # SubUnits often use 'beliggenhetsadresse' etc directly.

    stiftelsesdato: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    parent_company: Mapped["Company"] = relationship("Company", back_populates="underenheter")


class Role(Base):
    """
    Roller (roles) for a company - daglig leder, styreleder, styremedlemmer, revisor, etc.
    Uses on-demand fetching: data is cached locally after first API request.
    """

    __tablename__ = "roller"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    orgnr: Mapped[str] = mapped_column(String, ForeignKey("bedrifter.orgnr"), index=True, nullable=False)

    # Type: e.g. "dagligLeder", "styreleder", "styremedlem", "varamedlem"
    type_kode: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    type_beskrivelse: Mapped[str | None] = mapped_column(String, nullable=True)

    # Person or entity holding the role
    person_navn: Mapped[str | None] = mapped_column(String, nullable=True)
    foedselsdato: Mapped[date | None] = mapped_column(Date, nullable=True)  # Only for persons

    enhet_navn: Mapped[str | None] = mapped_column(String, nullable=True)
    enhet_orgnr: Mapped[str | None] = mapped_column(String, nullable=True)  # For companies holding roles (e.g. auditor)

    # Role status
    fratraadt: Mapped[bool] = mapped_column(Boolean, default=False)
    rekkefoelge: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company: Mapped["Company"] = relationship("Company", back_populates="roller")
