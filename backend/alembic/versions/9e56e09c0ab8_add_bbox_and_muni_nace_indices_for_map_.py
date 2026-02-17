"""add bbox and muni_nace indices for map optimization

Revision ID: 9e56e09c0ab8
Revises: 2c34424249ca
Create Date: 2026-02-16 20:31:59.040415

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "9e56e09c0ab8"
down_revision: Union[str, Sequence[str], None] = "2c34424249ca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create composite index for bounding box queries
    op.create_index("idx_bedrifter_location", "bedrifter", ["latitude", "longitude"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_bedrifter_location", table_name="bedrifter")
