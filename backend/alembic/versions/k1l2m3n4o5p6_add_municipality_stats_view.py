"""Add municipality_stats materialized view for kommune-level map

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2025-12-25 08:00:00.000000

Adds a materialized view aggregating company counts by municipality (kommune) and NACE division.
Used for the choropleth map at kommune level on /bransjer page.
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, Sequence[str], None] = "j0k1l2m3n4o5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create materialized view for municipality-level industry statistics
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

    # Create indexes for fast lookups
    op.execute("""
        CREATE INDEX idx_municipality_stats_code 
        ON municipality_stats (municipality_code);
    """)
    op.execute("""
        CREATE INDEX idx_municipality_stats_nace 
        ON municipality_stats (nace_division);
    """)
    op.execute("""
        CREATE UNIQUE INDEX idx_municipality_stats_pk 
        ON municipality_stats (municipality_code, nace_division);
    """)
    # Index for filtering municipalities by county (first 2 digits)
    op.execute("""
        CREATE INDEX idx_municipality_stats_county 
        ON municipality_stats (LEFT(municipality_code, 2));
    """)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS municipality_stats CASCADE;")
