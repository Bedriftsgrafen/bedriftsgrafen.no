"""restore_all_performance_indexes

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
Create Date: 2026-01-05 15:00:00.000000

Restore ALL critical performance indexes that were dropped in 20d47b99003d.
Focus on benchmark queries, similar companies, and composite indexes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'r6s7t8u9v0w1'
down_revision: Union[str, Sequence[str], None] = 'q5r6s7t8u9v0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Restore all dropped performance indexes."""
    # Commit any existing transaction for CONCURRENTLY
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))

    # =========================================================================
    # BENCHMARK QUERY OPTIMIZATION
    # For: get_industry_stats_by_municipality which joins bedrifter + regnskap
    # =========================================================================
    
    # Composite: naeringskode + kommunenummer for benchmark filtering
    # Critical for: WHERE naeringskode LIKE 'XX%' AND kommunenummer = 'XXXX'
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_nace_kommune "
        "ON bedrifter ((forretningsadresse->>'kommunenummer'), naeringskode)"
    )
    
    # Index for active companies in NACE code (benchmark base filter)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_nace_active "
        "ON bedrifter (naeringskode, konkurs) WHERE konkurs = false"
    )

    # =========================================================================
    # SIMILAR COMPANIES OPTIMIZATION (was dropped)
    # For queries finding similar companies by nace + location
    # =========================================================================
    
    # Postnummer-based similarity lookup (active companies only)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_similar_postnummer 
        ON bedrifter (
            naeringskode, 
            (forretningsadresse->>'postnummer'), 
            antall_ansatte DESC NULLS LAST
        ) 
        WHERE konkurs = false AND under_avvikling = false AND under_tvangsavvikling = false
    """)
    
    # Kommune-based similarity lookup (active companies only)  
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_similar_kommune
        ON bedrifter (
            LEFT(naeringskode, 3),
            UPPER(forretningsadresse->>'kommune'),
            antall_ansatte DESC NULLS LAST
        )
        WHERE konkurs = false AND under_avvikling = false AND under_tvangsavvikling = false
    """)

    # =========================================================================
    # REGNSKAP (ACCOUNTING) OPTIMIZATION
    # For benchmark queries that need latest year per company
    # =========================================================================
    
    # Composite for latest-year aggregation (critical for benchmark)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regnskap_latest_lookup "
        "ON regnskap (orgnr, aar DESC, salgsinntekter, aarsresultat, driftsresultat)"
    )
    
    # Financial aggregation indexes
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regnskap_aarsresultat "
        "ON regnskap (aarsresultat DESC NULLS LAST) WHERE aarsresultat IS NOT NULL"
    )
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regnskap_driftsresultat "
        "ON regnskap (driftsresultat DESC NULLS LAST) WHERE driftsresultat IS NOT NULL"
    )

    # =========================================================================
    # ORGANISASJONSFORM COMPOSITE INDEXES (were dropped)
    # For list views with org form filter + various sorts
    # =========================================================================
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_orgform_navn_asc "
        "ON bedrifter (organisasjonsform, navn)"
    )
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_orgform_navn_desc "
        "ON bedrifter (organisasjonsform, navn DESC)"
    )
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_orgform_stiftelse "
        "ON bedrifter (organisasjonsform, stiftelsesdato DESC NULLS LAST)"
    )

    # =========================================================================
    # PARTIAL INDEXES FOR ACTIVE COMPANIES (were dropped)
    # Faster scans when filtering out bankrupt companies
    # =========================================================================
    
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_active_orgform
        ON bedrifter (organisasjonsform)
        WHERE konkurs IS NOT TRUE AND under_avvikling IS NOT TRUE AND under_tvangsavvikling IS NOT TRUE
    """)
    
    # Covering index for list view with active filter
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_list_orgform_ansatte
        ON bedrifter (organisasjonsform, antall_ansatte DESC)
        WHERE konkurs IS NOT TRUE AND under_avvikling IS NOT TRUE AND under_tvangsavvikling IS NOT TRUE
    """)
    
    # =========================================================================  
    # GEOCODING QUEUE OPTIMIZATION (was dropped)
    # For batch geocoding jobs that prioritize by employee count
    # =========================================================================
    
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_geocoding_queue
        ON bedrifter (antall_ansatte DESC NULLS LAST)
        WHERE latitude IS NULL
    """)

    # =========================================================================
    # KONKURS (BANKRUPTCY) INDEXES (were dropped)
    # For filtering bankrupt companies
    # =========================================================================
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_konkurs_partial "
        "ON bedrifter (konkurs) WHERE konkurs = true"
    )
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_konkursdato_partial "
        "ON bedrifter (konkursdato DESC NULLS LAST) WHERE konkursdato IS NOT NULL"
    )

    # =========================================================================
    # MUNICIPALITY POPULATION INDEX (was dropped)
    # For population lookups in stats service
    # =========================================================================
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_municipality_population_year_code "
        "ON municipality_population (year, municipality_code)"
    )

    # =========================================================================
    # LATEST_ACCOUNTINGS OPTIMIZATION
    # For latest accounting lookups
    # =========================================================================
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_latest_accountings_financial "
        "ON latest_accountings (orgnr, salgsinntekter, aarsresultat)"
    )


def downgrade() -> None:
    """Remove the restored indexes."""
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))

    # Benchmark optimization
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_nace_kommune")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_nace_active")
    
    # Similar companies
    op.execute("DROP INDEX IF EXISTS idx_similar_postnummer")
    op.execute("DROP INDEX IF EXISTS idx_similar_kommune")
    
    # Regnskap
    op.execute("DROP INDEX IF EXISTS idx_regnskap_latest_lookup")
    op.execute("DROP INDEX IF EXISTS idx_regnskap_aarsresultat")
    op.execute("DROP INDEX IF EXISTS idx_regnskap_driftsresultat")
    
    # Org form composites
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_orgform_navn_asc")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_orgform_navn_desc")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_orgform_stiftelse")
    
    # Active company partials
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_active_orgform")
    op.execute("DROP INDEX IF EXISTS idx_list_orgform_ansatte")
    
    # Geocoding
    op.execute("DROP INDEX IF EXISTS idx_companies_geocoding_queue")
    
    # Konkurs
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_konkurs_partial")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_konkursdato_partial")
    
    # Municipality population
    op.execute("DROP INDEX IF EXISTS idx_municipality_population_year_code")
    
    # Latest accountings
    op.execute("DROP INDEX IF EXISTS idx_latest_accountings_financial")
