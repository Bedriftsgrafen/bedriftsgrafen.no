"""create_materialized_views

Revision ID: 4cafaf285162
Revises: ff2f220780cb
Create Date: 2026-01-06 09:57:30.039267

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "4cafaf285162"
down_revision: Union[str, Sequence[str], None] = "ff2f220780cb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
