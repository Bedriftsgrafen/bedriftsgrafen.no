"""add_konkurs_index

Revision ID: ad4923e
Revises: d4ab2eb298ea
Create Date: 2025-12-22 14:20:00.000000

"""

from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ad4923e"
down_revision: Union[str, Sequence[str], None] = "d4ab2eb298ea"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_bedrifter_konkurs", "bedrifter", ["konkurs"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_bedrifter_konkurs", table_name="bedrifter")
