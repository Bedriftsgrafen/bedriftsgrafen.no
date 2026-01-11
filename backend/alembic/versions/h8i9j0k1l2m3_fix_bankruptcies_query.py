"""Fix bankruptcies_last_year in industry_stats view

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2025-12-23 14:15:00.000000

Bug fix: The WHERE clause excluded konkurs=true companies, 
but we still need to count them for bankruptcies_last_year.
Solution: Use a separate subquery for bankruptcy counts.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, Sequence[str], None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop and recreate materialized view with fixed bankruptcy counting
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_stats CASCADE;")
    
    # Solution: Use LEFT JOIN with a subquery for bankruptcy counts
    # since the main query excludes konkurs=true companies
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
            -- New companies: exclude KBO (konkursbo)
            COUNT(*) FILTER (
                WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
                AND b.organisasjonsform != 'KBO'
            ) as new_last_year,
            -- Bankruptcies from separate subquery
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
        LEFT JOIN bankruptcy_counts bc ON LEFT(b.naeringskode, 2) = bc.nace_division
        WHERE b.naeringskode IS NOT NULL
          AND b.konkurs IS NOT TRUE
          AND b.under_avvikling IS NOT TRUE
          AND b.under_tvangsavvikling IS NOT TRUE
        GROUP BY LEFT(b.naeringskode, 2), bc.bankruptcies_last_year
        HAVING COUNT(*) >= 10
        ORDER BY company_count DESC;
    """)
    
    # Recreate index
    op.execute("""
        CREATE UNIQUE INDEX idx_industry_stats_nace 
        ON industry_stats (nace_division);
    """)


def downgrade() -> None:
    # Revert to buggy version (just in case)
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_stats CASCADE;")
    
    op.execute("""
        CREATE MATERIALIZED VIEW industry_stats AS
        SELECT
            LEFT(b.naeringskode, 2) as nace_division,
            COUNT(*) as company_count,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            COUNT(*) FILTER (
                WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
                AND b.organisasjonsform != 'KBO'
            ) as new_last_year,
            COUNT(*) FILTER (
                WHERE b.konkursdato >= CURRENT_DATE - INTERVAL '1 year'
                AND b.konkurs = true
            ) as bankruptcies_last_year,
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
        WHERE b.naeringskode IS NOT NULL
          AND b.konkurs IS NOT TRUE
          AND b.under_avvikling IS NOT TRUE
          AND b.under_tvangsavvikling IS NOT TRUE
        GROUP BY LEFT(b.naeringskode, 2)
        HAVING COUNT(*) >= 10
        ORDER BY company_count DESC;
    """)
    
    op.execute("""
        CREATE UNIQUE INDEX idx_industry_stats_nace 
        ON industry_stats (nace_division);
    """)
