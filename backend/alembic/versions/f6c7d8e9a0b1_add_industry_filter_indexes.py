"""add_industry_filter_indexes

Revision ID: f6c7d8e9a0b1
Revises: a1b2c3d4e5f6
Create Date: 2025-12-23 13:20:00.000000

Add indexes to optimize industry statistics and new company queries:
- naeringskode prefix index for LIKE queries (2-digit NACE division filtering)
- stiftelsesdato index for new company queries
- konkursdato index for bankruptcy date filtering
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f6c7d8e9a0b1"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Set isolation level to AUTOCOMMIT for CONCURRENTLY index creation
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))

    # 1. NACE Code Prefix Index (for industry filtering like '68%')
    # Supports queries like: WHERE naeringskode LIKE '68%'
    # Uses btree with text_pattern_ops for LIKE prefix matching
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_naeringskode_prefix "
        "ON bedrifter (naeringskode text_pattern_ops)"
    )

    # 2. Stiftelsesdato Index (for new company queries)
    # Supports queries like: WHERE stiftelsesdato >= '2024-12-23'
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_stiftelsesdato "
        "ON bedrifter (stiftelsesdato DESC NULLS LAST)"
    )

    # 3. Konkursdato Index (for bankruptcy date filtering)
    # Supports date range queries on konkursdato
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_konkursdato "
        "ON bedrifter (konkursdato DESC NULLS LAST) WHERE konkursdato IS NOT NULL"
    )

    # 4. Composite index for industry + date queries
    # Supports: companies in industry X founded in the last year
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_nace_founded "
        "ON bedrifter (naeringskode, stiftelsesdato DESC NULLS LAST)"
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))

    op.execute("DROP INDEX IF EXISTS idx_bedrifter_naeringskode_prefix")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_stiftelsesdato")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_konkursdato")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_nace_founded")
