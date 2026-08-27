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
3. If `application_name = 'postgres_fdw'`, inspect other databases/services that may be using Bedriftsgrafen foreign tables; the owning transaction can be in the consumer database while Bedriftsgrafen only shows the remote FDW session.
4. Check whether autovacuum is being blocked or table dead tuples are rising.
5. Prefer fixing the caller or stopping the offending job over restarting PostgreSQL.

Likely causes: leaked transaction scope, stuck import, manual psql session, a long maintenance query, or an external FDW consumer holding a remote transaction open.

## PostgreSQL Temp Bytes Spike

1. Confirm the alert window: `increase(pg_stat_database_temp_bytes{datname="bedriftsgrafen"}[15m])` in Grafana Explore.
2. Check whether materialized view refreshes, imports, or search-heavy traffic started around the alert time.
3. Inspect active queries: `docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT pid, now() - query_start AS age, state, query FROM pg_stat_activity WHERE datname = 'bedriftsgrafen' ORDER BY query_start LIMIT 20;"`.
4. Compare temp-byte rate with API latency and host disk pressure.
5. Remember that `pg_stat_database.temp_bytes` is cumulative; use `increase(...)` for alert-window analysis.
6. If the same endpoint or job repeats, investigate sort/hash plans and missing indexes before raising memory settings.

Likely causes: large sorts, hash joins, materialized view refreshes, missing indexes, or broad analytics queries.

## Root Disk Usage High

1. Check disk: `df -h /` and `docker system df`.
2. Run safe cleanup first: `scripts/disk-cleanup.sh` from the repository root.
3. Check Docker volumes before pruning anything: `docker system df -v` and `docker volume ls -qf dangling=true`.
4. Inspect any large dangling volume read-only before deletion: `docker run --rm --user 0 -v <volume>:/mnt:ro --entrypoint sh bedriftsgrafen-backend -lc 'du -sh /mnt; find /mnt -maxdepth 2 -mindepth 1 -printf "%y %p\n" | head -50'`.
5. Check whether logs are growing unexpectedly: `docker ps --size`, `journalctl --disk-usage`, and `du -sh logs backend/logs observability 2>/dev/null`.
6. If user caches are the pressure source, review `~/.gemini/antigravity/browser_recordings`, `~/.npm`, `~/.cache`, and `~/.vscode-server` manually before deleting user data.

Likely causes: Docker build cache, old images, large PostgreSQL data, Loki/Prometheus retention growth, log volume growth.

## Host Memory Usage High

1. Check containers: `docker stats --no-stream`.
2. Check DB/backend pressure first; they are the largest expected consumers.
3. Inspect recent traffic, latency, and 5xx panels in Grafana.
4. If memory pressure is sustained, consider restarting only the leaking service, not the whole stack.

Likely causes: PostgreSQL cache pressure, backend query spikes, import/sync workload, too many concurrent requests.

## API 5xx Rate High

1. Open Grafana Explore and query Loki for backend errors from the last 15 minutes.
2. Confirm the 5xx are real before debugging the application. Compare the alert rate against the request log: `docker logs bedriftsgrafen-backend --since 60m 2>&1 | grep -oE ' - [0-9]{3} - ' | sort | uniq -c | sort -rn`. If the log shows no 5xx, treat it as a metrics artifact and go to step 3.
3. Check the counter for monotonicity. Query the raw series (not `rate()`) in Grafana Explore: `http_requests_total{job="bedriftsgrafen-api",status="5xx"}`. If the value cycles between a handful of fixed numbers, the per-worker registries are not being aggregated — verify `PROMETHEUS_MULTIPROC_DIR` is set in the container (`docker exec bedriftsgrafen-backend env | grep PROMETHEUS`) and that `/tmp/prometheus_multiproc` is a tmpfs mount. A second tell: `increase(...[10m])` exceeding the counter's own total value.
4. Check readiness: `curl -fsS http://localhost:8000/health/ready`.
5. Check DB and Redis health in the readiness response.
6. Look for recent deploys or config changes.

Likely causes: DB timeout, unhandled backend exception, upstream API issue, migration mismatch, or unaggregated per-worker metrics producing phantom counter resets.

Background: the backend runs uvicorn with 4 workers (`backend/Dockerfile.prod`). Each worker keeps its own in-process `prometheus_client` registry, so a scrape reaches one worker at random. Without `PROMETHEUS_MULTIPROC_DIR` the scraped value steps up and down, Prometheus reads every downward step as a counter reset, and `rate()`/`increase()` inflate far above real traffic.

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

## Widespread 502 on /api/ after a backend deploy

Symptom: pages render but every API call fails; `docker logs bedriftsgrafen-frontend` shows
`connect() failed (111: Connection refused) ... upstream: "http://<old-ip>:8000/..."`.

Cause: the frontend nginx cached the backend's container IP. A literal hostname in `proxy_pass`
is resolved once at config load, so a redeployed backend (new IP) leaves the proxy talking to a
dead address until nginx restarts. This caused an outage on 2026-08-04 (14:35–14:44).

`frontend/nginx.conf` now routes every `proxy_pass` through a variable with
`resolver 127.0.0.11 valid=10s`, which forces per-request resolution. If this recurs, verify those
two things are still present — a literal hostname reintroduces the fault. Immediate mitigation is
`docker compose -f docker-compose.prod.yml restart frontend`.

## Rate limiting: where the limits live

Two independent layers; check both when investigating 429s or suspected scraping.

1. **Edge (`frontend/nginx.master.conf`)** — `limit_req` zones keyed on the real client IP,
   recovered from `X-Forwarded-For` via `set_real_ip_from`/`real_ip_recursive`. `api_general`
   (20r/s), `api_roles` (2r/s) for `/api/v1/companies/{orgnr}/roles`, and
   `api_brreg_refresh` (1r/s) for subunit refreshes and `POST /fetch`. Returns 429, and logs at
   `warn` level in the frontend error log. Holds even if the application limiter misbehaves.
2. **Application (`backend/limiter.py`)** — slowapi, per-IP, Redis-backed (db 1).

`limiter.py` must keep `key_style="endpoint"`. slowapi's default, `"url"`, puts the concrete path
in the bucket key, so any endpoint with a path parameter is bypassed by varying that parameter —
a scraper used this to pull 167k `/roles` responses at up to 15 req/s on 2026-08-04 without one
429. `backend/tests/unit/test_limiter.py` guards this.

The application adds sustained caps to every public route that can call Brreg: roles (60/min),
subunits (30/min), and `POST /fetch` (10/min), each per client. The role service additionally
rejects unknown local companies before upstream access, negative-caches successful empty results,
and serializes same-company cache misses across workers with a PostgreSQL advisory lock.

Note that a blocked or throttled client must not surface as a server error: the User-Agent
blocklist returns 403 rather than nginx's 444, because nginx-proxy-manager converts a closed
connection into a 502 and that would feed the API-5xx alert.

## Brreg Egress Protection

FAKTA: These alerts use only metrics collected after the Prometheus multiprocess correction. Do not use
pre-2026-08-08 07:32 UTC counter history for baseline or threshold decisions.

FAKTA: The Brreg egress dashboard is `Bedriftsgrafen Brreg Egress`. Start there, then open Grafana Explore
with the exact PromQL below.

1. Check whether the guard is configured: `bedriftsgrafen_brreg_egress_config`.
2. Check current cap pressure:
   `((sum(rate(bedriftsgrafen_brreg_http_attempts_total[5m])) / clamp_min(max(bedriftsgrafen_brreg_egress_config{setting="rate_per_second"}), 0.001)) * (max(bedriftsgrafen_brreg_egress_config{setting="enabled"}) == bool 1) * (max(bedriftsgrafen_brreg_egress_config{setting="rate_per_second"}) > bool 0))`.
3. If `bedriftsgrafen_brreg_guard_decisions_total{result="waited"}` increased, traffic reached the shared guard and had to queue.
4. If `bedriftsgrafen_brreg_guard_decisions_total{result="rejected"}` increased, separate public/unknown traffic from background traffic before assessing user impact.
5. For Brreg 429, query:
   `sum(increase(bedriftsgrafen_brreg_api_requests_total{status_code="429"}[15m]))`.
6. For timeout/circuit problems, query:
   Query `bedriftsgrafen_brreg_http_attempts_total{status_category="timeout"}` for real timeouts and
   `bedriftsgrafen_brreg_circuit_open_total` for transitions from closed to open. Locally blocked operations
   remain visible as `bedriftsgrafen_brreg_api_requests_total{status_code="circuit_open"}`.
   Circuit state is endpoint-scoped, so use the `endpoint` label to identify the isolated Brreg surface.
   Circuit failures are counted per exhausted logical operation, not once per internal HTTP retry.
   Transient financial failures persist `financial_poll_failure_count` and `financial_poll_retry_after` on
   `bedrifter`; inspect due retries before manually resetting either field.
7. For Redis guard failures, query:
   `sum(increase(bedriftsgrafen_brreg_guard_redis_errors_total[5m])) by (error_type)`.
8. Compare public request pressure with logical operations and attempts:
   `sum(rate(http_requests_total{job="bedriftsgrafen-api",service="backend"}[5m]))`,
   `sum(rate(bedriftsgrafen_brreg_logical_operations_total[5m]))`,
   `sum(rate(bedriftsgrafen_brreg_http_attempts_total[5m]))`.
9. Check Loki for correlated client patterns without using orgnr/IP as metric labels:
   `{container=~"bedriftsgrafen-backend|bedriftsgrafen-frontend"} |~ "(429|RATE_LIMITED|Brreg|brreg|guard)"`.

Likely causes: scraping burst, force-refresh abuse, background sync overlap, Brreg degradation, Redis failure,
or egress cap configured below legitimate traffic.

Immediate actions:

1. Do not raise `BRREG_EGRESS_RATE_PER_SECOND` or `BRREG_EGRESS_BURST` during an active incident unless the new value has an explicit production decision.
2. If cached data exists, prefer stale-cache behavior over bypassing the guard.
3. If Redis guard errors are firing, treat Brreg egress as fail-closed until Redis is healthy.
4. If Brreg 429 fires, stop/pause background sync before changing public request limits.

### Brreg Alert Threshold Register

| Alert | PromQL | Window | Active threshold | Data basis | False-positive risk |
| --- | --- | --- | --- | --- | --- |
| Brreg egress at configured cap | `((sum(rate(bedriftsgrafen_brreg_http_attempts_total[5m])) / clamp_min(max(bedriftsgrafen_brreg_egress_config{setting="rate_per_second"}), 0.001)) * (max(bedriftsgrafen_brreg_egress_config{setting="enabled"}) == bool 1) * (max(bedriftsgrafen_brreg_egress_config{setting="rate_per_second"}) > bool 0)) >= bool 1` | 5m, `for: 2m` | mathematical: current attempt rate is at configured enabled cap | configured cap, not historical baseline | Low if cap is correct; silent if guard is disabled or rate is unset |
| Brreg egress guard waited | `sum(increase(bedriftsgrafen_brreg_guard_decisions_total{result="waited",traffic_class=~"public\|unknown"}[5m]))` | 5m, `for: 2m` | any public/unknown wait decision | semantic guard event | Medium; background worker waits are expected during paced sync |
| Brreg public guard rejections | `sum(increase(bedriftsgrafen_brreg_guard_decisions_total{result="rejected",traffic_class=~"public\|unknown"}[5m]))` | 5m, `for: 1m` | any public/unknown rejection | semantic guard event | Low; rejection is user-visible protection |
| Brreg background guard saturation | `(sum(increase(bedriftsgrafen_brreg_guard_decisions_total{result="rejected",traffic_class="background"}[15m])) or vector(0)) >= bool 10` | 15m, `for: 5m` | at least 10 background rejections | semantic guard event | Medium; alerts on sustained worker saturation, not isolated retries |
| Brreg 429 | `sum(increase(bedriftsgrafen_brreg_api_requests_total{status_code="429"}[15m]))` | 15m, `for: 1m` | any upstream 429 | upstream response code | Low; Brreg 429 should be investigated |
| Brreg timeouts | `sum(increase(bedriftsgrafen_brreg_http_attempts_total{status_category="timeout"}[15m]))` | 15m, `for: 5m` | any sustained timeout | local timeout event | Medium; transient upstream network blips can fire |
| Brreg circuit breaker | `sum(increase(bedriftsgrafen_brreg_circuit_open_total[5m]))` | 5m, `for: 1m` | any circuit-open transition | local protection transition | Low |
| Redis guard errors | `sum(increase(bedriftsgrafen_brreg_guard_redis_errors_total[5m]))` | 5m, `for: 1m` | any Redis guard error | guard fail-closed event | Low |
| Backend 429 | `sum(increase(bedriftsgrafen_rate_limit_responses_total{layer="backend"}[5m]))` | 5m, `for: 2m` | any backend 429 | application limiter event | Medium; can be expected during abuse |
| Edge nginx 429 | `sum(count_over_time({container="bedriftsgrafen-frontend"} |~ "(?i)(limiting requests| 429 |status=429)" [5m]))` | 5m, `for: 2m` | any edge limiter event | nginx access/error logs in Loki | Medium; expected during abuse |
| Prometheus API scrape failure | `sum(max_over_time(up{job="bedriftsgrafen-api"}[3m]) == 0)` | 3m, `for: 2m` | any backend/worker target down | scrape health | Low |
| Backend or worker restarted | `sum(changes(container_start_time_seconds{name=~"bedriftsgrafen-(backend|worker)"}[10m]))` | 10m, `for: 1m` | any container start-time change | cAdvisor container metric | Medium around planned deploys |

UKJENT: Representative normal levels for request amplification and cache outcome distribution after the new
instrumentation deploy. The provisioned rules `Request amplification shift (baseline pending)` and
`Cache outcome shift (baseline pending)` are intentionally paused until enough post-deploy samples exist.

### Baseline-dependent Alerts

Deployment record:

- Corrected Brreg instrumentation was first deployed at `2026-08-09 06:46:03 UTC` from commit
  `850024c` with the shared guard enabled at `5 attempts/s`, burst `10`, and wait timeout `0s`.
- A controlled backend-429 alert test was run immediately afterward. It made no Brreg request and is not
  representative traffic for backend-rate-limit baselines.
- The final follow-up deployment started backend and worker at `2026-08-09 06:57:30 UTC` from commit
  `c2a40c6`. Use this as the clean baseline-window start, and do not mix the earlier controlled alert-test
  interval into backend-429 threshold calculations.

Baseline activation checklist:

1. Record the exact deploy timestamp for Brreg instrumentation.
2. Use only data after that timestamp and after 2026-08-08 07:32 UTC.
3. Cover representative weekday/weekend and background-sync cycles.
4. Cross-check Prometheus with nginx/backend logs.
5. For each enabled baseline alert, document samples, p95/p99 or robust deviation method, normal level,
   chosen threshold, and expected false-positive risk before unpausing the rule.

## Edge and Backend 429s

1. Backend 429 PromQL:
   `sum(increase(bedriftsgrafen_rate_limit_responses_total{layer="backend"}[5m]))`.
2. Nginx/Loki query:
   `{container="bedriftsgrafen-frontend"} |~ "(limiting requests| 429 |status=429)"`.
3. Compare with Brreg guard decisions. If nginx/backend 429 rises while Brreg attempts stay flat, local
   rate limiting is absorbing abuse before egress.
4. If 429 and Brreg attempts rise together, check whether a route bypasses cache, negative cache, or single-flight.

Likely causes: scraper burst, path-parameter variation, spoofed client identity, force-refresh abuse, or an
overly strict route limiter.

## Backend or Worker Restart

1. Check container state and restart count:
   `docker inspect --format '{{.Name}} {{.State.Health.Status}} {{.RestartCount}}' bedriftsgrafen-backend bedriftsgrafen-worker`.
2. Confirm readiness from inside each container:
   `docker exec bedriftsgrafen-backend curl -fsS http://localhost:8000/health/ready`;
   `docker exec bedriftsgrafen-worker curl -fsS http://localhost:8000/health/ready`.
3. Inspect logs since the restart:
   `docker logs --since 15m bedriftsgrafen-backend` and `docker logs --since 15m bedriftsgrafen-worker`.
4. If this followed a schema change, verify migration state before retrying deploy:
   `docker exec -it bedriftsgrafen-backend alembic current`.

Likely causes: bad deploy, missing migration, missing environment variable, Redis/DB dependency failure, or
Prometheus multiprocess directory permission problems.
