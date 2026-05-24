#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

DB_CONTAINER="${DB_CONTAINER:-bedriftsgrafen-db}"
DB_NAME="${DB_NAME:-bedriftsgrafen}"
DB_ADMIN_USER="${DB_ADMIN_USER:-admin}"
SECRET_FILE="${POSTGRES_EXPORTER_PASSWORD_FILE:-$PROJECT_ROOT/observability/secrets/postgres_exporter_password}"

if [[ ! -s "$SECRET_FILE" ]]; then
  echo "Missing postgres exporter password file: $SECRET_FILE" >&2
  echo "Create it with: openssl rand -base64 36 > observability/secrets/postgres_exporter_password" >&2
  exit 1
fi

chmod 0444 "$SECRET_FILE"
exporter_password="$(tr -d '\n' < "$SECRET_FILE")"

docker exec -i "$DB_CONTAINER" psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_ADMIN_USER" \
  -d "$DB_NAME" \
  -v db_name="$DB_NAME" \
  -v exporter_password="$exporter_password" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'postgres_exporter') THEN
    CREATE USER postgres_exporter;
  END IF;
END
$$;

ALTER USER postgres_exporter WITH PASSWORD :'exporter_password';
ALTER ROLE postgres_exporter WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE postgres_exporter SET search_path TO pg_catalog;
GRANT CONNECT ON DATABASE :"db_name" TO postgres_exporter;

DO $$
BEGIN
  IF NOT pg_has_role('postgres_exporter', 'pg_monitor', 'member') THEN
    GRANT pg_monitor TO postgres_exporter;
  END IF;
END
$$;

SELECT
  rolname,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolreplication,
  pg_has_role('postgres_exporter', 'pg_monitor', 'member') AS has_pg_monitor
FROM pg_roles
WHERE rolname = 'postgres_exporter';
SQL

unset exporter_password
echo "postgres_exporter role is ready."