#!/bin/bash
# Refresh all materialized views in bedriftsgrafen database
# This script is run periodically by cron to keep views up-to-date

set -e

# Load environment variables from .env file (parent directory)
if [ -f "$(dirname "$0")/../.env" ]; then
    export $(grep -v '^#' "$(dirname "$0")/../.env" | sed 's/\r$//' | xargs)
fi

# Default to 'admin' and 'bedriftsgrafen' if not set
DB_USER="${DATABASE_USER:-admin}"
DB_NAME="${DATABASE_NAME:-bedriftsgrafen}"

# Note: We must run this against the 'db' container since the backend container lacks psql
docker exec -i bedriftsgrafen-db psql -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Refresh all materialized views CONCURRENTLY
-- This allows reads to continue during the refresh process.
-- Requires a unique index on the views.

SELECT 'Refreshing company_totals...';
REFRESH MATERIALIZED VIEW CONCURRENTLY company_totals;

SELECT 'Refreshing orgform_counts...';
REFRESH MATERIALIZED VIEW CONCURRENTLY orgform_counts;

SELECT 'Refreshing industry_stats...';
REFRESH MATERIALIZED VIEW CONCURRENTLY industry_stats;

-- Log completion
SELECT 'Materialized views refreshed at ' || NOW();
EOF

echo "$(date): Materialized views refreshed successfully"
