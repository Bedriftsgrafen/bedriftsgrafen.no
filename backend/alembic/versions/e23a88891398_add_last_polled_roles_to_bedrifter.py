"""add last_polled_roles to bedrifter

Revision ID: e23a88891398
Revises: 9d8e958cd874
Create Date: 2026-01-15 09:46:38.160361

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e23a88891398'
down_revision: Union[str, Sequence[str], None] = '9d8e958cd874'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('bedrifter', sa.Column('last_polled_roles', sa.Date(), nullable=True))
    op.create_index(op.f('ix_bedrifter_last_polled_roles'), 'bedrifter', ['last_polled_roles'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_bedrifter_last_polled_roles'), table_name='bedrifter')
    op.drop_column('bedrifter', 'last_polled_roles')
