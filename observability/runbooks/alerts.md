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