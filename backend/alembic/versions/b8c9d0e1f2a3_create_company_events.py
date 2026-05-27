"""create company events

Revision ID: b8c9d0e1f2a3
Revises: 7c9a1b2d3e4f
Create Date: 2026-05-27 17:10:00.000000

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b8c9d0e1f2a3"
down_revision: str | Sequence[str] | None = "7c9a1b2d3e4f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "company_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("orgnr", sa.String(length=9), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=128), nullable=False),
        sa.Column("source_update_id", sa.String(length=128), nullable=True),
        sa.Column("event_key", sa.String(length=255), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("previous_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint("orgnr ~ '^[0-9]{9}$'", name="ck_company_events_orgnr_9_digits"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_company_events_event_key", "company_events", ["event_key"], unique=True)
    op.execute("CREATE INDEX idx_company_events_orgnr_observed_id ON company_events (orgnr, observed_at DESC, id DESC)")
    op.execute(
        "CREATE INDEX idx_company_events_type_observed_id ON company_events (event_type, observed_at DESC, id DESC)"
    )
    op.execute("CREATE INDEX idx_company_events_observed_brin ON company_events USING brin (observed_at)")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_company_events_observed_brin", table_name="company_events")
    op.drop_index("idx_company_events_type_observed_id", table_name="company_events")
    op.drop_index("idx_company_events_orgnr_observed_id", table_name="company_events")
    op.drop_index("idx_company_events_event_key", table_name="company_events")
    op.drop_table("company_events")
