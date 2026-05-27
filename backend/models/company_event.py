from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, Text
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from database import Base


class CompanyEventType(enum.StrEnum):
    COMPANY_REGISTERED = "company_registered"
    COMPANY_DELETED = "company_deleted"
    ACCOUNTING_ADDED = "accounting_added"


class CompanyEvent(Base):
    """Durable event ledger for company activity observed by Bedriftsgrafen."""

    __tablename__ = "company_events"

    __table_args__ = (
        CheckConstraint("orgnr ~ '^[0-9]{9}$'", name="ck_company_events_orgnr_9_digits"),
        Index("idx_company_events_event_key", "event_key", unique=True),
        Index("idx_company_events_orgnr_observed_id", "orgnr", sa_text("observed_at DESC"), sa_text("id DESC")),
        Index(
            "idx_company_events_type_observed_id",
            "event_type",
            sa_text("observed_at DESC"),
            sa_text("id DESC"),
        ),
        Index("idx_company_events_observed_brin", "observed_at", postgresql_using="brin"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    orgnr: Mapped[str] = mapped_column(String(9), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(128), nullable=False)
    source_update_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    event_key: Mapped[str] = mapped_column(String(255), nullable=False)

    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    previous_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
