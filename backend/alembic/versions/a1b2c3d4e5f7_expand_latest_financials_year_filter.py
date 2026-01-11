"""expand_latest_financials_year_filter

Revision ID: a1b2c3d4e5f7
Revises: 4cafaf285162
Create Date: 2026-01-06 14:01:10.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, Sequence[str], None] = '4cafaf285162'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Expand year filter in latest_financials to include 2023+ data.
    
    The previous filter (CURRENT_YEAR - 1) only included 2025+ data,
    excluding most companies' 2023/2024 accounting records.
    """
    
    # 1. Drop existing view and indexes
    op.execute("DROP MATERIALIZED VIEW IF EXISTS latest_financials CASCADE;")
    
    # 2. Recreate view with expanded year filter (3 years back instead of 1)
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
        WHERE r.aar >= (EXTRACT(YEAR FROM CURRENT_DATE) - 3)  -- Changed from -1 to -3
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
    op.execute("CREATE INDEX idx_latest_financials_margin_desc ON latest_financials (operating_margin DESC NULLS LAST);")


def downgrade() -> None:
    """Revert to previous year filter (CURRENT_YEAR - 1)."""
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
            r.egenkapitalandel,
            CASE 
                WHEN r.salgsinntekter > 0 
                THEN (r.driftsresultat::numeric / r.salgsinntekter * 100) 
                ELSE NULL 
            END as operating_margin
        FROM regnskap r
        WHERE r.aar >= (EXTRACT(YEAR FROM CURRENT_DATE) - 1)
        ORDER BY r.orgnr, r.aar DESC;
    """)
    
    op.execute("CREATE UNIQUE INDEX idx_latest_financials_orgnr ON latest_financials (orgnr);")
    op.execute("CREATE INDEX idx_latest_financials_revenue_desc ON latest_financials (salgsinntekter DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_profit_desc ON latest_financials (aarsresultat DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_op_profit_desc ON latest_financials (driftsresultat DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_equity_desc ON latest_financials (egenkapital DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_latest_financials_margin_desc ON latest_financials (operating_margin DESC NULLS LAST);")
