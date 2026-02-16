"""merge_heads

Revision ID: bed911bb1f68
Revises: u9v0w1x2y3z4, 4fde8b40baa7
Create Date: 2026-02-16 10:07:05.796333

"""

from typing import Sequence, Union

# No operations needed for merge revision


# revision identifiers, used by Alembic.
revision: str = "bed911bb1f68"
down_revision: Union[str, Sequence[str], None] = ("u9v0w1x2y3z4", "4fde8b40baa7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
