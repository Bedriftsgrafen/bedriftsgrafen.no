"""add similar nace prefix index for similar companies query

Adds idx_similar_nace_prefix to support Priority 4 in the similar
companies UNION ALL query (NACE prefix match, any location).

Complements existing idx_similar_postnummer (Priority 1) and
idx_similar_kommune (Priority 2/3).

Revision ID: abf238c753ae
Revises: 9e56e09c0ab8
Create Date: 2026-02-18 14:26:52.600187

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "abf238c753ae"
down_revision: Union[str, Sequence[str], None] = "9e56e09c0ab8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add partial index for NACE-prefix similarity lookups.

    Covers Priority 4 of get_similar_companies(): same 3-char NACE prefix,
    any location.  Uses the same partial WHERE clause as idx_similar_postnummer
    and idx_similar_kommune so PostgreSQL can match predicates exactly.
    """
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_similar_nace_prefix
        ON bedrifter (
            LEFT(naeringskode, 3),
            antall_ansatte DESC NULLS LAST
        )
        WHERE konkurs = false
          AND under_avvikling = false
          AND under_tvangsavvikling = false
    """)


def downgrade() -> None:
    """Remove the NACE-prefix similarity index."""
    op.execute("DROP INDEX IF EXISTS idx_similar_nace_prefix")
