# Operations Guide

Production operations and maintenance for Bedriftsgrafen.no.

## Quick Reference

| Environment | URL |
|-------------|-----|
| Production | https://bedriftsgrafen.no |
| API Docs | https://bedriftsgrafen.no/api/docs |
| Local Dev | http://localhost:5173 |

```bash
./scripts/system_health_check.sh     # Full health check
npm run smoke:prod                   # Release smoke and search latency check
docker compose ps                     # Container status
curl http://localhost:8000/stats       # API stats
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

## Monitoring

```bash
docker stats --no-stream                                          # Container resources
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen \
  -c "SELECT pg_size_pretty(pg_database_size('bedriftsgrafen'));" # DB size
docker exec bedriftsgrafen-redis redis-cli ping                   # Redis health
docker logs --tail 20 bedriftsgrafen-worker                       # Worker/scheduler logs
curl -s http://localhost:8000/health | python3 -m json.tool       # API health
df -h /                                                           # Disk space
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
