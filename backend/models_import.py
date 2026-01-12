import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped

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

    orgnr: Mapped[str] = Column(String, primary_key=True, index=True)
    status: Mapped[ImportStatus] = Column(SQLEnum(ImportStatus), default=ImportStatus.PENDING, index=True)
    priority = Column(Integer, default=0, index=True)  # Higher = more important

    # Timestamps
    queued_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Tracking
    attempt_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)

    # Results
    company_fetched = Column(Integer, default=0)  # 0 or 1
    financials_count = Column(Integer, default=0)  # Number of years imported


class ImportBatch(Base):
    """
    Track batches of imports for monitoring and statistics
    """

    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_name = Column(String, index=True)

    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Statistics
    total_companies = Column(Integer, default=0)
    completed_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)

    # Progress tracking
    companies_per_hour = Column(Integer, default=0)
    estimated_completion = Column(DateTime, nullable=True)
