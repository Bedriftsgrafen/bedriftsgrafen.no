"""Add COALESCE-based municipality expression indexes

Revision ID: w1x2y3z4a5b6
Revises: v6w7x8y9z0a1
Create Date: 2026-04-21

When p1q2r3s4t5u6 switched all location filters to
COALESCE(forretningsadresse, postadresse) and v6w7x8y9z0a1 dropped the old
forretningsadresse-only municipality indexes, no replacement municipality-level
COALESCE indexes were added (only county-level COALESCE indexes were created).

This migration adds two municipality-scoped expression indexes that allow the
planner to do equality lookups on the COALESCE municipality expression:

  idx_bedrifter_muni_eff_stiftelse  — (COALESCE_muni, stiftelsesdato DESC)
    Used by: establishment trend, newest companies sort, revenue sort (geo path)

  idx_bedrifter_muni_eff_konkurs    — (COALESCE_muni, konkursdato DESC) WHERE konkurs
    Used by: bankrupt trend, bankruptcies sort

The indexes were already created CONCURRENTLY in production to avoid write locks;
IF NOT EXISTS guards make this migration idempotent.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "w1x2y3z4a5b6"
down_revision: str | None = "v6w7x8y9z0a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COALESCE_MUNI = "COALESCE(NULLIF(forretningsadresse->>'kommunenummer', ''), NULLIF(postadresse->>'kommunenummer', ''))"


def upgrade() -> None:
    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS idx_bedrifter_muni_eff_stiftelse
        ON bedrifter ({_COALESCE_MUNI}, stiftelsesdato DESC NULLS LAST)
        """
    )
    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS idx_bedrifter_muni_eff_konkurs
        ON bedrifter ({_COALESCE_MUNI}, konkursdato DESC NULLS LAST)
        WHERE konkurs IS TRUE
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_muni_eff_stiftelse")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_muni_eff_konkurs")
