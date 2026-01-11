# Continuous Regnskap Sync Service

## Overview

The continuous regnskap sync service runs 24/7 to ensure all companies have up-to-date financial data.

**Features**:
- Fetches financial data for companies without data (priority)
- Re-fetches stale data (older than 30 days)
- Rate-limited (5 req/sec = 432,000 companies/day)
- Auto-restart on crashes/network failures
- Graceful shutdown handling
- Comprehensive logging

## Quick Start

### Install as systemd service (recommended)

```bash
# Set project root (adjust to your installation path)
PROJECT_ROOT="${HOME}/bedriftsgrafen.no"

# Create log directory
mkdir -p "${PROJECT_ROOT}/logs"

# Install service
sudo cp "${PROJECT_ROOT}/scripts/bedriftsgrafen-regnskap-sync.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bedriftsgrafen-regnskap-sync
sudo systemctl start bedriftsgrafen-regnskap-sync

# Check status
sudo systemctl status bedriftsgrafen-regnskap-sync

# View logs
tail -f "${PROJECT_ROOT}/logs/regnskap_sync_service.log"
journalctl -u bedriftsgrafen-regnskap-sync -f
```

### Run manually (testing)

```bash
# Inside Docker container
docker exec -it bedriftsgrafen-backend python3 /app/ops_scripts/continuous_regnskap_sync.py

# Or with logs
docker exec -it bedriftsgrafen-backend python3 /app/ops_scripts/continuous_regnskap_sync.py \
  >> "${PROJECT_ROOT}/logs/regnskap_sync_manual.log" 2>&1
```

## How It Works

### Priority Logic

1. **First priority**: Companies with NO financial data (never fetched)
   - These are processed first until all companies have at least one year
2. **Second priority**: Companies with STALE data (older than 30 days)
   - Sorted by `updated_at` (oldest first)
3. **Idle**: If all companies are fresh, sleep for 1 hour

### Rate Limiting

- **Safe rate**: 5 requests/second (0.2s delay)
- **Daily capacity**: ~432,000 companies
- **1M companies**: 2.3 days (first run)
- **Updates**: Continuous (as new data becomes available)

### Data Handling

- Uses unique constraint `(orgnr, aar)` to prevent duplicates
- Updates existing records if same year data changes
- Creates new records for new years
- Stores complete raw JSON in `raw_data` column

### Error Handling

- **Network errors**: Logged, continues to next company
- **API errors (404)**: Logged as "no data", continues
- **Database errors**: Rolled back, continues
- **Fatal errors**: Retries after 5 minutes
- **Shutdown signals**: Graceful completion of current batch

## Configuration

Edit `${PROJECT_ROOT}/scripts/continuous_regnskap_sync.py`:

```python
RATE_LIMIT_DELAY = 0.2          # Delay between requests (seconds)
BATCH_SIZE = 100                # Companies per batch
RETRY_DELAY = 300               # Retry delay on error (seconds)
REFETCH_THRESHOLD_DAYS = 30     # Re-fetch if older than N days
API_TIMEOUT = 30                # API request timeout (seconds)
```

## Monitoring

### Check service status

```bash
# Service running?
sudo systemctl status bedriftsgrafen-regnskap-sync

# Recent logs
sudo journalctl -u bedriftsgrafen-regnskap-sync -n 50

# Follow logs
tail -f "${PROJECT_ROOT}/logs/regnskap_sync_service.log"
```

### Database queries

```bash
# Companies with financial data
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(DISTINCT orgnr) FROM regnskap;"

# Companies without financial data
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) FROM bedrifter b 
   LEFT JOIN regnskap r ON b.orgnr = r.orgnr 
   WHERE r.id IS NULL;"

# Newest financial data
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT orgnr, aar, updated_at FROM regnskap 
   ORDER BY updated_at DESC LIMIT 10;"

# Oldest financial data (next to update)
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT orgnr, aar, updated_at FROM regnskap 
   ORDER BY updated_at ASC LIMIT 10;"
```

### Performance metrics

```bash
# Count records created today
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) FROM regnskap 
   WHERE created_at::date = CURRENT_DATE;"

# Count records updated today
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) FROM regnskap 
   WHERE updated_at::date = CURRENT_DATE 
   AND created_at::date != CURRENT_DATE;"
```

## Systemd Commands

```bash
# Start service
sudo systemctl start bedriftsgrafen-regnskap-sync

# Stop service
sudo systemctl stop bedriftsgrafen-regnskap-sync

# Restart service
sudo systemctl restart bedriftsgrafen-regnskap-sync

# Enable on boot
sudo systemctl enable bedriftsgrafen-regnskap-sync

# Disable on boot
sudo systemctl disable bedriftsgrafen-regnskap-sync

# View status
sudo systemctl status bedriftsgrafen-regnskap-sync
```

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u bedriftsgrafen-regnskap-sync -n 100

# Check Docker container
docker ps | grep bedriftsgrafen-backend

# Test script manually
docker exec -it bedriftsgrafen-backend python3 /app/ops_scripts/continuous_regnskap_sync.py
```

### High CPU/Memory usage

- Reduce `BATCH_SIZE` in script
- Increase `RATE_LIMIT_DELAY` to slow down
- Check for database query performance issues

### Network errors

- Service auto-retries after 5 minutes
- Check internet connectivity: `ping data.brreg.no`
- Check Docker network: `docker network ls`

### Database errors

```bash
# Check connection
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c "SELECT 1;"

# Check table exists
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c "\d regnskap"

# Check for locks
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT * FROM pg_locks WHERE NOT granted;"
```

## Stopping the Service

### Graceful shutdown

```bash
# Systemd (recommended)
sudo systemctl stop bedriftsgrafen-regnskap-sync

# Manual (if running in terminal)
# Press Ctrl+C
```

Service will:
1. Complete current company processing
2. Close database connections
3. Exit cleanly

### Force kill (emergency only)

```bash
sudo systemctl kill -s SIGKILL bedriftsgrafen-regnskap-sync
```

## Logs

### Location

- **Service logs**: `${PROJECT_ROOT}/logs/regnskap_sync_service.log`
- **Script logs**: `${PROJECT_ROOT}/logs/regnskap_sync.log`
- **Systemd logs**: `journalctl -u bedriftsgrafen-regnskap-sync`

### Log rotation

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/bedriftsgrafen-regnskap

# Add:
${PROJECT_ROOT}/logs/regnskap_sync*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 user user
}
```

## Performance Tuning

### For faster processing (more load)

```python
RATE_LIMIT_DELAY = 0.1  # 10 req/sec (864,000/day)
BATCH_SIZE = 500        # Larger batches
```

### For lower load (Resource efficient)

```python
RATE_LIMIT_DELAY = 0.5  # 2 req/sec (172,800/day)
BATCH_SIZE = 50         # Smaller batches
REFETCH_THRESHOLD_DAYS = 90  # Re-fetch less often
```

## Integration with Cron

If you prefer cron over systemd service:

```bash
# Run every hour for 50 minutes (then stop)
0 * * * * timeout 3000 docker exec bedriftsgrafen-backend python3 /app/ops_scripts/continuous_regnskap_sync.py >> "${PROJECT_ROOT}/logs/regnskap_sync_cron.log" 2>&1
```

Not recommended - systemd service is better for continuous operation.
