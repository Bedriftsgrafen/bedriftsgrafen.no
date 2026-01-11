"""optimize_financial_indexes

Revision ID: e5bc3fc409fb
Revises: d4ab2eb298ea
Create Date: 2025-12-22 17:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5bc3fc409fb'
down_revision: Union[str, Sequence[str], None] = 'ad4923e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Set isolation level to AUTOCOMMIT for CONCURRENTLY index creation
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))  # Commit any existing transaction

    # 1. Financial Sort Indexes (DESC NULLS LAST) for Materialized View
    # Salgsinntekter
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_revenue_desc "
        "ON latest_financials (salgsinntekter DESC NULLS LAST)"
    )
    # Aarsresultat (Profit)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_profit_desc "
        "ON latest_financials (aarsresultat DESC NULLS LAST)"
    )
    # Driftsresultat (Operating Profit)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_op_profit_desc "
        "ON latest_financials (driftsresultat DESC NULLS LAST)"
    )
    # Egenkapital (Equity)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_financials_equity_desc "
        "ON latest_financials (egenkapital DESC NULLS LAST)"
    )

    # 2. Composite Index for Filter Combinations
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_orgform_nace "
        "ON bedrifter (organisasjonsform, naeringskode)"
    )

    # 3. Covering Index for List Queries (Performance Boost)
    # Includes common columns to avoid heap lookups for list views
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_list_covering "
        "ON bedrifter (navn) "
        "INCLUDE (orgnr, organisasjonsform, naeringskode, antall_ansatte, stiftelsesdato)"
    )

    # 4. Cleanup: Drop confirmed duplicate index
    # ix_bedrifter_last_polled_regnskap is 26MB duplicate
    op.execute("DROP INDEX IF EXISTS ix_bedrifter_last_polled_regnskap")


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))

    op.execute("DROP INDEX IF EXISTS idx_latest_financials_revenue_desc")
    op.execute("DROP INDEX IF EXISTS idx_latest_financials_profit_desc")
    op.execute("DROP INDEX IF EXISTS idx_latest_financials_op_profit_desc")
    op.execute("DROP INDEX IF EXISTS idx_latest_financials_equity_desc")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_orgform_nace")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_list_covering")
    
    # Restore the dropped index (though it was redundant)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bedrifter_last_polled_regnskap "
        "ON bedrifter (last_polled_regnskap)"
    )
