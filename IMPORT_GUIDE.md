# Import Guide

How to import company data and financial statements (regnskap) into Bedriftsgrafen.no.

> **Note**: This guide uses `${PROJECT_ROOT}` to represent the project's root directory. You can either:
> - Set it as an environment variable: `export PROJECT_ROOT=/path/to/bedriftsgrafen.no`
> - Replace it with your actual path when running commands
> - Run commands from the project root directory using `./` instead (e.g., `./scripts/script.sh`)

---

## Overview

**Two Types of Data**:
1. **Companies** (bedrifter) - Basic company information from Enhetsregisteret
2. **Financial Statements** (regnskap) - Accounting data from Regnskapsregisteret

**Current Status**:
- ✅ 1,144,906 companies imported (bulk import completed)
- ✅ Daily incremental updates enabled (cron at 2 AM)
- ⚪ Regnskap: Ready for bulk import (staged approach recommended)

---

## Company Data

### Automatic Daily Updates ✅

Enabled via cron job at 2 AM:

```bash
curl -X POST http://localhost:8000/admin/import/updates \
  -H "Content-Type: application/json" -d '{"limit": 1000}'
```

**How it works**:
- Fetches updates from Brønnøysund since yesterday
- Uses `dato` parameter (critical!) for recent data
- Processes new companies and changes
- Typical: 300-600 updates/day
- Mondays/holidays: 2000-5000 updates

**Verify updates are working**:

```bash
# Check log
tail ${PROJECT_ROOT}/logs/updates.log

# Count companies updated today
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) FROM bedrifter WHERE updated_at::date = CURRENT_DATE;"
```

### Manual Company Import

**Single Company**:

```bash
curl -X POST "http://localhost:8000/companies/923609016/fetch" \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'
```

**Custom Date Range**:

```bash
# Sync changes from specific date
curl -X POST http://localhost:8000/admin/import/updates \
  -H "Content-Type: application/json" \
  -d '{"since_date": "2025-11-01", "limit": 5000}'
```

### Bulk Company Import (Already Done)

The initial 1.14M companies were imported using:

```bash
# 1. Populate import queue
curl -X POST http://localhost:8000/admin/import/queue/populate \
  -H "Content-Type: application/json" \
  -d '{"limit": 1200000, "priority": 1}'

# 2. Process queue (background script)
${PROJECT_ROOT}/scripts/process_import_queue.sh
```

**Note**: Not needed again unless recreating from scratch.

---

## Financial Statements (Regnskap)

### Schema Ready ✅

**Database constraints**:
- ✅ UNIQUE (orgnr, aar) - prevents duplicate year records
- ✅ Atomic upsert - safe concurrent imports
- ✅ Timestamp tracking - created_at, updated_at
- ✅ Generated KPIs - 4 auto-calculated metrics

**Test with single company**:

```bash
curl -X POST "http://localhost:8000/companies/923609016/fetch" \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'
```

### Expected Coverage

**Brønnøysund Statistics**:
- ~26-44% of companies have submitted financial statements
- Each company typically has 1-3 years available
- Latest year is usually 2023 or 2024
- Older companies may have data from 2018-2020

**Projections for 1.14M companies**:
- Expected statements: 300,000 - 500,000
- Database growth: +3-5 GB
- Import duration: 35-40 hours at 10 req/sec
- Success rate: >95% API calls (but only ~35% with data)

### Staged Import Approach (Recommended)

**DO NOT** import all 1M companies at once. Use staged approach:

#### Stage 1: Test with 10 Companies

```bash
# Test import script
${PROJECT_ROOT}/scripts/test_regnskap_import.sh

# Or manually select 10 companies
docker exec bedriftsgrafen-db psql -U admin -d selskaper << 'SQL'
SELECT orgnr FROM bedrifter ORDER BY RANDOM() LIMIT 10;
SQL

# Then fetch each
curl -X POST "http://localhost:8000/companies/{orgnr}/fetch" \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'
```

**Verify**:
- Check for duplicates: `SELECT orgnr, aar, COUNT(*) FROM regnskap GROUP BY orgnr, aar HAVING COUNT(*) > 1;`
- Verify KPIs calculated
- Check timestamps present

**Expected**: 3-7 companies with data (30-70%)

#### Stage 2: Import 100 Companies

```bash
# Get 100 random companies
COMPANIES=$(docker exec bedriftsgrafen-db psql -U admin -d selskaper -t -c \
  "SELECT orgnr FROM bedrifter ORDER BY RANDOM() LIMIT 100;")

# Import each (with rate limiting)
for orgnr in $COMPANIES; do
  orgnr=$(echo $orgnr | tr -d ' ')
  curl -s -X POST "http://localhost:8000/companies/$orgnr/fetch" \
    -H "Content-Type: application/json" \
    -d '{"fetch_financials": true}'
  sleep 0.1  # Rate limiting
done
```

**Monitor**:
- Database growth (~5-10 MB expected)
- Processing time (~10-20 seconds total)
- Error rate (should be <5%)

**Expected**: 26-44 companies with data, 50-150 accounting records

#### Stage 3: Import 10,000 Companies

**Duration**: ~15-20 minutes at 10 req/sec

```bash
# Populate queue with 10,000
curl -X POST http://localhost:8000/admin/import/queue/populate \
  -H "Content-Type: application/json" \
  -d '{"limit": 10000, "priority": 1, "skip_existing": true}'

# Monitor progress
while true; do
  curl -s http://localhost:8000/admin/import/progress | jq
  sleep 30
done
```

**Expected**:
- 2,600-4,400 accounting records
- Database growth: 50-100 MB
- Processing: 15-20 minutes
- Success rate: >95%

**Verify**:
```bash
# Check count
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) FROM regnskap;"

# Check duplicates
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) FROM (
     SELECT orgnr, aar FROM regnskap 
     GROUP BY orgnr, aar HAVING COUNT(*) > 1
   ) sub;"

# Database size
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT pg_size_pretty(pg_database_size('selskaper'));"
```

#### Stage 4: Full Import (1.14M Companies)

**Only proceed if**:
- [ ] All previous stages successful
- [ ] Zero duplicates found
- [ ] Error rate < 1%
- [ ] Database performance acceptable
- [ ] Disk space projection OK (need ~5 GB free)

**Full import command**:

```bash
# Populate full queue
curl -X POST http://localhost:8000/admin/import/queue/populate \
  -H "Content-Type: application/json" \
  -d '{"limit": 1200000, "priority": 1, "fetch_financials": true}'

# Process queue (background script)
nohup ${PROJECT_ROOT}/scripts/process_import_queue.sh \
  >> ${PROJECT_ROOT}/logs/bulk_import.log 2>&1 &

# Monitor progress
tail -f ${PROJECT_ROOT}/logs/bulk_import.log

# Or check via API
watch -n 60 'curl -s http://localhost:8000/admin/import/progress | jq'
```

**Expected**:
- Duration: 35-40 hours
- Records: 300,000-500,000
- Database size: 5.65-7.65 GB total
- Success rate: >95%

**Monitoring during import**:

```bash
# Every 4 hours, check:
docker exec bedriftsgrafen-db psql -U admin -d selskaper << 'SQL'
SELECT 
  COUNT(*) as total_companies,
  (SELECT COUNT(*) FROM regnskap) as total_statements,
  pg_size_pretty(pg_database_size('selskaper')) as db_size;
SQL

# Check queue status
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT status, COUNT(*) FROM bulk_import_queue GROUP BY status;"

# Disk space
df -h /
```

---

## API Endpoints for Import

### Company Import

```bash
# Single company with financials
POST /companies/{orgnr}/fetch
{
  "fetch_financials": true
}

# Incremental updates (used by cron)
POST /admin/import/updates
{
  "limit": 1000,
  "since_date": "2025-11-26"  # Optional
}
```

### Bulk Import (Admin)

```bash
# Populate import queue
POST /admin/import/queue/populate
{
  "limit": 10000,
  "priority": 1,
  "fetch_financials": true,
  "skip_existing": true
}

# Start bulk import
POST /admin/import/bulk/start
{
  "batch_size": 100,
  "workers": 3
}

# Check progress
GET /admin/import/progress

# Retry failed imports
POST /admin/import/retry-failed
```

---

## Data Quality Checks

### After Import

```bash
# 1. Check for duplicates (should be 0)
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) as duplicates FROM (
     SELECT orgnr, aar FROM regnskap 
     GROUP BY orgnr, aar HAVING COUNT(*) > 1
   ) sub;"

# 2. Verify timestamps (should be 100%)
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT 
     COUNT(*) as total,
     COUNT(*) FILTER (WHERE created_at IS NOT NULL) as with_created,
     COUNT(*) FILTER (WHERE updated_at IS NOT NULL) as with_updated
   FROM regnskap;"

# 3. Check KPI coverage
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT 
     COUNT(*) as total,
     COUNT(*) FILTER (WHERE likviditetsgrad1 IS NOT NULL) as with_likviditet,
     COUNT(*) FILTER (WHERE ebitda IS NOT NULL) as with_ebitda
   FROM regnskap;"

# 4. Year distribution
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT aar, COUNT(*) FROM regnskap GROUP BY aar ORDER BY aar DESC;"
```

### Data Integrity

```bash
# Foreign key violations (should be 0)
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) FROM regnskap r 
   LEFT JOIN bedrifter b ON r.orgnr = b.orgnr 
   WHERE b.orgnr IS NULL;"

# Orphaned records
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT COUNT(*) FROM regnskap WHERE orgnr NOT IN (SELECT orgnr FROM bedrifter);"
```

---

## Performance Optimization

### Rate Limiting

Brønnøysund API limits: **10 requests/second**

Our implementation:
- Sleep 0.1s between requests (10/sec)
- Retry with exponential backoff on failures
- Batch commits (per company, not per batch)

### Parallel Processing (Future)

Currently single-threaded. To enable parallel workers:

```python
# Example with 3 workers (max 30 req/sec total)
POST /admin/import/bulk/start
{
  "workers": 3,
  "rate_limit_per_worker": 10
}
```

### Database Performance

```bash
# Create indexes if missing
docker exec bedriftsgrafen-db psql -U admin -d selskaper << 'SQL'
CREATE INDEX IF NOT EXISTS idx_regnskap_orgnr_aar ON regnskap(orgnr, aar);
CREATE INDEX IF NOT EXISTS idx_regnskap_created_at ON regnskap(created_at);
CREATE INDEX IF NOT EXISTS idx_bedrifter_updated_at ON bedrifter(updated_at);
SQL

# VACUUM during import (every 100K records)
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c "VACUUM ANALYZE regnskap;"
```

---

## Troubleshooting Import Issues

### No Data Returned

Many companies don't have financial statements. This is normal.

```bash
# Check API directly
curl "https://data.brreg.no/regnskapsregisteret/regnskap/923609016"

# If returns [], company has no submitted statements
```

### Duplicate Records Error

Should never happen with UNIQUE constraint, but if it does:

```bash
# Find duplicates
docker exec bedriftsgrafen-db psql -U admin -d selskaper << 'SQL'
SELECT orgnr, aar, COUNT(*) as cnt
FROM regnskap
GROUP BY orgnr, aar
HAVING COUNT(*) > 1;
SQL

# Fix (keep latest)
docker exec bedriftsgrafen-db psql -U admin -d selskaper << 'SQL'
DELETE FROM regnskap
WHERE id NOT IN (
  SELECT MAX(id)
  FROM regnskap
  GROUP BY orgnr, aar
);
SQL
```

### Import Stalled

```bash
# Check queue status
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c \
  "SELECT status, COUNT(*), 
   MIN(updated_at) as oldest, 
   MAX(updated_at) as newest 
   FROM bulk_import_queue 
   GROUP BY status;"

# Reset stuck items
docker exec bedriftsgrafen-db psql -U admin -d selskaper << 'SQL'
UPDATE bulk_import_queue 
SET status = 'pending', retry_count = 0
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '1 hour';
SQL

# Restart process
${PROJECT_ROOT}/scripts/process_import_queue.sh
```

### Database Errors

```bash
# Check shared memory (must be 512MB)
docker exec bedriftsgrafen-db df -h /dev/shm

# If less than 512M, recreate container:
docker compose down db
# Edit docker-compose.yml to add: shm_size: '512mb'
docker compose up -d db
```

---

## Important Notes

### Regnskap Data Structure

**One Year Per Company** (from API):
- API returns the latest submitted year
- Older years may be available from previous API calls
- Historical data builds up over time as new years are submitted

**Multiple Years Strategy**:
1. Initial import gets latest year (e.g., 2024)
2. Next year, import gets 2025 (creates new record)
3. UNIQUE constraint ensures no duplicates
4. Over time, build complete history

### KPI Calculation

6 metrics auto-calculated by database:

```sql
likviditetsgrad1 = omloepsmidler / kortsiktig_gjeld
ebitda = driftsresultat + avskrivninger
ebitda_margin = ebitda / salgsinntekter
egenkapitalandel = egenkapital / total_capital
resultatgrad = aarsresultat / salgsinntekter (calculated in service)
totalkapitalrentabilitet = aarsresultat / total_assets (calculated in service)
```

**Null Handling**: If denominator is 0 or NULL, KPI is NULL (not an error).

### Storage Estimates

```
1 company:           ~2.3 KB
1 regnskap record:   ~2.0 KB (with JSONB)
1M companies:        ~2.3 GB
500K regnskap:       ~1 GB
Total projection:    ~3.3 GB (compressed), ~5-7 GB (with indexes)
```

---

## Testing Utilities

### Test Scripts

```bash
# Test small batch
${PROJECT_ROOT}/scripts/test_regnskap_import.sh

# Process import queue
${PROJECT_ROOT}/scripts/process_import_queue.sh
```

### Manual Testing

```bash
# Test with known large company (should have data)
curl -X POST "http://localhost:8000/companies/923609016/fetch" \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'

# Check result
curl "http://localhost:8000/companies/923609016" | jq '.regnskap'

# Test with small company (likely no data)
curl -X POST "http://localhost:8000/companies/913189892/fetch" \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'
```

---

**Last Updated**: 2026-01-13  
**Version**: 1.0  
**Status**: Ready for Bulk Import
