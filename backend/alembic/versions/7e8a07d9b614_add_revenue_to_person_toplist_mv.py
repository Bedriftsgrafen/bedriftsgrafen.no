"""add_revenue_to_person_toplist_mv

Revision ID: 7e8a07d9b614
Revises: a1b2c3d4e5f8
Create Date: 2026-04-21 11:08:36.463459

Adds total_revenue (BIGINT) column to person_toplist_mv. Revenue is
aggregated per person via a deduped CTE joining latest_financials,
preventing double-counting when a person holds multiple roles in the same
company. A LEFT JOIN (not INNER) preserves persons with no financial data.

The commercial filter mirrors constants/org_forms.py and
RoleRepository._commercial_filter().
"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7e8a07d9b614"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Rebuild person_toplist_mv with total_revenue column."""
    # Drop dependents first (landing stats reads from toplist MV)
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_landing_stats_mv CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_toplist_mv CASCADE")

    # Recreate with total_revenue via deduplicated revenue CTE
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

    op.execute("ANALYZE person_toplist_mv")

    # Recreate landing stats MV (reads from person_toplist_mv, verbatim from a1b2c3d4e5f8)
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
    """Revert to person_toplist_mv without total_revenue."""
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_landing_stats_mv CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_toplist_mv CASCADE")

    # Restore original MV from a1b2c3d4e5f8 (no total_revenue)
    op.execute("""
        CREATE MATERIALIZED VIEW person_toplist_mv AS
        SELECT
            r.person_navn,
            r.foedselsdato,
            COUNT(*) AS total_roles,
            COUNT(*) FILTER (WHERE NOT r.fratraadt) AS active_roles,
            COUNT(*) FILTER (WHERE r.type_kode = 'LEDE' AND NOT r.fratraadt) AS styreleder_count,
            COUNT(*) FILTER (WHERE r.type_kode = 'DAGL' AND NOT r.fratraadt) AS ceo_count,
            COUNT(*) FILTER (WHERE r.type_kode = 'MEDL' AND NOT r.fratraadt) AS styremedlem_count,
            COUNT(DISTINCT r.orgnr) FILTER (WHERE NOT r.fratraadt) AS active_companies,
            COUNT(DISTINCT LEFT(b.naeringskode, 2)) FILTER (WHERE NOT r.fratraadt) AS industry_diversity
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
        GROUP BY r.person_navn, r.foedselsdato
        WITH DATA
    """)

    op.execute("""
        CREATE UNIQUE INDEX idx_person_toplist_mv_pk
            ON person_toplist_mv (person_navn, foedselsdato)
    """)
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
    op.execute("""
        CREATE UNIQUE INDEX idx_person_landing_stats_mv_pk
            ON person_landing_stats_mv (id)
    """)
    op.execute("ANALYZE person_landing_stats_mv")
