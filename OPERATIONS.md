# Operations Guide

Production operations and maintenance for Bedriftsgrafen.no.

## Quick Reference

| Environment | URL |
|-------------|-----|
| Production | https://bedriftsgrafen.no |
| Monitoring | https://monitor.bedriftsgrafen.no |
| API Docs | https://bedriftsgrafen.no/api/docs |
| Local Dev | http://localhost:5173 |

```bash
./scripts/system_health_check.sh     # Full health check
npm run smoke:prod                   # Release smoke and search latency check
docker compose ps                     # Container status
curl http://localhost:8000/stats       # API stats
docker compose -f docker-compose.observability.yml ps  # Observability status
```

---

## Release Smoke

Run this after a production rebuild, or before a release when you need a quick health and search-speed baseline:

```bash
npm run smoke:prod
```

The smoke check verifies API health, company search, person autocomplete, detailed person results, CSP headers for analytics, and recent backend error logs. It does not source `.env`, so affiliate tracker URLs containing `&` cannot accidentally spawn shell background jobs.

Latency budgets can be adjusted without editing the script:

```bash
PERSON_RESULTS_BUDGET=0.9 RUNS=10 npm run smoke:prod
BASE_URL=http://localhost:5173 npm run smoke:prod
```

---

## Financial Data Sync Service

Systemd service that continuously imports financial statements from Brønnøysund.

```bash
# Install (one-time)
sudo cp scripts/bedriftsgrafen-regnskap-sync.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable bedriftsgrafen-regnskap-sync

# Control
sudo systemctl start|stop|restart|status bedriftsgrafen-regnskap-sync
journalctl -u bedriftsgrafen-regnskap-sync -f
```

At 5 req/sec, processes ~432,000 companies/day.

---

## Backups

Daily full backup at 01:00 via systemd timer (`backup-system.timer`).

```bash
./scripts/backup-status.sh                        # Check status
sudo systemctl start backup-system.service         # Manual trigger

# Manual backup/restore
docker exec bedriftsgrafen-db pg_dump -U admin bedriftsgrafen | gzip > backups/backup_$(date +%Y%m%d).sql.gz
gunzip < backups/backup_YYYYMMDD.sql.gz | docker exec -i bedriftsgrafen-db psql -U admin -d bedriftsgrafen
```

Retention: 7 snapshots, stored on external SSD (`/mnt/ssd/backups/`).

---

## Docker

```bash
docker compose -f docker-compose.dev.yml up -d --build                           # Dev (hot reload)
docker compose -f docker-compose.prod.yml up -d --build                          # Production
docker compose -f docker-compose.prod.yml build frontend && docker compose -f docker-compose.prod.yml up -d  # Quick frontend rebuild
docker compose -f docker-compose.prod.yml down                                   # Stop
```

---

## Observability

Bedriftsgrafen uses a lightweight Grafana stack for production signals:

- **Grafana**: dashboards at `https://monitor.bedriftsgrafen.no`
- **Prometheus**: API, worker, host, and container metrics
- **Loki + Alloy**: searchable Docker logs
- **cAdvisor**: container CPU/memory metrics
- **node-exporter**: host CPU/RAM/disk metrics
- **postgres_exporter**: PostgreSQL health, locks, connections, vacuum, temp files, and WAL signals
- **Docker socket proxy**: read-limited Docker API access for Alloy log discovery

Application observability notes:

- Backend and worker expose token-protected Prometheus metrics at `/metrics` for internal scraping.
- Brreg upstream calls emit `bedriftsgrafen_brreg_api_requests_total{endpoint,status_code}`.
- Frontend React ErrorBoundary reports production client crashes to `/api/v1/client-errors`; the backend writes sanitized `client_error` lines to Docker stdout for Loki and to `/app/logs/client_errors.log` for local inspection.

The observability stack is separate from the production app stack:

```bash
# One-time secret setup
mkdir -p observability/secrets
[[ -f observability/secrets/grafana_admin_password ]] || openssl rand -base64 36 > observability/secrets/grafana_admin_password
[[ -f observability/secrets/postgres_exporter_password ]] || openssl rand -base64 36 > observability/secrets/postgres_exporter_password
if grep -q '^METRICS_TOKEN=' .env; then
  METRICS_TOKEN=$(grep '^METRICS_TOKEN=' .env | tail -1 | cut -d= -f2-)
else
  METRICS_TOKEN=$(openssl rand -hex 32)
  printf '\nMETRICS_TOKEN=%s\n' "$METRICS_TOKEN" >> .env
fi
printf '%s\n' "$METRICS_TOKEN" > observability/secrets/prometheus_metrics_token
# Optional but recommended: Discord alert delivery.
# Paste the Discord webhook URL into this file locally. Never commit the real URL.
touch observability/secrets/discord_webhook_url

chmod 0444 \
  observability/secrets/grafana_admin_password \
  observability/secrets/prometheus_metrics_token \
  observability/secrets/discord_webhook_url \
  observability/secrets/postgres_exporter_password
```

Create or update the least-privileged PostgreSQL monitoring role after the password file exists:

```bash
scripts/setup_postgres_exporter_role.sh
```

Grafana alerting is provisioned from `observability/grafana/provisioning/alerting/`:

- `bedriftsgrafen-alerts.yml` defines alert rules.
- `discord-contact-point.yml` sends alerts to Discord using `observability/secrets/discord_webhook_url`.
- `notification-policies.yml` routes warning and critical alerts.
- `notification-templates.yml` controls the Discord message body.
- `observability/runbooks/alerts.md` contains first-response steps for each alert.

VS Code may warn that terminal environment injection is disabled for `.env`. That warning does not prevent Docker Compose from reading `.env`; it only means Python terminals will not automatically inherit those variables unless `python.terminal.useEnvFile` is enabled.

```bash
# Start/stop monitoring
docker compose -f docker-compose.observability.yml up -d
docker compose -f docker-compose.observability.yml down

# Check health
docker compose -f docker-compose.observability.yml ps
docker logs --tail 100 monitoring-prometheus
docker logs --tail 100 monitoring-loki
docker logs --tail 100 monitoring-alloy
docker logs --tail 100 monitoring-postgres-exporter
```

Useful spot checks:

```bash
docker exec monitoring-prometheus wget -qO- 'http://localhost:9090/api/v1/query?query=up' | python3 -m json.tool
docker exec monitoring-prometheus wget -qO- 'http://monitoring-loki:3100/loki/api/v1/query_range?query=%7Bcontainer%3D%22bedriftsgrafen-backend%22%7D%20%7C%3D%20%22client_error%22&limit=5&direction=backward' | python3 -m json.tool
docker exec monitoring-prometheus wget -qO- 'http://localhost:9090/api/v1/query?query=sum%20by%20(endpoint%2Cstatus_code)%20(rate(bedriftsgrafen_brreg_api_requests_total%5B5m%5D))' | python3 -m json.tool
```

If aliases are loaded, use `observe-discord-test` to send a safe test message and `observe-target-summary` to list unhealthy Prometheus targets.

PostgreSQL exporter validation:

```bash
docker exec monitoring-postgres-exporter wget -qO- http://localhost:9187/metrics | grep -E '^(pg_up|pg_stat_database_numbackends|pg_database_size_bytes)'
docker exec monitoring-prometheus wget -qO- 'http://localhost:9090/api/v1/query?query=pg_up' | python3 -m json.tool
docker exec monitoring-prometheus wget -qO- 'http://localhost:9090/api/v1/query?query=pg_stat_database_numbackends%7Bdatname%3D%22bedriftsgrafen%22%7D' | python3 -m json.tool
```

PostgreSQL alerts are intentionally limited to meaningful first-response signals: exporter down, database unreachable, high connection usage, deadlocks, long transactions, and temp-byte spikes. Query-level analysis with `pg_stat_statements` is a later phase because it requires PostgreSQL configuration changes and a planned restart.

Nginx Proxy Manager should point `monitor.bedriftsgrafen.no` to:

| Field | Value |
|-------|-------|
| Scheme | `http` |
| Forward hostname | `monitoring-grafana` |
| Forward port | `3000` |
| SSL | Let's Encrypt, Force SSL enabled |
| Websockets | Enabled |

Recommended Access List settings for `monitor`:

- Add at least one username/password under **Authorizations**.
- Keep **Pass Auth to Upstream** disabled.
- Keep **Satisfy Any** enabled if you use Basic Auth plus IP rules; this lets valid Basic Auth work even when no static IP allow rule matches.
- On **Rules**, remove any empty `Allow` row. Keep `Deny all` as the final rule, or add concrete trusted IP/CIDR allow rules above it.

Grafana must remain authenticated. Do not expose Prometheus, Loki, cAdvisor, or node-exporter publicly.

## Adtraction Revenue Alerts

Adtraction business alerts are separate from Grafana operational alerts. They notify Discord only for previously unseen money events:

- commission-bearing transactions such as CPL/leads where `commission > 0`
- generated Adtraction payments

Clicks, click-only statistics, zero-commission rows, and balance changes alone do not trigger Discord alerts.

Secrets are file-based:

```bash
printf '%s\n' '<adtraction-api-token>' > observability/secrets/ADTRACTION_API_KEY
printf '%s\n' '<discord-webhook-url>' > observability/secrets/ADTRACTION_DISCORD_WEB_HOOK
chmod 0444 \
  observability/secrets/ADTRACTION_API_KEY \
  observability/secrets/ADTRACTION_DISCORD_WEB_HOOK
```

Manual checks:

```bash
backend/.venv/bin/python backend/scripts/adtraction_notifier.py --dry-run --lookback-days 365 --currency NOK
backend/.venv/bin/python backend/scripts/adtraction_notifier.py --send-discord --lookback-days 365 --currency NOK
```

The script writes dedupe state to `observability/state/adtraction_notifier_state.json`, which is ignored by git. A normal send writes all current event IDs, so the same CPL/payment is not sent again.

Automatic delivery uses a short-lived systemd timer, not a long-running container:

```bash
# One-time install/update
sudo cp scripts/bedriftsgrafen-adtraction-notifier.service /etc/systemd/system/
sudo cp scripts/bedriftsgrafen-adtraction-notifier.timer /etc/systemd/system/
sudo systemctl daemon-reload

# Enable automatic hourly polling
sudo systemctl enable --now bedriftsgrafen-adtraction-notifier.timer

# Inspect status and logs
systemctl status bedriftsgrafen-adtraction-notifier.timer
journalctl -u bedriftsgrafen-adtraction-notifier.service -n 100 --no-pager
```

The timer runs 10 minutes after boot and then roughly hourly, with up to 10 minutes of randomized delay. It is intentionally inert unless `.env` contains `ADTRACTION_NOTIFIER_ENABLED=true`; this makes it safe to install before secrets are ready.

### Manual Checks

```bash
docker stats --no-stream                                          # Container resources
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen \
  -c "SELECT pg_size_pretty(pg_database_size('bedriftsgrafen'));" # DB size
docker exec bedriftsgrafen-redis redis-cli ping                   # Redis health
docker logs --tail 20 bedriftsgrafen-worker                       # Worker/scheduler logs
curl -s http://localhost:8000/health | python3 -m json.tool       # API health
curl -s http://localhost:8000/health/ready | python3 -m json.tool # API readiness
df -h /                                                           # Disk space
```

### Disk Cleanup

Use these before adding new services or after repeated rebuilds:

```bash
df -h /
docker system df
docker builder prune -af                 # Safe: removes build cache only
docker image prune -a --filter "until=168h" -f
```

Review unused volumes before deleting them. They can contain old project data even when Docker marks them dangling:

```bash
docker system df -v
docker volume ls -qf dangling=true
# Only after review:
docker volume prune -f
```

---

## Troubleshooting

**Service not running:**
```bash
sudo systemctl status bedriftsgrafen-regnskap-sync
journalctl -u bedriftsgrafen-regnskap-sync -n 100
```

**DB connection failed:**
```bash
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT 1;"
docker compose restart bedriftsgrafen-db
```

**Disk space full:**
```bash
find backups -name "*.sql.gz" -mtime +7 -delete
docker system prune -a
```
