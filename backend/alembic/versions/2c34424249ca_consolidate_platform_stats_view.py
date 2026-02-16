"""consolidate_platform_stats_view

Revision ID: 2c34424249ca
Revises: bed911bb1f68
Create Date: 2026-02-16 10:07:11.081171

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "2c34424249ca"
down_revision: Union[str, Sequence[str], None] = "bed911bb1f68"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Consolidate all platform statistics into the company_totals materialized view."""
    op.execute("DROP MATERIALIZED VIEW IF EXISTS company_totals CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW company_totals AS
        WITH role_stats AS (
            SELECT COUNT(*) AS total_roles FROM roller
        ),
        geocoded AS (
            SELECT COUNT(*) as geocoded_count FROM bedrifter WHERE latitude IS NOT NULL
        ),
        new_companies AS (
            SELECT COUNT(*) as new_companies_30d FROM bedrifter WHERE stiftelsesdato >= CURRENT_DATE - INTERVAL '30 days'
        ),
        financials AS (
            SELECT
                COALESCE(SUM(la.salgsinntekter), 0) as total_revenue,
                COALESCE(SUM(COALESCE(la.driftsresultat, 0) + COALESCE(la.avskrivninger, 0)), 0) as total_ebitda,
                COALESCE(COUNT(CASE WHEN la.aarsresultat > 0 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100, 0) as profitable_percentage,
                COALESCE(COUNT(CASE WHEN lf.egenkapitalandel > 0.2 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100, 0) as solid_company_percentage,
                COALESCE(AVG(
                    CASE WHEN la.total_inntekt > 0
                    THEN (la.driftsresultat::float / la.total_inntekt) * 100
                    ELSE NULL END
                ), 0) as avg_operating_margin,
                COALESCE(SUM(la.aarsresultat), 0) as total_profit
            FROM latest_accountings la
            LEFT JOIN latest_financials lf ON la.orgnr = lf.orgnr
        ),
        counts AS (
            SELECT COUNT(*) as total_count, COALESCE(SUM(antall_ansatte), 0) as total_employees FROM bedrifter
        )
        SELECT
            1 as id,
            c.total_count,
            f.total_revenue,
            f.total_profit,
            c.total_employees,
            g.geocoded_count,
            n.new_companies_30d,
            r.total_roles,
            f.total_ebitda,
            f.profitable_percentage,
            f.solid_company_percentage,
            f.avg_operating_margin
        FROM counts c, financials f, geocoded g, new_companies n, role_stats r;
    """)
    # Unique index is required for CONCURRENT refresh
    op.execute("CREATE UNIQUE INDEX idx_company_totals_id ON company_totals (id);")


def downgrade() -> None:
    """Revert to the original basic company_totals view."""
    op.execute("DROP MATERIALIZED VIEW IF EXISTS company_totals CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW company_totals AS
        SELECT
            1 as id,
            COUNT(*) as total_count,
            COALESCE(SUM(lf.salgsinntekter), 0) as total_revenue,
            COALESCE(SUM(lf.aarsresultat), 0) as total_profit,
            COALESCE(SUM(c.antall_ansatte), 0) as total_employees
        FROM bedrifter c
        LEFT JOIN latest_financials lf ON c.orgnr = lf.orgnr;
    """)
    op.execute("CREATE UNIQUE INDEX idx_company_totals_id ON company_totals (id);")
