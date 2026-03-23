# Import Guide

Data import workflows for company and financial statement data from Brønnøysundregistrene.

## Data Sources

| Type | Source | Table |
|------|--------|-------|
| Companies (bedrifter) | Enhetsregisteret | `bedrifter` |
| Financial Statements (regnskap) | Regnskapsregisteret | `regnskap` |

**Current Status:** 1.14M companies imported. Daily incremental updates enabled.

---

## Daily Updates (Automatic)

Cron job at 2 AM syncs recent changes:

```bash
curl -X POST http://localhost:8000/admin/import/updates \
  -H "Content-Type: application/json" -d '{"limit": 1000}'
```

- Typical: 300-600 updates/day, 2000-5000 on Mondays/holidays
- Verify: `tail logs/updates.log`

## Single Company Import

```bash
curl -X POST "http://localhost:8000/companies/{orgnr}/fetch" \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'
```

## Bulk Import

Only needed if recreating from scratch:

```bash
# Populate queue
curl -X POST http://localhost:8000/admin/import/queue/populate \
  -H "Content-Type: application/json" \
  -d '{"limit": 1200000, "priority": 1, "fetch_financials": true}'

# Process (background)
nohup ./scripts/process_import_queue.sh >> logs/bulk_import.log 2>&1 &
```

At 10 req/sec, full import takes ~35-40 hours. ~35% of companies have financial data.

## Data Quality Checks

```bash
docker exec bedriftsgrafen-db psql -U admin -d selskaper -c "
  SELECT
    (SELECT COUNT(*) FROM bedrifter) as companies,
    (SELECT COUNT(*) FROM regnskap) as statements,
    (SELECT COUNT(*) FROM regnskap WHERE likviditetsgrad1 IS NOT NULL) as with_kpis;"
```

## API Reference

See [backend/API_ENDPOINTS.md](backend/API_ENDPOINTS.md) for all import-related endpoints.
