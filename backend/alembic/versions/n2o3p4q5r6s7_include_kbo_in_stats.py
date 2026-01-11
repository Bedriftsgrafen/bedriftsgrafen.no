"""Include KBO in stats views - KBO should only be excluded for new companies

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
Create Date: 2024-12-25

KBO (konkursbo/bankruptcy estates) should be visible in map and industry stats.
KBO exclusion should only apply to "new companies" queries to avoid confusion
about newly registered KBOs being counted as genuinely new businesses.
"""
from alembic import op

revision = 'n2o3p4q5r6s7'
down_revision = 'm1n2o3p4q5r6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Recreate stats views to include KBO companies."""
    
    # Drop and recreate county_stats to include KBO
    op.execute("DROP MATERIALIZED VIEW IF EXISTS county_stats CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW county_stats AS
        SELECT 
            LEFT(b.forretningsadresse->>'kommunenummer', 2) as county_code,
            LEFT(b.naeringskode, 2) as nace_division,
            COUNT(*) as company_count,
            COUNT(*) FILTER (WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year' 
                            AND b.organisasjonsform != 'KBO') as new_last_year,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) as total_employees
        FROM bedrifter b
        WHERE b.naeringskode IS NOT NULL
          AND b.forretningsadresse->>'kommunenummer' IS NOT NULL
        GROUP BY 
            LEFT(b.forretningsadresse->>'kommunenummer', 2),
            LEFT(b.naeringskode, 2)
        ORDER BY county_code, company_count DESC;
    """)
    
    # Recreate indexes - separate execute calls for asyncpg compatibility
    op.execute("CREATE INDEX idx_county_stats_county ON county_stats (county_code);")
    op.execute("CREATE INDEX idx_county_stats_nace ON county_stats (nace_division);")
    op.execute("CREATE UNIQUE INDEX idx_county_stats_pk ON county_stats (county_code, nace_division);")
    
    # Drop and recreate municipality_stats to include KBO
    op.execute("DROP MATERIALIZED VIEW IF EXISTS municipality_stats CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW municipality_stats AS
        SELECT 
            b.forretningsadresse->>'kommunenummer' as municipality_code,
            LEFT(b.forretningsadresse->>'kommunenummer', 2) as county_code,
            LEFT(b.naeringskode, 2) as nace_division,
            COUNT(*) as company_count,
            COUNT(*) FILTER (WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
                            AND b.organisasjonsform != 'KBO') as new_last_year,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) as total_employees
        FROM bedrifter b
        WHERE b.naeringskode IS NOT NULL
          AND b.forretningsadresse->>'kommunenummer' IS NOT NULL
        GROUP BY 
            b.forretningsadresse->>'kommunenummer',
            LEFT(b.forretningsadresse->>'kommunenummer', 2),
            LEFT(b.naeringskode, 2)
        ORDER BY municipality_code, company_count DESC;
    """)
    
    # Recreate indexes - separate execute calls
    op.execute("CREATE INDEX idx_municipality_stats_code ON municipality_stats (municipality_code);")
    op.execute("CREATE INDEX idx_municipality_stats_nace ON municipality_stats (nace_division);")
    op.execute("CREATE INDEX idx_municipality_stats_county ON municipality_stats (county_code);")
    op.execute("CREATE UNIQUE INDEX idx_municipality_stats_pk ON municipality_stats (municipality_code, nace_division);")


def downgrade() -> None:
    """Revert to excluding KBO from all counts."""
    # Drop and recreate county_stats excluding KBO
    op.execute("DROP MATERIALIZED VIEW IF EXISTS county_stats CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW county_stats AS
        SELECT 
            LEFT(b.forretningsadresse->>'kommunenummer', 2) as county_code,
            LEFT(b.naeringskode, 2) as nace_division,
            COUNT(*) as company_count,
            COUNT(*) FILTER (WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year') as new_last_year,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) as total_employees
        FROM bedrifter b
        WHERE b.naeringskode IS NOT NULL
          AND b.organisasjonsform != 'KBO'
          AND b.forretningsadresse->>'kommunenummer' IS NOT NULL
        GROUP BY 
            LEFT(b.forretningsadresse->>'kommunenummer', 2),
            LEFT(b.naeringskode, 2)
        ORDER BY county_code, company_count DESC;
    """)
    
    op.execute("CREATE INDEX idx_county_stats_county ON county_stats (county_code);")
    op.execute("CREATE INDEX idx_county_stats_nace ON county_stats (nace_division);")
    op.execute("CREATE UNIQUE INDEX idx_county_stats_pk ON county_stats (county_code, nace_division);")
    
    # Drop and recreate municipality_stats excluding KBO
    op.execute("DROP MATERIALIZED VIEW IF EXISTS municipality_stats CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW municipality_stats AS
        SELECT 
            b.forretningsadresse->>'kommunenummer' as municipality_code,
            LEFT(b.forretningsadresse->>'kommunenummer', 2) as county_code,
            LEFT(b.naeringskode, 2) as nace_division,
            COUNT(*) as company_count,
            COUNT(*) FILTER (WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year') as new_last_year,
            COUNT(*) FILTER (WHERE b.konkurs = true) as bankrupt_count,
            SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) as total_employees
        FROM bedrifter b
        WHERE b.naeringskode IS NOT NULL
          AND b.organisasjonsform != 'KBO'
          AND b.forretningsadresse->>'kommunenummer' IS NOT NULL
        GROUP BY 
            b.forretningsadresse->>'kommunenummer',
            LEFT(b.forretningsadresse->>'kommunenummer', 2),
            LEFT(b.naeringskode, 2)
        ORDER BY municipality_code, company_count DESC;
    """)
    
    op.execute("CREATE INDEX idx_municipality_stats_code ON municipality_stats (municipality_code);")
    op.execute("CREATE INDEX idx_municipality_stats_nace ON municipality_stats (nace_division);")
    op.execute("CREATE INDEX idx_municipality_stats_county ON municipality_stats (county_code);")
    op.execute("CREATE UNIQUE INDEX idx_municipality_stats_pk ON municipality_stats (municipality_code, nace_division);")
