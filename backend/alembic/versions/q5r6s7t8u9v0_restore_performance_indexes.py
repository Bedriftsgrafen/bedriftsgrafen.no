"""restore_performance_indexes

Revision ID: q5r6s7t8u9v0
Revises: 20d47b99003d
Create Date: 2026-01-05 14:51:00.000000

Restore critical performance indexes dropped/missing after schema refactor.
Focus on financial sort indexes and NACE pattern matching.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'q5r6s7t8u9v0'
down_revision: Union[str, Sequence[str], None] = '20d47b99003d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add performance indexes for financial sorts and common query patterns."""
    # Commit any existing transaction for CONCURRENTLY
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))

    # =========================================================================
    # LATEST_FINANCIALS - Financial Sort Indexes (DESC NULLS LAST)
    # Critical for /v1/companies?sort_by=revenue|profit|operating_profit
    # =========================================================================
    
    # Drop the existing ASC index (wrong direction for our queries)
    op.execute("DROP INDEX IF EXISTS idx_latest_financials_salgsinntekter")
    
    # Revenue DESC - most common sort
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_revenue_desc "
        "ON latest_financials (salgsinntekter DESC NULLS LAST)"
    )
    
    # Profit DESC
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_profit_desc "
        "ON latest_financials (aarsresultat DESC NULLS LAST)"
    )
    
    # Operating Profit DESC
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_op_profit_desc "
        "ON latest_financials (driftsresultat DESC NULLS LAST)"
    )
    
    # Equity DESC (for equity filter/sort)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_equity_desc "
        "ON latest_financials (egenkapital DESC NULLS LAST)"
    )

    # =========================================================================
    # BEDRIFTER - Pattern/Prefix Matching Index
    # For NACE code LIKE 'XX%' queries (industry filtering)
    # =========================================================================
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_naeringskode_pattern "
        "ON bedrifter (naeringskode text_pattern_ops)"
    )

    # =========================================================================
    # BEDRIFTER - Composite Indexes for Common Filter+Sort Combinations
    # =========================================================================
    
    # Composite: naeringskode + ansatte DESC (industry page sorted by employees)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_nace_ansatte "
        "ON bedrifter (naeringskode, antall_ansatte DESC NULLS LAST)"
    )
    
    # Composite: naeringskode + stiftelsesdato DESC (new companies in industry)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_nace_stiftelse "
        "ON bedrifter (naeringskode, stiftelsesdato DESC NULLS LAST)"
    )
    
    # Composite: organisasjonsform + ansatte DESC (org form filtered, sorted by size)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_orgform_ansatte "
        "ON bedrifter (organisasjonsform, antall_ansatte DESC NULLS LAST)"
    )
    
    # Composite: organisasjonsform + naeringskode (filter by both)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_orgform_nace "
        "ON bedrifter (organisasjonsform, naeringskode)"
    )

    # =========================================================================
    # BEDRIFTER - Covering Index for List View (avoids heap lookups)
    # =========================================================================
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_list_covering "
        "ON bedrifter (navn) "
        "INCLUDE (orgnr, organisasjonsform, naeringskode, antall_ansatte, stiftelsesdato)"
    )

    # =========================================================================
    # REGNSKAP - Financial Record Indexes
    # =========================================================================
    
    # Index for latest year lookup per company
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regnskap_orgnr_aar "
        "ON regnskap (orgnr, aar DESC)"
    )
    
    # Salgsinntekter index for filtering by revenue range
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regnskap_salgsinntekter "
        "ON regnskap (salgsinntekter DESC NULLS LAST) WHERE salgsinntekter IS NOT NULL"
    )


def downgrade() -> None:
    """Remove the performance indexes."""
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))

    # latest_financials
    op.execute("DROP INDEX IF EXISTS idx_latest_financials_revenue_desc")
    op.execute("DROP INDEX IF EXISTS idx_latest_financials_profit_desc")
    op.execute("DROP INDEX IF EXISTS idx_latest_financials_op_profit_desc")
    op.execute("DROP INDEX IF EXISTS idx_latest_financials_equity_desc")
    
    # Restore original ASC index
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_salgsinntekter "
        "ON latest_financials (salgsinntekter)"
    )
    
    # bedrifter
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_naeringskode_pattern")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_nace_ansatte")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_nace_stiftelse")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_orgform_ansatte")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_orgform_nace")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_list_covering")
    
    # regnskap
    op.execute("DROP INDEX IF EXISTS idx_regnskap_orgnr_aar")
    op.execute("DROP INDEX IF EXISTS idx_regnskap_salgsinntekter")
