"""restore_industry_stats

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6a7
Create Date: 2026-01-06 14:40:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6g7h8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Restore industry_stats and industry_subclass_stats views.
    
    These views were accidentally dropped by a CASCADE operation in a previous migration.
    This migration:
    1. Recreates 'industry_stats' with all required columns (including bankruptcies_last_year).
    2. Recreates 'industry_subclass_stats'.
    3. Restores all performance indexes.
    4. Improves null handling with COALESCE.
    """
    
    # ---------------------------------------------------------
    # 1. Restore industry_stats (2-digit NACE)
    # ---------------------------------------------------------
    
    # Clean up safely (No CASCADE unless necessary, but we are restoring)
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_stats CASCADE;")

    op.execute("""
        CREATE MATERIALIZED VIEW industry_stats AS
        WITH bankruptcy_counts AS (
            SELECT 
                LEFT(naeringskode, 2) as nace_division,
                COUNT(*) as bankruptcies_last_year
            FROM bedrifter
            WHERE konkurs = true 
              AND konkursdato >= CURRENT_DATE - INTERVAL '1 year'
              AND naeringskode IS NOT NULL
            GROUP BY LEFT(naeringskode, 2)
        )
        SELECT
            LEFT(b.naeringskode, 2) as nace_division,
            COUNT(*) as company_count,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            COUNT(*) FILTER (WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year') as new_last_year,
            
            -- Bankruptcies last year (Joined from CTE)
            COALESCE(bc.bankruptcies_last_year, 0) as bankruptcies_last_year,
            
            COALESCE(SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL), 0) as total_employees,
            AVG(b.antall_ansatte) FILTER (WHERE b.antall_ansatte > 0) as avg_employees,
            
            -- Financials (Safe Coalescing)
            COALESCE(SUM(lf.salgsinntekter), 0) as total_revenue,
            AVG(lf.salgsinntekter) FILTER (WHERE lf.salgsinntekter > 0) as avg_revenue,
            
            COALESCE(SUM(lf.aarsresultat), 0) as total_profit,
            AVG(lf.aarsresultat) as avg_profit,
            
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lf.salgsinntekter) 
                FILTER (WHERE lf.salgsinntekter > 0) as median_revenue,
                
            COUNT(*) FILTER (WHERE lf.aarsresultat > 0) as profitable_count,
            
            AVG(CASE WHEN lf.salgsinntekter > 0 THEN lf.driftsresultat / lf.salgsinntekter * 100 END) as avg_operating_margin
            
        FROM bedrifter b
        LEFT JOIN latest_financials lf ON b.orgnr = lf.orgnr
        LEFT JOIN bankruptcy_counts bc ON LEFT(b.naeringskode, 2) = bc.nace_division
        WHERE b.naeringskode IS NOT NULL
          AND b.konkurs IS NOT TRUE
          AND b.under_avvikling IS NOT TRUE
          AND b.under_tvangsavvikling IS NOT TRUE
        GROUP BY LEFT(b.naeringskode, 2), bc.bankruptcies_last_year
        HAVING COUNT(*) >= 10
        ORDER BY company_count DESC;
    """)

    # Unique index for concurrent refresh
    op.execute("""
        CREATE UNIQUE INDEX idx_industry_stats_nace 
        ON industry_stats (nace_division);
    """)

    # ---------------------------------------------------------
    # 2. Restore industry_subclass_stats (5-digit NACE)
    # ---------------------------------------------------------
    
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_subclass_stats CASCADE;")

    op.execute("""
        CREATE MATERIALIZED VIEW industry_subclass_stats AS
        WITH bankruptcy_counts AS (
            SELECT
                naeringskode,
                COUNT(*) as bankruptcies_last_year
            FROM bedrifter
            WHERE konkurs = true
              AND konkursdato >= CURRENT_DATE - INTERVAL '1 year'
              AND naeringskode IS NOT NULL
              AND organisasjonsform != 'KBO'
            GROUP BY naeringskode
        )
        SELECT
            b.naeringskode as nace_code,
            COUNT(*) as company_count,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            -- New companies: exclude only KBO
            COUNT(*) FILTER (
                WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
                AND b.organisasjonsform != 'KBO'
            ) as new_last_year,
            -- Bankruptcies
            COALESCE(bc.bankruptcies_last_year, 0) as bankruptcies_last_year,
            SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) as total_employees,
            AVG(b.antall_ansatte) FILTER (WHERE b.antall_ansatte > 0) as avg_employees,
            SUM(lf.salgsinntekter) as total_revenue,
            AVG(lf.salgsinntekter) FILTER (WHERE lf.salgsinntekter > 0) as avg_revenue,
            SUM(lf.aarsresultat) as total_profit,
            AVG(lf.aarsresultat) as avg_profit,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lf.salgsinntekter)
                FILTER (WHERE lf.salgsinntekter > 0) as median_revenue,
            COUNT(*) FILTER (WHERE lf.aarsresultat > 0) as profitable_count,
            AVG(CASE WHEN lf.salgsinntekter > 0 THEN lf.driftsresultat / lf.salgsinntekter * 100 END) as avg_operating_margin
        FROM bedrifter b
        LEFT JOIN latest_financials lf ON b.orgnr = lf.orgnr
        LEFT JOIN bankruptcy_counts bc ON b.naeringskode = bc.naeringskode
        WHERE b.naeringskode IS NOT NULL
          AND b.organisasjonsform != 'KBO'
        GROUP BY b.naeringskode, bc.bankruptcies_last_year
        HAVING COUNT(*) >= 5
        ORDER BY company_count DESC;
    """)

    op.execute("""
        CREATE UNIQUE INDEX idx_industry_subclass_stats_nace
        ON industry_subclass_stats (nace_code);
    """)

    # ---------------------------------------------------------
    # 3. Restore Performance Indexes
    # ---------------------------------------------------------

    # Indexes for industry_stats
    op.execute("CREATE INDEX idx_industry_stats_company_count ON industry_stats (company_count DESC);")
    op.execute("CREATE INDEX idx_industry_stats_total_revenue ON industry_stats (total_revenue DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_industry_stats_bankruptcies ON industry_stats (bankruptcies_last_year DESC);")

    # Indexes for industry_subclass_stats
    op.execute("CREATE INDEX idx_industry_subclass_stats_company_count ON industry_subclass_stats (company_count DESC);")
    op.execute("CREATE INDEX idx_industry_subclass_stats_total_revenue ON industry_subclass_stats (total_revenue DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_industry_subclass_stats_bankruptcies ON industry_subclass_stats (bankruptcies_last_year DESC);")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_subclass_stats CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_stats CASCADE;")
