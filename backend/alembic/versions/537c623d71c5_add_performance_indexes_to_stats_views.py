"""add_performance_indexes_to_stats_views

Revision ID: 537c623d71c5
Revises: f3ead7bea13d
Create Date: 2025-12-31 21:09:08.075631

"""
from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '537c623d71c5'
down_revision: str | Sequence[str] | None = 'f3ead7bea13d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add performance indexes to industry stats materialized views.

    These indexes optimize common query patterns:
    - Sorting by company_count DESC (most common sort)
    - Sorting by total_revenue DESC (financial comparisons)
    - Sorting by bankruptcies_last_year DESC (risk analysis)

    Using DESC order matches typical query patterns and enables index-only scans.
    """
    # Indexes for industry_stats (2-digit NACE division)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_industry_stats_company_count
        ON industry_stats (company_count DESC);
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_industry_stats_total_revenue
        ON industry_stats (total_revenue DESC NULLS LAST);
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_industry_stats_bankruptcies
        ON industry_stats (bankruptcies_last_year DESC);
    """)

    # Indexes for industry_subclass_stats (5-digit NACE code)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_industry_subclass_stats_company_count
        ON industry_subclass_stats (company_count DESC);
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_industry_subclass_stats_total_revenue
        ON industry_subclass_stats (total_revenue DESC NULLS LAST);
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_industry_subclass_stats_bankruptcies
        ON industry_subclass_stats (bankruptcies_last_year DESC);
    """)


def downgrade() -> None:
    """Remove performance indexes from industry stats materialized views."""
    # Drop indexes for industry_subclass_stats
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_industry_subclass_stats_bankruptcies;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_industry_subclass_stats_total_revenue;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_industry_subclass_stats_company_count;")

    # Drop indexes for industry_stats
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_industry_stats_bankruptcies;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_industry_stats_total_revenue;")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_industry_stats_company_count;")
