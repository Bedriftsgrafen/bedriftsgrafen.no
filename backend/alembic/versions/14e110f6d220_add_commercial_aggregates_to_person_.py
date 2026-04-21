"""add_commercial_aggregates_to_person_toplist_mv

Revision ID: 14e110f6d220
Revises: 7e8a07d9b614
Create Date: 2026-04-21 11:51:01.228060

Rebuilds person_toplist_mv with three strictly-scoped commercial aggregate columns:

  total_revenue  -- aggregated salgsinntekter; replaces permissive version from 7e8a07d9b614
  total_profit   -- aggregated aarsresultat (net profit); NEW
  total_employees -- aggregated antall_ansatte; NEW

Key changes vs 7e8a07d9b614:
  1. Financial aggregates are now restricted to roles where type_kode = 'DAGL'
     AND NOT fratraadt (active CEO/managing director only).
  2. Public/governmental org forms are excluded from all three financial aggregates:
     SÆR, ORGL, KOMM, FYLK, STAT, KF, FKF, SF, KIRK, IKS, OPMV.
     This prevents state health trust executives (helseforetak, SÆR) from dominating
     commercial revenue/profit/employees rankings.
  3. Each person's company contributions are deduped to prevent double-counting
     when a person holds multiple roles in the same company.

Count-based columns (active_roles, LEDE, DAGL, MEDL, active_companies,
industry_diversity) retain the broader commercial filter unchanged.
"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "14e110f6d220"
down_revision: str | Sequence[str] | None = "7e8a07d9b614"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Governmental org forms excluded from private-commercial aggregates.
# Keep in sync with backend/constants/org_forms.py:PUBLIC_ORG_FORMS.
_PUBLIC_ORG_FORMS_SQL = "'SÆR','ORGL','KOMM','FYLK','STAT','KF','FKF','SF','KIRK','IKS','OPMV'"

# Non-commercial forms also excluded (already filtered at role level in many
# paths, but be explicit for the financial CTE).
_NON_COMMERCIAL_SQL = "'FLI','BRL','ESEK','ANNA','STI'"

# Org forms that are always private-commercial (foretaksreg fallback).
_ALWAYS_COMMERCIAL_SQL = "'AS','ASA','ENK','ANS','DA','NUF','KS','SAM'"


def upgrade() -> None:
    """Rebuild person_toplist_mv with DAGL-scoped private-commercial aggregates."""
    # Drop dependents first (landing stats reads from toplist MV)
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_landing_stats_mv CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_toplist_mv CASCADE")

    op.execute(f"""
        CREATE MATERIALIZED VIEW person_toplist_mv AS
        WITH
            -- Dedup for count-based columns (all active commercial roles, incl. public entities)
            deduped_roles AS (
                SELECT DISTINCT
                    r.person_navn,
                    r.foedselsdato,
                    r.orgnr
                FROM roller r
                JOIN bedrifter b ON r.orgnr = b.orgnr
                WHERE r.person_navn IS NOT NULL
                  AND r.foedselsdato IS NOT NULL
                  AND (
                      b.registrert_i_foretaksregisteret = true
                      OR b.organisasjonsform IN ({_ALWAYS_COMMERCIAL_SQL})
                  )
            ),
            -- Dedup for financial aggregates: active DAGL only, private commercial only.
            -- Excludes governmental entities so helseforetak execs don't dominate rankings.
            dagl_private_roles AS (
                SELECT DISTINCT
                    r.person_navn,
                    r.foedselsdato,
                    r.orgnr
                FROM roller r
                JOIN bedrifter b ON r.orgnr = b.orgnr
                WHERE r.person_navn IS NOT NULL
                  AND r.foedselsdato IS NOT NULL
                  AND r.type_kode = 'DAGL'
                  AND NOT r.fratraadt
                  AND b.organisasjonsform NOT IN ({_PUBLIC_ORG_FORMS_SQL})
                  AND b.organisasjonsform NOT IN ({_NON_COMMERCIAL_SQL})
                  AND (
                      b.registrert_i_foretaksregisteret = true
                      OR b.organisasjonsform IN ({_ALWAYS_COMMERCIAL_SQL})
                  )
            ),
            -- Aggregate financial metrics per person across their private commercial DAGL companies.
            commercial_aggregates AS (
                SELECT
                    dp.person_navn,
                    dp.foedselsdato,
                    CAST(COALESCE(SUM(lf.salgsinntekter), 0) AS BIGINT) AS total_revenue,
                    CAST(COALESCE(SUM(lf.aarsresultat),   0) AS BIGINT) AS total_profit,
                    CAST(COALESCE(SUM(b.antall_ansatte),  0) AS BIGINT) AS total_employees
                FROM dagl_private_roles dp
                JOIN bedrifter b ON dp.orgnr = b.orgnr
                LEFT JOIN latest_financials lf ON dp.orgnr = lf.orgnr
                GROUP BY dp.person_navn, dp.foedselsdato
            )
        SELECT
            r.person_navn,
            r.foedselsdato,
            COUNT(*)                                                              AS total_roles,
            COUNT(*) FILTER (WHERE NOT r.fratraadt)                              AS active_roles,
            COUNT(*) FILTER (WHERE r.type_kode = 'LEDE' AND NOT r.fratraadt)    AS styreleder_count,
            COUNT(*) FILTER (WHERE r.type_kode = 'DAGL' AND NOT r.fratraadt)    AS ceo_count,
            COUNT(*) FILTER (WHERE r.type_kode = 'MEDL' AND NOT r.fratraadt)    AS styremedlem_count,
            COUNT(DISTINCT r.orgnr) FILTER (WHERE NOT r.fratraadt)               AS active_companies,
            COUNT(DISTINCT LEFT(b.naeringskode, 2)) FILTER (WHERE NOT r.fratraadt) AS industry_diversity,
            COALESCE(ca.total_revenue,   0) AS total_revenue,
            COALESCE(ca.total_profit,    0) AS total_profit,
            COALESCE(ca.total_employees, 0) AS total_employees
        FROM roller r
        JOIN bedrifter b ON r.orgnr = b.orgnr
        LEFT JOIN commercial_aggregates ca
            ON r.person_navn = ca.person_navn AND r.foedselsdato = ca.foedselsdato
        WHERE r.person_navn IS NOT NULL
          AND r.foedselsdato IS NOT NULL
          AND (
              b.registrert_i_foretaksregisteret = true
              OR b.organisasjonsform IN ({_ALWAYS_COMMERCIAL_SQL})
          )
        GROUP BY r.person_navn, r.foedselsdato, ca.total_revenue, ca.total_profit, ca.total_employees
        WITH DATA
    """)

    # Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
    op.execute("""
        CREATE UNIQUE INDEX idx_person_toplist_mv_pk
            ON person_toplist_mv (person_navn, foedselsdato)
    """)

    # DESC indexes for fast ORDER BY on each toplist category
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_active_roles
            ON person_toplist_mv (active_roles DESC)
    """)
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_styreleder
            ON person_toplist_mv (styreleder_count DESC)
    """)
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_ceo
            ON person_toplist_mv (ceo_count DESC)
    """)
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_industry
            ON person_toplist_mv (industry_diversity DESC)
    """)
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_styremedlem
            ON person_toplist_mv (styremedlem_count DESC)
    """)
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_active_companies
            ON person_toplist_mv (active_companies DESC)
    """)
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_revenue
            ON person_toplist_mv (total_revenue DESC NULLS LAST)
    """)
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_profit
            ON person_toplist_mv (total_profit DESC NULLS LAST)
    """)
    op.execute("""
        CREATE INDEX idx_person_toplist_mv_employees
            ON person_toplist_mv (total_employees DESC NULLS LAST)
    """)

    op.execute("ANALYZE person_toplist_mv")

    # Recreate landing stats MV (reads from person_toplist_mv — verbatim from 7e8a07d9b614)
    op.execute("""
        CREATE MATERIALIZED VIEW person_landing_stats_mv AS
        WITH person_agg AS (
            SELECT
                COUNT(*) AS total_persons,
                SUM(active_roles) AS total_active_roles,
                AVG(EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM foedselsdato))
                    FILTER (WHERE styreleder_count > 0 OR ceo_count > 0 OR styremedlem_count > 0)
                    AS avg_board_age,
                COUNT(*) FILTER (WHERE foedselsdato >= '2000-01-01') AS gen_z,
                COUNT(*) FILTER (WHERE foedselsdato >= '1980-01-01'
                                   AND foedselsdato < '2000-01-01') AS millennials,
                COUNT(*) FILTER (WHERE foedselsdato >= '1960-01-01'
                                   AND foedselsdato < '1980-01-01') AS gen_x,
                COUNT(*) FILTER (WHERE foedselsdato >= '1940-01-01'
                                   AND foedselsdato < '1960-01-01') AS boomers,
                COUNT(*) FILTER (WHERE foedselsdato < '1940-01-01') AS silent
            FROM person_toplist_mv
        ),
        role_agg AS (
            SELECT json_agg(
                json_build_object(
                    'type_kode', type_kode,
                    'type_beskrivelse', type_beskrivelse,
                    'count', cnt
                ) ORDER BY cnt DESC
            ) AS role_types
            FROM (
                SELECT type_kode, MIN(type_beskrivelse) AS type_beskrivelse, COUNT(*) AS cnt
                FROM roller
                WHERE NOT fratraadt AND type_kode IS NOT NULL
                GROUP BY type_kode
            ) r
        )
        SELECT 1 AS id, p.*, ra.role_types
        FROM person_agg p, role_agg ra
        WITH DATA
    """)
    op.execute("""
        CREATE UNIQUE INDEX idx_person_landing_stats_mv_pk
            ON person_landing_stats_mv (id)
    """)
    op.execute("ANALYZE person_landing_stats_mv")


def downgrade() -> None:
    """Revert to person_toplist_mv with only total_revenue (7e8a07d9b614 state)."""
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_landing_stats_mv CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_toplist_mv CASCADE")

    # Restore 7e8a07d9b614 MV (has total_revenue, no total_profit/total_employees,
    # and uses permissive commercial filter including SÆR etc.)
    op.execute("""
        CREATE MATERIALIZED VIEW person_toplist_mv AS
        WITH deduped_roles AS (
            SELECT DISTINCT
                r.person_navn,
                r.foedselsdato,
                r.orgnr
            FROM roller r
            JOIN bedrifter b ON r.orgnr = b.orgnr
            WHERE r.person_navn IS NOT NULL
              AND r.foedselsdato IS NOT NULL
              AND (
                  b.registrert_i_foretaksregisteret = true
                  OR (
                      b.organisasjonsform IN ('AS','ASA','ENK','ANS','DA','NUF','KS','SAM','IKS')
                      AND b.organisasjonsform NOT IN ('FLI','BRL','ESEK','ANNA')
                      AND b.organisasjonsform != 'STI'
                  )
              )
        ),
        person_revenue AS (
            SELECT
                dr.person_navn,
                dr.foedselsdato,
                CAST(COALESCE(SUM(lf.salgsinntekter), 0) AS BIGINT) AS total_revenue
            FROM deduped_roles dr
            LEFT JOIN latest_financials lf ON dr.orgnr = lf.orgnr
            GROUP BY dr.person_navn, dr.foedselsdato
        )
        SELECT
            r.person_navn,
            r.foedselsdato,
            COUNT(*) AS total_roles,
            COUNT(*) FILTER (WHERE NOT r.fratraadt) AS active_roles,
            COUNT(*) FILTER (WHERE r.type_kode = 'LEDE' AND NOT r.fratraadt) AS styreleder_count,
            COUNT(*) FILTER (WHERE r.type_kode = 'DAGL' AND NOT r.fratraadt) AS ceo_count,
            COUNT(*) FILTER (WHERE r.type_kode = 'MEDL' AND NOT r.fratraadt) AS styremedlem_count,
            COUNT(DISTINCT r.orgnr) FILTER (WHERE NOT r.fratraadt) AS active_companies,
            COUNT(DISTINCT LEFT(b.naeringskode, 2)) FILTER (WHERE NOT r.fratraadt) AS industry_diversity,
            pr.total_revenue
        FROM roller r
        JOIN bedrifter b ON r.orgnr = b.orgnr
        LEFT JOIN person_revenue pr
            ON r.person_navn = pr.person_navn AND r.foedselsdato = pr.foedselsdato
        WHERE r.person_navn IS NOT NULL
          AND r.foedselsdato IS NOT NULL
          AND (
              b.registrert_i_foretaksregisteret = true
              OR (
                  b.organisasjonsform IN ('AS','ASA','ENK','ANS','DA','NUF','KS','SAM','IKS')
                  AND b.organisasjonsform NOT IN ('FLI','BRL','ESEK','ANNA')
                  AND b.organisasjonsform != 'STI'
              )
          )
        GROUP BY r.person_navn, r.foedselsdato, pr.total_revenue
        WITH DATA
    """)
    op.execute("""
        CREATE UNIQUE INDEX idx_person_toplist_mv_pk
            ON person_toplist_mv (person_navn, foedselsdato)
    """)
    op.execute("CREATE INDEX idx_person_toplist_mv_active_roles ON person_toplist_mv (active_roles DESC)")
    op.execute("CREATE INDEX idx_person_toplist_mv_styreleder ON person_toplist_mv (styreleder_count DESC)")
    op.execute("CREATE INDEX idx_person_toplist_mv_ceo ON person_toplist_mv (ceo_count DESC)")
    op.execute("CREATE INDEX idx_person_toplist_mv_industry ON person_toplist_mv (industry_diversity DESC)")
    op.execute("CREATE INDEX idx_person_toplist_mv_styremedlem ON person_toplist_mv (styremedlem_count DESC)")
    op.execute("CREATE INDEX idx_person_toplist_mv_active_companies ON person_toplist_mv (active_companies DESC)")
    op.execute("CREATE INDEX idx_person_toplist_mv_revenue ON person_toplist_mv (total_revenue DESC NULLS LAST)")
    op.execute("ANALYZE person_toplist_mv")

    op.execute("""
        CREATE MATERIALIZED VIEW person_landing_stats_mv AS
        WITH person_agg AS (
            SELECT
                COUNT(*) AS total_persons,
                SUM(active_roles) AS total_active_roles,
                AVG(EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM foedselsdato))
                    FILTER (WHERE styreleder_count > 0 OR ceo_count > 0 OR styremedlem_count > 0)
                    AS avg_board_age,
                COUNT(*) FILTER (WHERE foedselsdato >= '2000-01-01') AS gen_z,
                COUNT(*) FILTER (WHERE foedselsdato >= '1980-01-01'
                                   AND foedselsdato < '2000-01-01') AS millennials,
                COUNT(*) FILTER (WHERE foedselsdato >= '1960-01-01'
                                   AND foedselsdato < '1980-01-01') AS gen_x,
                COUNT(*) FILTER (WHERE foedselsdato >= '1940-01-01'
                                   AND foedselsdato < '1960-01-01') AS boomers,
                COUNT(*) FILTER (WHERE foedselsdato < '1940-01-01') AS silent
            FROM person_toplist_mv
        ),
        role_agg AS (
            SELECT json_agg(
                json_build_object(
                    'type_kode', type_kode,
                    'type_beskrivelse', type_beskrivelse,
                    'count', cnt
                ) ORDER BY cnt DESC
            ) AS role_types
            FROM (
                SELECT type_kode, MIN(type_beskrivelse) AS type_beskrivelse, COUNT(*) AS cnt
                FROM roller
                WHERE NOT fratraadt AND type_kode IS NOT NULL
                GROUP BY type_kode
            ) r
        )
        SELECT 1 AS id, p.*, ra.role_types
        FROM person_agg p, role_agg ra
        WITH DATA
    """)
    op.execute("CREATE UNIQUE INDEX idx_person_landing_stats_mv_pk ON person_landing_stats_mv (id)")
    op.execute("ANALYZE person_landing_stats_mv")
