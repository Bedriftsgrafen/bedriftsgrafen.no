"""add_trigram_index_bedrifter_navn

Revision ID: 0e826bcc8bd2
Revises: abf238c753ae
Create Date: 2026-03-30 17:50:54.728173

"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0e826bcc8bd2"
down_revision: str | Sequence[str] | None = "abf238c753ae"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add GIN trigram index on bedrifter.navn for fast ILIKE short-query matching."""
    # pg_trgm extension already exists (used by underenheter/roller trigram indexes)
    # CONCURRENTLY avoids locking the table during index build (~1.15M rows)
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bedrifter_navn_trigram ON bedrifter USING gin (navn gin_trgm_ops)"
    )


def downgrade() -> None:
    """Remove trigram index."""
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_bedrifter_navn_trigram")
