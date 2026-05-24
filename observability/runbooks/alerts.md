# Bedriftsgrafen Alert Runbooks

These checks are intentionally short. Start here, then use Grafana Explore for metrics and Loki logs.

## API Target Down

1. Check containers: `prod-ps` and `observe-ps`.
2. Check readiness: `curl -fsS http://localhost:8000/health/ready`.
3. Inspect logs: `prod-backend-logs` or `prod-worker-logs`.
4. In Grafana, check `Bedriftsgrafen Overview` for backend/worker status, CPU, memory, and recent logs.

Likely causes: container restart loop, DB/Redis dependency failure, bad deploy, missing metrics token.

## Monitoring Target Down

1. Check monitoring containers: `observe-ps`.
2. Check Prometheus targets: `observe-targets`.
3. Inspect the affected service logs, for example `observe-prometheus-logs`, `observe-loki-logs`, or `observe-alloy-logs`.

Likely causes: exporter restart, Docker network issue, bad provisioning reload, socket proxy permission mismatch.

## PostgreSQL Exporter Down

1. Check the exporter container: `docker compose -f docker-compose.observability.yml ps postgres-exporter`.
2. Inspect logs: `docker logs --tail 100 monitoring-postgres-exporter`.
3. Confirm the secret exists and is readable by Docker: `ls -l observability/secrets/postgres_exporter_password`.
4. Check Prometheus targets: `observe-targets`.

Likely causes: missing secret, bad Docker network attachment, exporter crash, or a bad collector flag.

## PostgreSQL Unreachable

1. Confirm the DB container is running: `docker ps --filter name=bedriftsgrafen-db`.
2. Test DB access with the exporter role from the DB container: `docker exec bedriftsgrafen-db psql -U postgres_exporter -d bedriftsgrafen -c "SELECT 1;"`.
3. Verify the role has `pg_monitor`: `docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT pg_has_role('postgres_exporter', 'pg_monitor', 'member');"`.
4. Check whether the production internal network still exists: `docker network inspect bedriftsgrafen_internal-net`.

Likely causes: changed password, missing role grant, DB restart, Docker network issue, or PostgreSQL refusing connections.

## PostgreSQL Connection Usage High

1. Check active sessions: `docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT state, usename, application_name, count(*) FROM pg_stat_activity GROUP BY 1,2,3 ORDER BY count(*) DESC;"`.
2. Look for many `idle in transaction` sessions or a sudden spike from backend/worker containers.
3. Compare with API p95 and 5xx panels in Grafana.
4. If the pressure is caused by a stuck import or sync job, pause that job before restarting core services.

Likely causes: connection leak, import/sync spike, slow queries holding connections, or too-low pool limits for current load.

## PostgreSQL Deadlocks Detected

1. Check PostgreSQL logs near the alert time: `docker logs --since 30m bedriftsgrafen-db | grep -i deadlock`.
2. Inspect active queries and transactions: `docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT pid, state, wait_event_type, wait_event, now() - xact_start AS tx_age, query FROM pg_stat_activity WHERE datname = 'bedriftsgrafen' ORDER BY tx_age DESC NULLS LAST LIMIT 20;"`.
3. Check whether imports, materialized view refreshes, or admin jobs were running.
4. If deadlocks repeat, capture the conflicting SQL from logs before changing code or restarting services.

Likely causes: conflicting writes, long transactions, concurrent maintenance jobs, or inconsistent row/table lock ordering.

## PostgreSQL Long Transaction

1. Find the oldest transaction: `docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT pid, usename, application_name, state, now() - xact_start AS tx_age, query FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY xact_start LIMIT 10;"`.
2. If the oldest session is `idle in transaction`, identify the owning service before terminating it.
3. Check whether autovacuum is being blocked or table dead tuples are rising.
4. Prefer fixing the caller or stopping the offending job over restarting PostgreSQL.

Likely causes: leaked transaction scope, stuck import, manual psql session, or a long maintenance query.

## PostgreSQL Temp Bytes Spike

1. Check whether imports, refresh jobs, or search-heavy traffic started around the alert time.
2. Inspect active queries: `docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT pid, now() - query_start AS age, state, query FROM pg_stat_activity WHERE datname = 'bedriftsgrafen' ORDER BY query_start LIMIT 20;"`.
3. Compare temp-byte rate with API latency and host disk pressure.
4. If the same endpoint or job repeats, investigate sort/hash plans and missing indexes before raising memory settings.

Likely causes: large sorts, hash joins, materialized view refreshes, missing indexes, or broad analytics queries.

## Root Disk Usage High

1. Check disk: `df -h /` and `docker system df`.
2. Check Docker volumes before pruning anything: `docker volume ls`.
3. Prefer safe cleanup first: old build cache and unused images. Do not prune volumes unless you have verified what they contain.
4. Check whether logs are growing unexpectedly: `docker ps --size` and `du -sh logs backend/logs observability 2>/dev/null`.

Likely causes: Docker build cache, old images, large PostgreSQL data, Loki/Prometheus retention growth, log volume growth.

## Host Memory Usage High

1. Check containers: `docker stats --no-stream`.
2. Check DB/backend pressure first; they are the largest expected consumers.
3. Inspect recent traffic, latency, and 5xx panels in Grafana.
4. If memory pressure is sustained, consider restarting only the leaking service, not the whole stack.

Likely causes: PostgreSQL cache pressure, backend query spikes, import/sync workload, too many concurrent requests.

## API 5xx Rate High

1. Open Grafana Explore and query Loki for backend errors from the last 15 minutes.
2. Check readiness: `curl -fsS http://localhost:8000/health/ready`.
3. Check DB and Redis health in the readiness response.
4. Look for recent deploys or config changes.

Likely causes: DB timeout, unhandled backend exception, upstream API issue, migration mismatch.

## API Latency P95 High

1. Compare latency with CPU, memory, and DB-related logs in the same time window.
2. Check slow endpoints in backend logs if request logging has endpoint timings.
3. Check whether imports or sync jobs are running at the same time.
4. If latency is DB-bound, inspect PostgreSQL activity before restarting services.

Likely causes: slow database query, connection pool pressure, CPU saturation, external API waits.

## Sync Errors Detected

1. Check worker logs: `prod-worker-logs`.
2. In Grafana, inspect `Sync Operations Last Hour` and Loki logs for `error` near the alert time.
3. Check whether Bronnoysund or SSB upstream calls are failing.
4. If errors are retryable, let the worker recover; if they repeat, pause/limit the batch before data quality degrades.

Likely causes: upstream API failure, malformed payload, DB constraint issue, credentials/rate-limit problem.