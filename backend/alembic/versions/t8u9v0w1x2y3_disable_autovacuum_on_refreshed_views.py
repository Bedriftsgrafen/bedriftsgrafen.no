"""Disable autovacuum on regularly refreshed materialized views

Revision ID: t8u9v0w1x2y3
Revises: s7t8u9v0w1x2
Create Date: 2026-01-21 12:02:00.000000

Disables autovacuum on materialized views that are refreshed every 5 minutes
by the scheduler. Since they are rebuilt completely on each refresh,
autovacuum is unnecessary and causes lock contention noise in the logs.

Affected views:
- company_totals (refreshed every 5 min)
- industry_stats (refreshed every 5 min)
- county_stats (refreshed every 5 min)
- municipality_stats (refreshed every 5 min)
- latest_accountings (refreshed on accounting sync)

Views NOT affected (need autovacuum):
- industry_subclass_stats (not regularly refreshed)
- orgform_counts (not regularly refreshed)
- latest_financials (not regularly refreshed)
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "t8u9v0w1x2y3"
down_revision = "ef106c015add"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Disable autovacuum on regularly refreshed materialized views
    # These views are rebuilt every 5 minutes, making autovacuum unnecessary
    op.execute("ALTER MATERIALIZED VIEW company_totals SET (autovacuum_enabled = false);")
    op.execute("ALTER MATERIALIZED VIEW industry_stats SET (autovacuum_enabled = false);")
    op.execute("ALTER MATERIALIZED VIEW county_stats SET (autovacuum_enabled = false);")
    op.execute("ALTER MATERIALIZED VIEW municipality_stats SET (autovacuum_enabled = false);")
    op.execute("ALTER MATERIALIZED VIEW latest_accountings SET (autovacuum_enabled = false);")


def downgrade() -> None:
    # Re-enable autovacuum on all views (restore default behavior)
    op.execute("ALTER MATERIALIZED VIEW company_totals RESET (autovacuum_enabled);")
    op.execute("ALTER MATERIALIZED VIEW industry_stats RESET (autovacuum_enabled);")
    op.execute("ALTER MATERIALIZED VIEW county_stats RESET (autovacuum_enabled);")
    op.execute("ALTER MATERIALIZED VIEW municipality_stats RESET (autovacuum_enabled);")
    op.execute("ALTER MATERIALIZED VIEW latest_accountings RESET (autovacuum_enabled);")
