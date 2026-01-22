import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class ImportStatus(str, enum.Enum):
    """Status of bulk import for a company"""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class BulkImportQueue(Base):
    """
    Queue table for tracking bulk import of companies
    Allows resumable, distributed processing
    """

    __tablename__ = "bulk_import_queue"

    orgnr: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    status: Mapped[ImportStatus] = mapped_column(SQLEnum(ImportStatus), default=ImportStatus.PENDING, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=0, index=True)  # Higher = more important

    # Timestamps
    queued_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Tracking
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Results
    company_fetched: Mapped[int] = mapped_column(Integer, default=0)  # 0 or 1
    financials_count: Mapped[int] = mapped_column(Integer, default=0)  # Number of years imported


class ImportBatch(Base):
    """
    Track batches of imports for monitoring and statistics
    """

    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_name: Mapped[str] = mapped_column(String, index=True)

    # Timestamps
    started_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Statistics
    total_companies: Mapped[int] = mapped_column(Integer, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)

    # Progress tracking
    companies_per_hour: Mapped[int] = mapped_column(Integer, default=0)
    estimated_completion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
