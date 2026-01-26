"""add_sitemap_optimization_indices

Revision ID: 4fde8b40baa7
Revises: 7a496d410589
Create Date: 2026-01-26 12:08:44.667949

Performance optimization for sitemap generation queries.
- Partial index on bedrifter for commercial company filtering (foretaksregisteret = true)
- Composite index on roller for person sitemap keyset pagination
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "4fde8b40baa7"
down_revision: Union[str, Sequence[str], None] = "7a496d410589"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add indices to optimize sitemap generation queries.

    NOTE: These indices were created manually with CREATE INDEX CONCURRENTLY
    outside of a transaction. This migration is a no-op but documents the indices.

    1. Partial index on bedrifter for commercial companies
       - Filters to registrert_i_foretaksregisteret = true (most common case)
       - Much smaller than full table scan

    2. Partial composite index on roller for person sitemaps
       - Only includes rows with non-null person_navn and foedselsdato
       - Covers the ORDER BY clause for keyset pagination
    """
    # Indices are idempotent (IF NOT EXISTS) - safe to run multiple times
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_bedrifter_commercial_partial
        ON bedrifter (orgnr)
        WHERE registrert_i_foretaksregisteret = true
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_roller_person_sitemap_covering
        ON roller (person_navn, foedselsdato, updated_at)
        WHERE person_navn IS NOT NULL AND foedselsdato IS NOT NULL
    """)


def downgrade() -> None:
    """Remove sitemap optimization indices."""
    op.execute("DROP INDEX IF EXISTS idx_bedrifter_commercial_partial")
    op.execute("DROP INDEX IF EXISTS idx_roller_person_sitemap_covering")
