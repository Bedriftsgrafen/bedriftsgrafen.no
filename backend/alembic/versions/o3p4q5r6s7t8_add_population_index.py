"""Add index for municipality_population table

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
Create Date: 2024-12-30

Creates index on municipality_population(year, municipality_code) for fast population lookups.
"""

from alembic import op

# revision identifiers
revision = "o3p4q5r6s7t8"
down_revision = "n2o3p4q5r6s7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create index for fast population lookups."""
    # Index for year + municipality_code (most common query pattern)
    # Using regular CREATE INDEX (not CONCURRENTLY) since Alembic runs in transaction
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_municipality_population_year_code "
        "ON municipality_population (year, municipality_code);"
    )


def downgrade() -> None:
    """Drop the population index."""
    op.execute("DROP INDEX IF EXISTS idx_municipality_population_year_code;")
