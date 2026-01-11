"""add_missing_stats_views

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f7
Create Date: 2026-01-06 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing stats views and tables required by the application.
    
    PERFORMANCE CRITICAL: 
    Materialized views MUST have a unique index to support REFRESH MATERIALIZED VIEW CONCURRENTLY.
    Without this, refreshing the view locks it, causing dashboard downtime.
    since 'company_totals' is a single-row aggregate, we inject a dummy ID.
    """
    
    # 1. Create company_totals materialized view
    # Used by stats.get_aggregate_stats (fast path)
    
    # Cleanup previous definitions if they exist
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'company_totals' AND c.relkind = 'r') THEN
                DROP TABLE company_totals CASCADE;
            ELSIF EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'company_totals' AND c.relkind = 'm') THEN
                DROP MATERIALIZED VIEW company_totals CASCADE;
            END IF;
        END $$;
    """)
    
    # Create view with dummy ID for unique index
    # Note: We use COALESCE(..., 0) to ensure we return 0 instead of NULL when no data matches,
    # protecting the frontend from runtime type errors.
    op.execute("""
        CREATE MATERIALIZED VIEW company_totals AS
        SELECT
            1 as id, -- Required for UNIQUE INDEX to support REFRESH MATERIALIZED VIEW CONCURRENTLY
            COUNT(*) as total_count,
            COALESCE(SUM(lf.salgsinntekter), 0) as total_revenue,
            COALESCE(SUM(lf.aarsresultat), 0) as total_profit,
            COALESCE(SUM(c.antall_ansatte), 0) as total_employees
        FROM bedrifter c
        LEFT JOIN latest_financials lf ON c.orgnr = lf.orgnr;
    """)
    
    # CRITICAL: Unique index allows concurrent refresh
    # Since 'id' is a constant 1, this index is valid implies the view has exactly 1 row.
    op.execute("CREATE UNIQUE INDEX idx_company_totals_id ON company_totals (id);")

    # 2. Create orgform_counts materialized view
    # Used by stats.count_companies (optimization)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'orgform_counts' AND c.relkind = 'r') THEN
                DROP TABLE orgform_counts CASCADE;
            ELSIF EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'orgform_counts' AND c.relkind = 'm') THEN
                DROP MATERIALIZED VIEW orgform_counts CASCADE;
            END IF;
        END $$;
    """)

    op.execute("""
        CREATE MATERIALIZED VIEW orgform_counts AS
        SELECT organisasjonsform as kode, COUNT(*) as count
        FROM bedrifter
        GROUP BY organisasjonsform
        ORDER BY count DESC;
    """)
    # Unique index on grouping key allows concurrent refresh
    op.execute("CREATE UNIQUE INDEX idx_orgform_counts_kode ON orgform_counts (kode);")

    # 3. Create dashboard_stats table
    # Used by stats.get_total_employees, get_new_companies_ytd, get_bankruptcies_count
    # This is a mutable cache table. We drop it first to ensure a clean state if migration is re-run.
    
    op.execute("DROP TABLE IF EXISTS dashboard_stats CASCADE;")
    
    op.create_table(
        'dashboard_stats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('total_employees', sa.Integer(), server_default='0', nullable=True),
        sa.Column('new_companies_ytd', sa.Integer(), server_default='0', nullable=True),
        sa.Column('bankruptcies', sa.Integer(), server_default='0', nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Insert default row 1 so updates can simply work
    # We use ON CONFLICT DO NOTHING just in case, though the DROP above makes it redundant.
    # It serves as documentation that we expect only one row.
    op.execute("""
        INSERT INTO dashboard_stats (id, total_employees, new_companies_ytd, bankruptcies) 
        VALUES (1, 0, 0, 0)
        ON CONFLICT (id) DO NOTHING;
    """)


def downgrade() -> None:
    """Drop the views and table."""
    op.execute("DROP MATERIALIZED VIEW IF EXISTS company_totals;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS orgform_counts;")
    op.drop_table('dashboard_stats')
