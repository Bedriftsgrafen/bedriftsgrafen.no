"""Add postnummer index

Revision ID: 362b91673eb9
Revises: 716ff549c3f8
Create Date: 2025-12-14 07:54:49.356339

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = '362b91673eb9'
down_revision: Union[str, Sequence[str], None] = '716ff549c3f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
