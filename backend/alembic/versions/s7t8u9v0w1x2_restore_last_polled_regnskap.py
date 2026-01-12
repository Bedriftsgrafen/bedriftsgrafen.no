"""restore_last_polled_regnskap

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Create Date: 2026-01-05 15:50:00.000000

Restore last_polled_regnskap column needed for tracking financial polling.
This column was incorrectly dropped in 20d47b99003d.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "s7t8u9v0w1x2"
down_revision: Union[str, Sequence[str], None] = "r6s7t8u9v0w1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Restore the last_polled_regnskap column to bedrifter table."""
    # Add back the column that was incorrectly dropped
    op.add_column("bedrifter", sa.Column("last_polled_regnskap", sa.Date(), nullable=True))

    # Add index for efficient queries on companies needing financial updates
    op.create_index("ix_bedrifter_last_polled_regnskap", "bedrifter", ["last_polled_regnskap"], unique=False)


def downgrade() -> None:
    """Remove the restored column."""
    op.drop_index("ix_bedrifter_last_polled_regnskap", table_name="bedrifter")
    op.drop_column("bedrifter", "last_polled_regnskap")
