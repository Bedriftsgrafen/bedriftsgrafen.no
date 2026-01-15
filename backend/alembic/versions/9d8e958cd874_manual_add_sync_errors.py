"""manual add sync_errors

Revision ID: 9d8e958cd874
Revises: 1b8a1659d72f
Create Date: 2026-01-15 08:32:05.227495

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9d8e958cd874"
down_revision: Union[str, Sequence[str], None] = "1b8a1659d72f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "sync_errors",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("orgnr", sa.String(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_retry_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sync_errors_orgnr"), "sync_errors", ["orgnr"], unique=False)
    op.create_index(op.f("ix_sync_errors_entity_type"), "sync_errors", ["entity_type"], unique=False)
    op.create_index(op.f("ix_sync_errors_status"), "sync_errors", ["status"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_sync_errors_status"), table_name="sync_errors")
    op.drop_index(op.f("ix_sync_errors_entity_type"), table_name="sync_errors")
    op.drop_index(op.f("ix_sync_errors_orgnr"), table_name="sync_errors")
    op.drop_table("sync_errors")
