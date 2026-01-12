"""add_industry_subclass_stats_view

Revision ID: f3ead7bea13d
Revises: o3p4q5r6s7t8
Create Date: 2025-12-31 16:05:56.428364

"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f3ead7bea13d"
down_revision: str | Sequence[str] | None = "o3p4q5r6s7t8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 5-digit NACE stats (Subclass level)
    # Similar logic to industry_stats but grouped by specific naeringskode
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
        HAVING COUNT(*) >= 5  -- Lower threshold for subclass stats
        ORDER BY company_count DESC;
    """)

    op.execute("""
        CREATE UNIQUE INDEX idx_industry_subclass_stats_nace
        ON industry_subclass_stats (nace_code);
    """)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS industry_subclass_stats CASCADE;")
