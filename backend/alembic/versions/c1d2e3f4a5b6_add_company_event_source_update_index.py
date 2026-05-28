"""Add source update lookup index for company events.

Revision ID: c1d2e3f4a5b6
Revises: b8c9d0e1f2a3
Create Date: 2026-05-28
"""

from collections.abc import Sequence

from alembic import op


revision: str = "c1d2e3f4a5b6"
down_revision: str | Sequence[str] | None = "b8c9d0e1f2a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_company_events_type_orgnr_source_update "
        "ON company_events (event_type, orgnr, source_update_id) "
        "WHERE source_update_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_company_events_type_orgnr_source_update")
