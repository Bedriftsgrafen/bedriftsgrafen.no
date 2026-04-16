"""add_commercial_people_materialized_view

Revision ID: 31732adac257
Revises: e6173e1ba9cc
Create Date: 2026-04-16 16:11:50.404938

Pre-aggregates distinct (person_navn, foedselsdato) pairs across roles in
commercial entities, plus the latest updated_at timestamp for each person.

This eliminates the 12-16s full scan of 3.38M roller rows + 1.16M bedrifter
rows that occurred on every sitemap cache refresh.

The commercial filter exactly mirrors RoleRepository._commercial_filter()
and constants/org_forms.py. If those change, update this view too.
"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "31732adac257"
down_revision: str | Sequence[str] | None = "e6173e1ba9cc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Cannot use CONCURRENTLY inside a transaction; WITH DATA populates immediately.
    # Creation takes ~15s due to the 3.38M-row join — acceptable as a one-time cost.
    op.execute("""
        CREATE MATERIALIZED VIEW commercial_people_mv AS
        SELECT
            r.person_navn,
            r.foedselsdato,
            MAX(r.updated_at) AS latest_update
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

    # Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
    # Also provides O(log n) keyset pagination on (person_navn, foedselsdato).
    op.execute("""
        CREATE UNIQUE INDEX idx_commercial_people_mv_name_dob
            ON commercial_people_mv (person_navn, foedselsdato)
    """)

    # Planner statistics for accurate COUNT(*) estimates
    op.execute("ANALYZE commercial_people_mv")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP MATERIALIZED VIEW IF EXISTS commercial_people_mv")
