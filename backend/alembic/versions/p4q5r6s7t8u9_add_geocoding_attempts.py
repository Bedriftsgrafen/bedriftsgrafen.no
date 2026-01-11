"""add_geocoding_attempts

Revision ID: p4q5r6s7t8u9
Revises: 0ae953d2a491
Create Date: 2026-01-03

Adds geocoding_attempts column to track failed geocoding attempts
and prevent infinite retry loops on addresses that can't be geocoded.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'p4q5r6s7t8u9'
down_revision: str | Sequence[str] | None = '0ae953d2a491'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add geocoding_attempts column with default 0."""
    op.add_column(
        'bedrifter',
        sa.Column('geocoding_attempts', sa.Integer(), nullable=False, server_default='0')
    )
    # Create index for efficient filtering of companies needing geocoding
    op.create_index(
        'ix_bedrifter_geocoding_attempts',
        'bedrifter',
        ['geocoding_attempts'],
        unique=False
    )


def downgrade() -> None:
    """Remove geocoding_attempts column."""
    op.drop_index('ix_bedrifter_geocoding_attempts', table_name='bedrifter')
    op.drop_column('bedrifter', 'geocoding_attempts')
