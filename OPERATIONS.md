# Bedriftsgrafen.no - Operations Guide

**Last Updated**: 2026-01-05  
**System Version**: 1.1  
**Status**: Production Ready ✅

---

## Quick Reference

### Service URLs
| Environment | URL |
|-------------|-----|
| Production | https://bedriftsgrafen.no |
| Local Dev | http://localhost:5173 |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Database | localhost:5432 (⚠️ Restrict access via firewall in production) |

### Essential Commands

```bash
# System health check
./scripts/system_health_check.sh
# Container status
docker compose ps

# View logs
tail -f logs/regnskap_sync_service.log
tail -f logs/updates.log

# Database stats
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "
SELECT 
  (SELECT COUNT(*) FROM bedrifter) as companies,
  (SELECT COUNT(DISTINCT orgnr) FROM regnskap) as with_financials,
  (SELECT COUNT(*) FROM regnskap) as total_records;"
```

---

## Continuous Financial Data Sync Service

### Install & Start (One-Time Setup)

```bash
# Create log directory
mkdir -p logs

# Install systemd service
sudo cp scripts/bedriftsgrafen-regnskap-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bedriftsgrafen-regnskap-sync
sudo systemctl start bedriftsgrafen-regnskap-sync

# Verify running
sudo systemctl status bedriftsgrafen-regnskap-sync
```

### Service Controls

```bash
sudo systemctl start bedriftsgrafen-regnskap-sync   # Start
sudo systemctl stop bedriftsgrafen-regnskap-sync    # Stop
sudo systemctl restart bedriftsgrafen-regnskap-sync # Restart
sudo systemctl status bedriftsgrafen-regnskap-sync  # Status
journalctl -u bedriftsgrafen-regnskap-sync -f       # Logs
```

**Performance**: At 5 req/sec, processes ~432,000 companies/day. Full 1.1M companies in 2-3 days.

---

## Database Maintenance

### Daily Cron Jobs

```bash
crontab -e

# Add these lines:
0 2 * * * curl -X POST http://localhost:8000/admin/import/updates -H "Content-Type: application/json" -d '{"limit": 1000}' >> logs/updates.log 2>&1
0 3 * * * docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "VACUUM ANALYZE bedrifter; VACUUM ANALYZE regnskap;" >> logs/db_maintenance.log 2>&1
0 4 * * * docker exec bedriftsgrafen-db pg_dump -U admin bedriftsgrafen | gzip > backups/bedriftsgrafen_$(date +\%Y\%m\%d).sql.gz 2>&1
0 5 * * * find backups -name "bedriftsgrafen_*.sql.gz" -mtime +7 -delete
```

### Manual Backup & Restore

```bash
# Backup
docker exec bedriftsgrafen-db pg_dump -U admin bedriftsgrafen | gzip > backups/backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip < backups/backup_20251127.sql.gz | docker exec -i bedriftsgrafen-db psql -U admin -d bedriftsgrafen
```

---

## Docker Management

```bash
# Development mode (hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Production mode
docker compose up -d --build

# Quick frontend rebuild
docker compose build frontend && docker compose up -d

# Stop all
docker compose down

# Restart single service
docker restart bedriftsgrafen-backend
```

---

## Troubleshooting

### Service Not Running

```bash
sudo systemctl status bedriftsgrafen-regnskap-sync
journalctl -u bedriftsgrafen-regnskap-sync -n 100
sudo systemctl restart bedriftsgrafen-regnskap-sync
```

### Database Connection Failed

```bash
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT 1;"
docker compose ps
docker compose restart bedriftsgrafen-db
```

### Disk Space Full

```bash
du -sh *
find backups -name "*.sql.gz" -mtime +7 -delete
docker system prune -a
```

---

## Monitoring

```bash
# API stats
curl http://localhost:8000/stats

# Database size
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "SELECT pg_size_pretty(pg_database_size('bedriftsgrafen'));"

# Container stats
docker stats --no-stream

# Disk space
df -h /
```

---

## Common Operations

### Import Specific Company

```bash
curl -X POST http://localhost:8000/companies/923609016/fetch \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'
```

### Check Company Data

```bash
# Via API
curl "http://localhost:8000/companies/923609016/accounting/2024" | jq

# Via database
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -c "
SELECT orgnr, aar, egenkapital, likviditetsgrad1, ebitda_margin 
FROM regnskap WHERE orgnr = '923609016';"
```

---

## Performance Tuning

Edit `scripts/continuous_regnskap_sync.py`:

```python
# Faster (10 req/sec = 864K/day)
RATE_LIMIT_DELAY = 0.1
BATCH_SIZE = 500

# Slower (2 req/sec = 173K/day)
RATE_LIMIT_DELAY = 0.5
BATCH_SIZE = 50
```

Restart after changes: `sudo systemctl restart bedriftsgrafen-regnskap-sync`

---

## File Locations

| Type | Location |
|------|----------|
| Logs | `logs/` |
| Backups | `backups/` |
| Scripts | `scripts/` |
| Documentation | `*.md` files in root |
| API Reference | `backend/API_ENDPOINTS.md` |

---

## Current Status

- **Total companies**: ~1,153,906
- **With financials**: ~427,306 (37.0%)
- **Sync behavior**: Fetches companies without financials first, then refreshes stale data (>30 days)
