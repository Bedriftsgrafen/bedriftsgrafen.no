"""Add kommune sort index for faster municipality sorting

Revision ID: m1n2o3p4q5r6
Revises: k1l2m3n4o5p6
Create Date: 2024-12-25

Creates a functional index on forretningsadresse->>'kommune' (JSONB extracted text)
to support efficient ORDER BY when sorting companies by municipality name.
"""
from alembic import op

revision = 'm1n2o3p4q5r6'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create index for kommune sorting using JSONB extraction."""
    # Use CONCURRENTLY to avoid locking the table during index creation
    # This requires running outside a transaction
    op.execute("COMMIT")
    
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_kommune "
        "ON bedrifter ((forretningsadresse->>'kommune'));"
    )
    
    # Composite index for NACE + kommune for industry-filtered queries
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_nace_kommune "
        "ON bedrifter (naeringskode text_pattern_ops, (forretningsadresse->>'kommune'));"
    )


def downgrade() -> None:
    """Drop the kommune indexes."""
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_kommune;")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_nace_kommune;")
