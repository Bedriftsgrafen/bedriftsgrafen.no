"""add_person_toplist_materialized_view

Revision ID: a1b2c3d4e5f8
Revises: 31732adac257
Create Date: 2026-04-20 10:30:00.000000

Pre-aggregates per-person role metrics (active roles, styreleder/CEO/styremedlem counts,
active companies, industry diversity) across commercial entities.

The commercial filter exactly mirrors RoleRepository._commercial_filter()
and constants/org_forms.py. If those change, update this view too.
"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f8"
down_revision: str | Sequence[str] | None = "31732adac257"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create person_toplist_mv materialized view with pre-aggregated person metrics."""
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

    op.execute("ANALYZE person_toplist_mv")

    # Pre-computed stats summary (single row) for fast landing page reads
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
    """Drop person landing page materialized views."""
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_landing_stats_mv CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS person_toplist_mv CASCADE")
