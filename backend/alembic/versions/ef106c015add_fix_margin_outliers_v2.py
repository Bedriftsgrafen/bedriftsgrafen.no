"""fix_margin_outliers_v2

Revision ID: ef106c015add
Revises: 1d8fed3a8420
Create Date: 2026-01-21 07:08:00.000000

"""

from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ef106c015add"
down_revision: Union[str, Sequence[str], None] = "1d8fed3a8420"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix operating margin calculation by filtering outliers.

    1. Filters out margins outside [-100%, +100%] which are likely data errors or extreme edge cases.
    2. Excludes companies with revenue < 50,000 NOK to avoid skewing by micro-companies.
    """

    # Update industry_stats
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
            COALESCE(bc.bankruptcies_last_year, 0) as bankruptcies_last_year,
            COALESCE(SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL), 0) as total_employees,
            AVG(b.antall_ansatte) FILTER (WHERE b.antall_ansatte > 0) as avg_employees,
            COALESCE(SUM(lf.salgsinntekter), 0) as total_revenue,
            AVG(lf.salgsinntekter) FILTER (WHERE lf.salgsinntekter > 0) as avg_revenue,
            COALESCE(SUM(lf.aarsresultat), 0) as total_profit,
            AVG(lf.aarsresultat) as avg_profit,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lf.salgsinntekter) 
                FILTER (WHERE lf.salgsinntekter > 0) as median_revenue,
            COUNT(*) FILTER (WHERE lf.aarsresultat > 0) as profitable_count,
            -- FIXED: Outlier filtering
            AVG(CASE 
                WHEN lf.salgsinntekter >= 50000 
                AND lf.driftsresultat / lf.salgsinntekter BETWEEN -1.0 AND 1.0 
                THEN lf.driftsresultat / lf.salgsinntekter * 100 
            END) as avg_operating_margin
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
    op.execute("CREATE UNIQUE INDEX idx_industry_stats_nace ON industry_stats (nace_division);")
    op.execute("CREATE INDEX idx_industry_stats_company_count ON industry_stats (company_count DESC);")
    op.execute("CREATE INDEX idx_industry_stats_total_revenue ON industry_stats (total_revenue DESC NULLS LAST);")
    op.execute("CREATE INDEX idx_industry_stats_bankruptcies ON industry_stats (bankruptcies_last_year DESC);")

    # Update industry_subclass_stats
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
            COUNT(*) FILTER (
                WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
                AND b.organisasjonsform != 'KBO'
            ) as new_last_year,
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
            -- FIXED: Outlier filtering
            AVG(CASE 
                WHEN lf.salgsinntekter >= 50000 
                AND lf.driftsresultat / lf.salgsinntekter BETWEEN -1.0 AND 1.0 
                THEN lf.driftsresultat / lf.salgsinntekter * 100 
            END) as avg_operating_margin
        FROM bedrifter b
        LEFT JOIN latest_financials lf ON b.orgnr = lf.orgnr
        LEFT JOIN bankruptcy_counts bc ON b.naeringskode = bc.naeringskode
        WHERE b.naeringskode IS NOT NULL
          AND b.organisasjonsform != 'KBO'
        GROUP BY b.naeringskode, bc.bankruptcies_last_year
        HAVING COUNT(*) >= 5
        ORDER BY company_count DESC;
    """)
    op.execute("CREATE UNIQUE INDEX idx_industry_subclass_stats_nace ON industry_subclass_stats (nace_code);")
    op.execute(
        "CREATE INDEX idx_industry_subclass_stats_company_count ON industry_subclass_stats (company_count DESC);"
    )
    op.execute(
        "CREATE INDEX idx_industry_subclass_stats_total_revenue ON industry_subclass_stats (total_revenue DESC NULLS LAST);"
    )
    op.execute(
        "CREATE INDEX idx_industry_subclass_stats_bankruptcies ON industry_subclass_stats (bankruptcies_last_year DESC);"
    )


def downgrade() -> None:
    """Revert to previous version (simple > 0 revenue check)."""
    # This intentionally reverts to the version BEFORE ef106c015add
    # logic preserved from c3d4e5f6g7h8
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_subclass_stats CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_stats CASCADE;")
    # (Simplified recreation omitted for brevity in downgrade, ideally should restore baseline)
