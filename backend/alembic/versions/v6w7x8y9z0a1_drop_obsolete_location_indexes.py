"""Drop obsolete forretningsadresse-only location indexes

Revision ID: v6w7x8y9z0a1
Revises: p1q2r3s4t5u6
Create Date: 2026-04-21

These three indexes were superseded by the COALESCE-based indexes added in
p1q2r3s4t5u6 and are now completely dead (0 scans since rebuild):

  ix_bedrifter_fylkesnummer          — 15 MB — LEFT(forretningsadresse->>'kommunenummer', 2)
  idx_bedrifter_muni_stiftelse       — 29 MB — (forretningsadresse->>'kommunenummer', stiftelsesdato DESC)
  idx_bedrifter_muni_konkurs_partial — 208 kB — same, WHERE konkurs IS TRUE

After p1q2r3s4t5u6 all location filters use COALESCE(forretningsadresse, postadresse),
so the new compound COALESCE indexes handle those query paths instead.
"""

from alembic import op


revision = "v6w7x8y9z0a1"
down_revision = "p1q2r3s4t5u6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_bedrifter_fylkesnummer;")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_muni_stiftelse;")
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_muni_konkurs_partial;")


def downgrade() -> None:
    # Recreate the old forretningsadresse-only indexes
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_bedrifter_fylkesnummer
        ON bedrifter (LEFT(forretningsadresse->>'kommunenummer', 2));
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_bedrifter_muni_stiftelse
        ON bedrifter (
            (forretningsadresse->>'kommunenummer'),
            stiftelsesdato DESC NULLS LAST
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_bedrifter_muni_konkurs_partial
        ON bedrifter (
            (forretningsadresse->>'kommunenummer'),
            konkursdato DESC NULLS LAST
        )
        WHERE konkurs IS TRUE;
    """)
