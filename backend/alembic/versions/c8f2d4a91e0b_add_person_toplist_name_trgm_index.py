"""add_person_toplist_name_trgm_index

Revision ID: c8f2d4a91e0b
Revises: w1x2y3z4a5b6
Create Date: 2026-05-20

Adds a trigram GIN index to the person search materialized view so public
person search can use the pre-aggregated person_toplist_mv instead of joining
roller and bedrifter for every autocomplete/results request.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c8f2d4a91e0b"
down_revision: str | Sequence[str] | None = "w1x2y3z4a5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add trigram search index on the pre-aggregated person search view."""
    with op.get_context().autocommit_block():
        op.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_person_toplist_mv_person_navn_trgm
            ON person_toplist_mv USING gin (person_navn gin_trgm_ops)
        """)

    op.execute("ANALYZE person_toplist_mv")


def downgrade() -> None:
    """Remove trigram search index from the person search view."""
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_person_toplist_mv_person_navn_trgm")
