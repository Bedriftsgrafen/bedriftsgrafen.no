"""Add expression indexes for municipality filtering performance.

Revision ID: u9v0w1x2y3z4
Revises: t8u9v0w1x2y3_disable_autovacuum_on_refreshed_views
Create Date: 2026-02-16 09:45:00.000000
"""

from alembic import op

revision = "u9v0w1x2y3z4"
down_revision = "t8u9v0w1x2y3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Expression index on UPPER(kommune) for case-insensitive municipality name filtering
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_kommune_upper "
        "ON bedrifter (UPPER(forretningsadresse->>'kommune'))"
    )
    # Expression index on kommunenummer for municipality code filtering
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_kommunenummer "
        "ON bedrifter ((forretningsadresse->>'kommunenummer'))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_kommune_upper")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_kommunenummer")
