# Bedriftsgrafen API Endpoints

Base URL: `http://localhost:8000` (dev) | `https://bedriftsgrafen.no/api` (prod)

Auto-generated docs: `GET /docs` (Swagger UI) | `GET /redoc` (ReDoc)

---

## Company Endpoints (`/v1/companies`)

### GET /v1/companies
List companies with filtering, sorting, and pagination.

**Key query params** (32+ total — see `/docs` for full list):
- `name` — Search by name or org number
- `organisasjonsform` — Filter by org form codes (repeatable)
- `naeringskode` — NACE industry code
- `municipality_code` — 4-digit municipality code
- `county` — 2-digit county code
- `min_revenue`, `max_revenue` — Revenue range filter
- `min_employees`, `max_employees` — Employee count range
- `has_accounting` — Only companies with financial data
- `is_bankrupt` — Bankruptcy status filter
- `sort_by` — `navn`, `antall_ansatte`, `stiftelsesdato`, `revenue`, `profit`, `operating_profit`
- `sort_order` — `asc` or `desc`
- `skip`, `limit` — Pagination (default: 0, 100)

### GET /v1/companies/count
Count companies matching filters. Same query params as above.

### GET /v1/companies/stats
Aggregate statistics for filtered companies.

### GET /v1/companies/export
CSV export of filtered companies. Same query params as list endpoint. Streamed response.

### GET /v1/companies/search
Full-text search by company name.
- `name` (required) — Search query
- `limit` (default: 20)

### GET /v1/companies/search/subunits
Fuzzy search across subunits (underenheter).

### GET /v1/companies/nace/{prefix}/subclasses
Get NACE subclasses for a given prefix.

### GET /v1/companies/nace/hierarchy
Full NACE code hierarchy tree.

### GET /v1/companies/industry/{nace_code}
Companies in a specific industry.

### GET /v1/companies/markers
Map markers for geographic visualization. Returns simplified company data with coordinates.

### GET /v1/companies/{orgnr}
Company details with all accounting records.
- Path: `orgnr` — 9-digit organization number

### GET /v1/companies/{orgnr}/similar
Find companies similar to the given company.

### GET /v1/companies/{orgnr}/accounting/{year}
Accounting data for a specific year with calculated KPIs:
- `likviditetsgrad1` — Liquidity Ratio (Current Ratio)
- `ebitda` — EBITDA
- `ebitda_margin` — EBITDA Margin
- `egenkapitalandel` — Equity Ratio
- `resultatgrad` — Profit Margin
- `totalkapitalrentabilitet` — Return on Assets (ROA)

### GET /v1/companies/{orgnr}/accounting/record/{accounting_id}
Accounting record by database ID.

### POST /v1/companies/{orgnr}/fetch
Fetch company and financial data from Brønnøysundregistrene.
- Body: `{"fetch_financials": true}` (optional, defaults to true)

### GET /v1/companies/{orgnr}/subunits
List all subunits (underenheter/avdelinger) for a company.

### GET /v1/companies/{orgnr}/roles
List all registered roles (board members, CEO, etc.) for a company.

---

## Person & Role Network (`/v1/people`)

### GET /v1/people/search
Search for people by name. Returns name + birth year (GDPR compliant).

### GET /v1/people/search/results
Paginated person search results.

### GET /v1/people/roles
List all commercial roles for a person, enriched with company context and latest financials.
- `name` (required), `birthdate` (required)

### GET /v1/people/connections
Find people who share companies with the given person.
- `name`, `birthdate` (required), `limit` (default: 20, max: 100)
- Returns connections sorted by number of shared companies. Birth year only for GDPR compliance.

### GET /v1/people/sparklines
Mini financial time-series per company for inline sparkline charts.
- `name`, `birthdate` (required), `years` (default: 5)

### POST /v1/people/network-path
Find shortest path between two people via shared board memberships (BFS, max depth 3).
- Body: `{ person_a_name, person_a_birthdate, person_b_name, person_b_birthdate, max_depth? }`

### GET /v1/people/toplists
All person toplist categories (active roles, styreleder, CEO, styremedlem, industry diversity, revenue) in one response.
- `limit` (default: 10, max: 50) — entries per category

### GET /v1/people/stats
Aggregate person statistics: total persons, total active roles, role type distribution, generation breakdown, average board age.

---

## Statistics (`/v1/stats`)

### GET /v1/stats/industries
List industry statistics across all NACE divisions.

### GET /v1/stats/industries/{nace_division}
Statistics for a specific industry division.

### GET /v1/stats/industries/{nace_division}/dashboard
Full dashboard data for an industry.

### GET /v1/stats/industries/{nace_code}/benchmark/{orgnr}
Benchmark a company against its industry peers with percentile rankings.
- `nace_code`: 2-digit division or 5-digit subclass. Falls back to 2-digit if insufficient data.

### GET /v1/stats/geography
Geographic company distribution statistics.

### GET /v1/stats/geography/averages
Geographic averages (per-capita metrics).

### GET /v1/stats/timeline
Timeline/trend statistics.

---

## Geographic (`/v1/municipality`, `/v1/county`)

### GET /v1/municipality/
List all municipalities with summary statistics.

### GET /v1/municipality/{code}
Municipality dashboard with local company statistics.

### GET /v1/county/
List all counties with summary statistics.

### GET /v1/county/{code}
County dashboard with regional statistics and drill-down to municipalities.

---

## Trends (`/v1/trends`)

### GET /v1/trends/timeline
Monthly trend data (new establishments, bankruptcies).

---

## OG Images (`/v1/og`)

### GET /v1/og/company/{orgnr}.svg
Open Graph image for a company (SVG).

### GET /v1/og/municipality/{code}.svg
Open Graph image for a municipality (SVG).

---

## Admin (`/admin/import`) — Requires `X-Admin-Key` header

### POST /admin/import/updates
Fetch incremental updates from Brønnøysund.
- Query: `since_date` (ISO format), `limit`

### POST /admin/import/queue/populate
Populate the import queue for bulk processing.

### POST /admin/import/bulk/start
Start bulk import processing.

### GET /admin/import/progress
Get current import progress statistics.

### POST /admin/import/retry-failed
Retry failed import items.

### POST /admin/import/ssb/population
Sync SSB population data for per-capita metrics.

### POST /admin/import/geocode
Run geocoding batch (up to 100, rate limited 1 req/sec).

### GET /admin/import/geocode/status
Get geocoding progress statistics.

### POST /admin/import/geocode/fast-fill
Trigger background coordinate backfill.

---

## Infrastructure

### GET /health
Health check — returns service status including DB and Redis connectivity.

### GET /sitemap_index.xml
XML sitemap index for SEO (also available at `/sitemap-index.xml` and `/sitemap.xml`).

### GET /sitemaps/{filename}.xml
Paginated sitemap files.

---

## Example Usage

```bash
# Search companies
curl "http://localhost:8000/v1/companies/search?name=Equinor"

# Get company with accounting
curl "http://localhost:8000/v1/companies/123456789"

# Get accounting with KPIs
curl "http://localhost:8000/v1/companies/123456789/accounting/2023"

# Fetch from Brønnøysund
curl -X POST "http://localhost:8000/v1/companies/123456789/fetch" \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'

# Admin: trigger update sync (requires API key)
curl -X POST "http://localhost:8000/admin/import/updates?limit=1000" \
  -H "X-Admin-Key: your-admin-api-key"
```
