"""add_company_municipality_index

Revision ID: 2f729230c375
Revises: t8u9v0w1x2y3
Create Date: 2026-01-21 14:16:54.341081

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '2f729230c375'
down_revision: Union[str, Sequence[str], None] = 't8u9v0w1x2y3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Use raw SQL for the functional index on JSON field
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_company_municipality_code ON bedrifter ((forretningsadresse->>'kommunenummer'))"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS idx_company_municipality_code")
