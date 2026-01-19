"""add_geocoded_count_index

Revision ID: d9c85dd327d1
Revises: e23a88891398
Create Date: 2026-01-19 08:13:46.172018

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd9c85dd327d1'
down_revision: Union[str, Sequence[str], None] = 'e23a88891398'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# CRITICAL: Disable transaction for concurrent index creation
# Postgres requires CREATE INDEX CONCURRENTLY to run outside a transaction block.
render_as_batch = False
commit_as_transaction = False


def upgrade() -> None:
    """Add partial index for geocoded companies concurrently."""
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bedrifter_geocoded 
        ON bedrifter (orgnr) 
        WHERE latitude IS NOT NULL;
    """)


def downgrade() -> None:
    """Remove partial index for geocoded companies concurrently."""
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_bedrifter_geocoded;")
