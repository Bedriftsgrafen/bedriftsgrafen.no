from __future__ import annotations

import enum
from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SyncErrorStatus(enum.StrEnum):
    PENDING = "pending"
    RETRYING = "retrying"
    RESOLVED = "resolved"
    PERMANENT_FAILURE = "permanent_failure"


class SyncError(Base):
    """
    Tracks failed synchronization attempts for companies, subunits, and roles.
    Allows for automated retries and auditing of data gaps.
    """

    __tablename__ = "sync_errors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    orgnr: Mapped[str] = mapped_column(String, index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String, index=True, nullable=False)  # 'company', 'subunit', 'role'
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=SyncErrorStatus.PENDING.value, index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    last_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
