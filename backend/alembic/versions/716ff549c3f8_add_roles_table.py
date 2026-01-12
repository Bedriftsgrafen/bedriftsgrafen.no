"""Add roles table

Revision ID: 716ff549c3f8
Revises: 5a64c78c1fb1
Create Date: 2025-12-14 07:17:38.045176

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "716ff549c3f8"
down_revision: Union[str, Sequence[str], None] = "5a64c78c1fb1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
