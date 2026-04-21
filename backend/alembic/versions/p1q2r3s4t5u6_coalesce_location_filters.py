# ruff: noqa: S608  # SQL strings in this file are module-level constants, never user input
"""Use COALESCE(forretningsadresse, postadresse) in stats views and add functional indexes

Revision ID: p1q2r3s4t5u6
Revises: 14e110f6d220
Create Date: 2026-04-21

Fixes a data correctness bug where municipality_stats used forretningsadresse-only
while company_filter_builder used OR(forretningsadresse, postadresse), causing the
headline company_count on dashboards to differ from the company lists shown.

Changes:
1. Rebuild municipality_stats using COALESCE(forretningsadresse, postadresse) so
   the 21,544 active companies with no forretningsadresse are properly counted.
2. Rebuild county_stats with the same COALESCE logic for consistency.
3. Add functional expression indexes on bedrifter matching the COALESCE expression
   used by company_filter_builder, enabling efficient index scans for:
   - county + stiftelsesdato (newest companies queries)
   - county + konkursdato (bankruptcy queries, partial index)
4. Invalidate Redis dashboard caches so stale data is not served after the
   company counts change.

After this migration, all location filters use the same address resolution logic:
forretningsadresse is authoritative; postadresse is a fallback for companies that
lack forretningsadresse.kommunenummer (~1.86% of active companies).
"""

import logging

from alembic import op

logger = logging.getLogger("alembic.runtime.migration")

revision = "p1q2r3s4t5u6"
down_revision = "14e110f6d220"
branch_labels = None
depends_on = None

# The COALESCE expression used consistently across filter_builder and stats views.
# forretningsadresse is the canonical legal address; postadresse is a fallback.
_EFFECTIVE_MUNI = (
    "COALESCE(NULLIF(b.forretningsadresse->>'kommunenummer', ''), NULLIF(b.postadresse->>'kommunenummer', ''))"
)

_MUNI_STATS_SQL = f"""
    CREATE MATERIALIZED VIEW municipality_stats AS
    SELECT
        {_EFFECTIVE_MUNI} AS municipality_code,
        LEFT({_EFFECTIVE_MUNI}, 2) AS county_code,
        LEFT(b.naeringskode, 2) AS nace_division,
        COUNT(*) AS company_count,
        COUNT(*) FILTER (
            WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
              AND b.organisasjonsform != 'KBO'
        ) AS new_last_year,
        COUNT(*) FILTER (WHERE b.konkurs = true) AS bankrupt_count,
        SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) AS total_employees,
        SUM(lf.salgsinntekter) FILTER (WHERE lf.salgsinntekter IS NOT NULL) AS total_revenue
    FROM bedrifter b
    LEFT JOIN latest_financials lf ON b.orgnr = lf.orgnr
    WHERE b.naeringskode IS NOT NULL
      AND b.organisasjonsform != 'KBO'
      AND {_EFFECTIVE_MUNI} IS NOT NULL
    GROUP BY municipality_code, county_code, nace_division
    ORDER BY municipality_code, company_count DESC;
"""

_COUNTY_STATS_SQL = f"""
    CREATE MATERIALIZED VIEW county_stats AS
    SELECT
        LEFT({_EFFECTIVE_MUNI}, 2) AS county_code,
        LEFT(b.naeringskode, 2) AS nace_division,
        COUNT(*) AS company_count,
        COUNT(*) FILTER (
            WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
              AND b.organisasjonsform != 'KBO'
        ) AS new_last_year,
        COUNT(*) FILTER (WHERE b.konkurs = true) AS bankrupt_count,
        COALESCE(SUM(b.antall_ansatte), 0) AS total_employees
    FROM bedrifter b
    WHERE b.naeringskode IS NOT NULL
      AND {_EFFECTIVE_MUNI} IS NOT NULL
    GROUP BY county_code, nace_division;
"""


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Rebuild municipality_stats with COALESCE address resolution
    # -------------------------------------------------------------------------
    op.execute("DROP MATERIALIZED VIEW IF EXISTS municipality_stats CASCADE;")
    op.execute(_MUNI_STATS_SQL)

    op.execute("CREATE INDEX idx_municipality_stats_code ON municipality_stats (municipality_code);")
    op.execute("CREATE INDEX idx_municipality_stats_nace ON municipality_stats (nace_division);")
    op.execute("CREATE INDEX idx_municipality_stats_county ON municipality_stats (county_code);")
    op.execute(
        "CREATE UNIQUE INDEX idx_municipality_stats_pk ON municipality_stats (municipality_code, nace_division);"
    )

    # -------------------------------------------------------------------------
    # 2. Rebuild county_stats with the same COALESCE logic
    # -------------------------------------------------------------------------
    op.execute("DROP MATERIALIZED VIEW IF EXISTS county_stats CASCADE;")
    op.execute(_COUNTY_STATS_SQL)

    op.execute("CREATE INDEX idx_county_stats_county ON county_stats (county_code);")
    op.execute("CREATE INDEX idx_county_stats_nace ON county_stats (nace_division);")
    op.execute("CREATE UNIQUE INDEX idx_county_stats_pk ON county_stats (county_code, nace_division);")

    # -------------------------------------------------------------------------
    # 3. Functional expression indexes on bedrifter matching the COALESCE filter
    #
    # These indexes are used by company_filter_builder.apply_location_filter()
    # for the county branch. They replace the old OR-based queries with efficient
    # index scans for the two most expensive dashboard sub-queries:
    #   - newest companies (ORDER BY stiftelsesdato DESC, filtered by county)
    #   - latest bankruptcies (partial index: konkurs=true, ORDER BY konkursdato DESC)
    #
    # NOTE: CREATE INDEX (without CONCURRENTLY) briefly holds a ShareLock on
    # bedrifter during the build. On a ~4.5 GB table this takes ~5-10 minutes.
    # Run this migration during low-traffic hours.
    # -------------------------------------------------------------------------
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_bedrifter_county_eff_stiftelse
        ON bedrifter (
            LEFT(COALESCE(NULLIF(forretningsadresse->>'kommunenummer', ''),
                          NULLIF(postadresse->>'kommunenummer', '')), 2),
            stiftelsesdato DESC NULLS LAST
        );
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_bedrifter_county_eff_konkurs
        ON bedrifter (
            LEFT(COALESCE(NULLIF(forretningsadresse->>'kommunenummer', ''),
                          NULLIF(postadresse->>'kommunenummer', '')), 2),
            konkursdato DESC NULLS LAST
        )
        WHERE konkurs IS TRUE;
    """)

    # -------------------------------------------------------------------------
    # 4. Invalidate Redis dashboard caches (stale counts must not be served)
    #
    # The dashboard responses cached under dashboard:county:* and
    # dashboard:municipality:* contain company_count values built from the old
    # forretningsadresse-only stats. Flush them so the next request recomputes
    # from the updated materialized views.
    # -------------------------------------------------------------------------
    try:
        import os

        import redis as redis_lib

        redis_url = os.environ.get("REDIS_URL", "redis://bedriftsgrafen-redis:6379/0")
        r = redis_lib.from_url(redis_url)
        deleted = 0
        for pattern in ("dashboard:county:*", "dashboard:municipality:*"):
            for key in r.scan_iter(pattern):
                r.delete(key)
                deleted += 1
        if deleted:
            logger.info("Invalidated %d stale dashboard cache keys", deleted)
    except Exception as e:
        # Non-fatal: next Redis TTL expiry (1hr) will also clear the caches
        logger.warning("Could not flush Redis cache (%s); entries expire in <=1hr", e)


def downgrade() -> None:
    # Remove the new functional indexes
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_county_eff_stiftelse;")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_county_eff_konkurs;")

    # Restore county_stats to forretningsadresse-only
    op.execute("DROP MATERIALIZED VIEW IF EXISTS county_stats CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW county_stats AS
        SELECT
            LEFT(forretningsadresse->>'kommunenummer', 2) AS county_code,
            LEFT(naeringskode, 2) AS nace_division,
            COUNT(*) AS company_count,
            COUNT(*) FILTER (WHERE stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year') AS new_last_year,
            COUNT(*) FILTER (WHERE konkurs = true) AS bankrupt_count,
            COALESCE(SUM(antall_ansatte), 0) AS total_employees
        FROM bedrifter
        WHERE (forretningsadresse->>'kommunenummer') IS NOT NULL
          AND naeringskode IS NOT NULL
        GROUP BY county_code, nace_division;
    """)
    op.execute("CREATE INDEX idx_county_stats_county ON county_stats (county_code);")
    op.execute("CREATE INDEX idx_county_stats_nace ON county_stats (nace_division);")
    op.execute("CREATE UNIQUE INDEX idx_county_stats_pk ON county_stats (county_code, nace_division);")

    # Restore municipality_stats to forretningsadresse-only
    op.execute("DROP MATERIALIZED VIEW IF EXISTS municipality_stats CASCADE;")
    op.execute("""
        CREATE MATERIALIZED VIEW municipality_stats AS
        SELECT
            b.forretningsadresse->>'kommunenummer' AS municipality_code,
            LEFT(b.naeringskode, 2) AS nace_division,
            COUNT(*) AS company_count,
            COUNT(*) FILTER (
                WHERE b.stiftelsesdato >= CURRENT_DATE - INTERVAL '1 year'
            ) AS new_last_year,
            COUNT(*) FILTER (WHERE b.konkurs = true) AS bankrupt_count,
            SUM(b.antall_ansatte) FILTER (WHERE b.antall_ansatte IS NOT NULL) AS total_employees,
            SUM(lf.salgsinntekter) FILTER (WHERE lf.salgsinntekter IS NOT NULL) AS total_revenue
        FROM bedrifter b
        LEFT JOIN latest_financials lf ON b.orgnr = lf.orgnr
        WHERE b.naeringskode IS NOT NULL
          AND b.organisasjonsform != 'KBO'
          AND (b.forretningsadresse->>'kommunenummer') IS NOT NULL
        GROUP BY municipality_code, nace_division
        ORDER BY municipality_code, company_count DESC;
    """)
    op.execute("CREATE INDEX idx_municipality_stats_code ON municipality_stats (municipality_code);")
    op.execute("CREATE INDEX idx_municipality_stats_nace ON municipality_stats (nace_division);")
    op.execute(
        "CREATE UNIQUE INDEX idx_municipality_stats_pk ON municipality_stats (municipality_code, nace_division);"
    )
    op.execute("CREATE INDEX idx_municipality_stats_county ON municipality_stats (LEFT(municipality_code, 2));")
