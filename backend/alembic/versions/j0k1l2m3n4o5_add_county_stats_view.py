"""Add county_stats materialized view for geographic industry map

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2025-12-24 19:07:00.000000

Adds a materialized view aggregating company counts by county (fylke) and NACE division.
Used for the choropleth map on /bransjer page.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'j0k1l2m3n4o5'
down_revision: Union[str, Sequence[str], None] = 'i9j0k1l2m3n4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create materialized view for county-level industry statistics
    op.execute("""
        CREATE MATERIALIZED VIEW county_stats AS
        SELECT 
            LEFT(b.forretningsadresse->>'kommunenummer', 2) as county_code,
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
        GROUP BY county_code, nace_division
        ORDER BY county_code, company_count DESC;
    """)
    
    # Create indexes for fast lookups
    op.execute("""
        CREATE INDEX idx_county_stats_county 
        ON county_stats (county_code);
    """)
    op.execute("""
        CREATE INDEX idx_county_stats_nace 
        ON county_stats (nace_division);
    """)
    op.execute("""
        CREATE UNIQUE INDEX idx_county_stats_pk 
        ON county_stats (county_code, nace_division);
    """)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS county_stats CASCADE;")
