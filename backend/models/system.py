from sqlalchemy import BigInteger, CheckConstraint, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from database import Base


class DashboardStats(Base):
    __tablename__ = "dashboard_stats"

    id = Column(Integer, primary_key=True, server_default="1")
    total_employees = Column(BigInteger, default=0)
    new_companies_ytd = Column(Integer, default=0)
    bankruptcies = Column(Integer, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (CheckConstraint("id = 1", name="dashboard_stats_id_check"),)


class OrgFormCounts(Base):
    __tablename__ = "orgform_counts"

    kode = Column(String(10), primary_key=True)
    count = Column(Integer, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SystemState(Base):
    __tablename__ = "system_state"

    key = Column(String(50), primary_key=True)
    value = Column(String(255))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
