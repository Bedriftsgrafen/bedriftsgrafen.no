from datetime import datetime
from sqlalchemy import BigInteger, CheckConstraint, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from database import Base


class DashboardStats(Base):
    __tablename__ = "dashboard_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, server_default="1")
    total_employees: Mapped[int] = mapped_column(BigInteger, default=0)
    new_companies_ytd: Mapped[int] = mapped_column(Integer, default=0)
    bankruptcies: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (CheckConstraint("id = 1", name="dashboard_stats_id_check"),)


class OrgFormCounts(Base):
    __tablename__ = "orgform_counts"

    kode: Mapped[str] = mapped_column(String(10), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class SystemState(Base):
    __tablename__ = "system_state"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str | None] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
