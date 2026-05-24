"""add_slettedato_purge_index

Revision ID: 7c9a1b2d3e4f
Revises: c8f2d4a91e0b
Create Date: 2026-05-24

Add a narrow partial index for the deleted-company purge job. Production showed
the JSON slettedato predicate falling back to a full bedrifter scan and timing
out daily.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7c9a1b2d3e4f"
down_revision: str | Sequence[str] | None = "c8f2d4a91e0b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add a concurrent partial index for purge_deleted_companies."""
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout = 0")
        try:
            op.execute("""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_slettedato_orgnr
                ON bedrifter (orgnr)
                WHERE ((data ->> 'slettedato') IS NOT NULL)
            """)
        finally:
            op.execute("RESET statement_timeout")


def downgrade() -> None:
    """Remove the deleted-company purge index."""
    with op.get_context().autocommit_block():
        op.execute("SET statement_timeout = 0")
        try:
            op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_bedrifter_slettedato_orgnr")
        finally:
            op.execute("RESET statement_timeout")
