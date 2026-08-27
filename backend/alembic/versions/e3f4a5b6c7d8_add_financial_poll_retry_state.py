"""add financial poll retry state

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-08-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e3f4a5b6c7d8"
down_revision: str | Sequence[str] | None = "d2e3f4a5b6c7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "bedrifter",
        sa.Column(
            "financial_poll_failure_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "bedrifter",
        sa.Column("financial_poll_retry_after", sa.DateTime(timezone=True), nullable=True),
    )

    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY idx_bedrifter_financial_poll_retry_after "
            "ON bedrifter (financial_poll_retry_after) "
            "WHERE financial_poll_retry_after IS NOT NULL"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_bedrifter_financial_poll_retry_after")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("bedrifter", "financial_poll_retry_after")
    op.drop_column("bedrifter", "financial_poll_failure_count")
