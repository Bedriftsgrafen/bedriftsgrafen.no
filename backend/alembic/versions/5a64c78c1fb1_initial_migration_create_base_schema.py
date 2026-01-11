"""Initial migration: create base schema

Revision ID: 5a64c78c1fb1
Revises: 
Create Date: 2025-12-13 09:02:52.461894

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = '5a64c78c1fb1'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
