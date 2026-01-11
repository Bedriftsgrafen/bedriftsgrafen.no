"""add_operating_margin_to_latest_financials

Revision ID: ff2f220780cb
Revises: 42d2781397f8
Create Date: 2026-01-06 09:24:09.929188

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'ff2f220780cb'
down_revision: Union[str, Sequence[str], None] = '42d2781397f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add operating_margin column to latest_financials materialized view."""
    
    # 1. Drop existing view and indexes
    op.execute("DROP MATERIALIZED VIEW IF EXISTS latest_financials CASCADE;")
    
    # 2. Recreate view with operating_margin column
    # Note: We filter for recent years (current year - 1) to keep the view small and fast
    op.execute("""
        CREATE MATERIALIZED VIEW latest_financials AS
        SELECT DISTINCT ON (r.orgnr) 
            r.orgnr,
            r.aar,
            r.salgsinntekter,
            r.aarsresultat,
            r.egenkapital,
            r.driftsresultat,
            r.likviditetsgrad1 AS likviditetsgrad,
            r.egenkapitalandel,
            -- Computed Operating Margin
            CASE 
                WHEN r.salgsinntekter > 0 
                THEN (r.driftsresultat::numeric / r.salgsinntekter * 100) 
                ELSE NULL 
            END as operating_margin
        FROM regnskap r
        WHERE r.aar >= (EXTRACT(YEAR FROM CURRENT_DATE) - 1)
        ORDER BY r.orgnr, r.aar DESC;
    """)
    
    # 3. Recreate Indexes
    # Unique index for concurrent refresh
    op.execute("CREATE UNIQUE INDEX idx_latest_financials_orgnr ON latest_financials (orgnr);")
    
    # Performance indexes for sorting/filtering
    op.execute("CREATE INDEX idx_latest_financials_revenue_desc ON latest_financials (salgsinntekter DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_profit_desc ON latest_financials (aarsresultat DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_op_profit_desc ON latest_financials (driftsresultat DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_equity_desc ON latest_financials (egenkapital DESC NULLS LAST);")
    
    # [NEW] Index for operating margin sorting
    op.execute("CREATE INDEX idx_latest_financials_margin_desc ON latest_financials (operating_margin DESC NULLS LAST);")


def downgrade() -> None:
    """Revert validation view to previous state."""
    op.execute("DROP MATERIALIZED VIEW IF EXISTS latest_financials CASCADE;")
    
    op.execute("""
        CREATE MATERIALIZED VIEW latest_financials AS
        SELECT DISTINCT ON (r.orgnr) 
            r.orgnr,
            r.aar,
            r.salgsinntekter,
            r.aarsresultat,
            r.egenkapital,
            r.driftsresultat,
            r.likviditetsgrad1 AS likviditetsgrad,
            r.egenkapitalandel
        FROM regnskap r
        WHERE r.aar >= (EXTRACT(YEAR FROM CURRENT_DATE) - 1)
        ORDER BY r.orgnr, r.aar DESC;
    """)
    
    op.execute("CREATE UNIQUE INDEX idx_latest_financials_orgnr ON latest_financials (orgnr);")
    op.execute("CREATE INDEX idx_latest_financials_revenue_desc ON latest_financials (salgsinntekter DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_profit_desc ON latest_financials (aarsresultat DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_op_profit_desc ON latest_financials (driftsresultat DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_equity_desc ON latest_financials (egenkapital DESC NULLS LAST);")
