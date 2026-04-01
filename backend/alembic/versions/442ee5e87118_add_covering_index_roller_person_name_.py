"""add_covering_index_roller_person_name_sort

Revision ID: 442ee5e87118
Revises: 0e826bcc8bd2
Create Date: 2026-04-01 20:49:09.515406

"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "442ee5e87118"
down_revision: str | Sequence[str] | None = "0e826bcc8bd2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add covering index for person search sorted by name.

    Enables index-only scan on roller(person_navn, foedselsdato)
    with included columns (orgnr, fratraadt, id), eliminating
    heap lookups during name-sorted person search.
    Reduces query time from ~11s to ~13ms.
    """
    op.execute(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_roller_person_name_sort_covering "
        "ON roller (person_navn, foedselsdato) "
        "INCLUDE (orgnr, fratraadt, id) "
        "WHERE person_navn IS NOT NULL"
    )


def downgrade() -> None:
    """Remove covering index."""
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_roller_person_name_sort_covering")
