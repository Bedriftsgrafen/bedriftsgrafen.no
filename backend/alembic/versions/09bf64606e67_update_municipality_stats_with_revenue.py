"""update_municipality_stats_with_revenue

Revision ID: 09bf64606e67
Revises: 2f729230c375
Create Date: 2026-01-21 15:07:00.107759

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '09bf64606e67'
down_revision: Union[str, Sequence[str], None] = '2f729230c375'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop and recreate materialized view with revenue
    op.execute("DROP MATERIALIZED VIEW IF EXISTS municipality_stats CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW municipality_stats AS
        SELECT 
            b.forretningsadresse->>'kommunenummer' as municipality_code,
            LEFT(b.naeringskode, 2) as nace_division,
            COUNT(*) as company_count,
            COUNT(*) FILTER (
                WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
            ) as new_last_year,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) as total_employees,
            SUM(lf.salgsinntekter) FILTER (WHERE lf.salgsinntekter IS NOT NULL) as total_revenue
        FROM bedrifter b
        LEFT JOIN latest_financials lf ON b.orgnr = lf.orgnr
        WHERE b.naeringskode IS NOT NULL
          AND b.organisasjonsform != 'KBO'
          AND b.forretningsadresse->>'kommunenummer' IS NOT NULL
        GROUP BY municipality_code, nace_division
        ORDER BY municipality_code, company_count DESC;
    """)

    # Create indexes for fast lookups
    op.execute("CREATE INDEX idx_municipality_stats_code ON municipality_stats (municipality_code);")
    op.execute("CREATE INDEX idx_municipality_stats_nace ON municipality_stats (nace_division);")
    op.execute("CREATE UNIQUE INDEX idx_municipality_stats_pk ON municipality_stats (municipality_code, nace_division);")
    op.execute("CREATE INDEX idx_municipality_stats_county ON municipality_stats (LEFT(municipality_code, 2));")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS municipality_stats CASCADE;")
    # Recreate original version without revenue (simplified downgrade)
    op.execute("""
        CREATE MATERIALIZED VIEW municipality_stats AS
        SELECT 
            b.forretningsadresse->>'kommunenummer' as municipality_code,
            LEFT(b.naeringskode, 2) as nace_division,
            COUNT(*) as company_count,
            COUNT(*) FILTER (
                WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
            ) as new_last_year,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) as total_employees
        FROM bedrifter b
        WHERE b.naeringskode IS NOT NULL
          AND b.organisasjonsform != 'KBO'
          AND b.forretningsadresse->>'kommunenummer' IS NOT NULL
        GROUP BY municipality_code, nace_division
        ORDER BY municipality_code, company_count DESC;
    """)
    op.execute("CREATE INDEX idx_municipality_stats_code ON municipality_stats (municipality_code);")
    op.execute("CREATE INDEX idx_municipality_stats_nace ON municipality_stats (nace_division);")
    op.execute("CREATE UNIQUE INDEX idx_municipality_stats_pk ON municipality_stats (municipality_code, nace_division);")
    op.execute("CREATE INDEX idx_municipality_stats_county ON municipality_stats (LEFT(municipality_code, 2));")
