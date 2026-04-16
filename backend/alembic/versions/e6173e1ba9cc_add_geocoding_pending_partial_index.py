"""add_geocoding_pending_partial_index

Revision ID: e6173e1ba9cc
Revises: 442ee5e87118
Create Date: 2026-04-16 08:16:48.358427

"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e6173e1ba9cc"
down_revision: str | Sequence[str] | None = "442ee5e87118"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add partial index for geocoding pending query.

    The geocoding batch service queries companies needing geocoding:
    WHERE latitude IS NULL AND geocoding_attempts < 3
    ORDER BY antall_ansatte DESC NULLS LAST

    Without this index, the query scans all 1.16M rows (22+ seconds).
    With it, only rows matching the WHERE clause are indexed (~sub-second).

    Uses CREATE INDEX without CONCURRENTLY since Alembic runs inside a
    transaction. The table lock is brief for a partial index on a small
    subset of rows.
    """
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_geocoding_pending
        ON bedrifter (geocoding_attempts, antall_ansatte DESC NULLS LAST)
        WHERE latitude IS NULL
        """
    )


def downgrade() -> None:
    """Remove geocoding pending partial index."""
    op.execute("DROP INDEX IF EXISTS idx_geocoding_pending")
