# Bedriftsgrafen API Endpoints

## Company Endpoints

### GET /v1/companies
List companies with pagination
- Query params: `skip` (default: 0), `limit` (default: 100)
- Returns: List of companies

### GET /v1/companies/search
Search companies by name
- Query params: `name` (required), `limit` (default: 20)
- Returns: List of matching companies

### GET /v1/companies/{orgnr}
Get company details with accounting data
- Path param: `orgnr` (9-digit organization number)
- Returns: Company with list of accounting records

### GET /v1/companies/{orgnr}/accounting/{year}
Get accounting data for a specific year with calculated KPIs
- Path params: `orgnr`, `year`
- Returns: Accounting data with KPIs including:
  - `likviditetsgrad1`: Liquidity Ratio 1 (Current Ratio)
  - `ebitda`: EBITDA
  - `ebitda_margin`: EBITDA Margin
  - `egenkapitalandel`: Equity Ratio
  - `resultatgrad`: Profit Margin
  - `totalkapitalrentabilitet`: Return on Assets

### POST /v1/companies/{orgnr}/fetch
Fetch company and financial data from Brønnøysundregistrene
- Path param: `orgnr`
- Request body: `{"fetch_financials": true}` (optional, defaults to true)
- Returns: Fetch status with counts and errors

### Stats & Trends
- `GET /v1/stats/companies`: Overall company statistics
- `GET /v1/trends/bankruptcies`: Bankruptcy trends and feed
- `GET /v1/trends/new-establishments`: New companies feed

### Person & Role Network
- `GET /v1/people/search?q=...`: Search for people by name (name + birthdate unique keys)
- `GET /v1/people/roles?name=...&birthdate=...`: List all legally compliant commercial roles for a person.

## Stats Endpoints

### GET /stats
Get database statistics
- Returns: Total companies and accounting reports count

### GET /v1/stats/industries/{nace_code}/benchmark/{orgnr}
Get benchmark comparison for a company against its industry.
- Path params:
  - `nace_code`: 2-digit division (e.g., '62') or 5-digit subclass (e.g., '62.010')
  - `orgnr`: 9-digit organization number
- Returns: Benchmark data with percentile rankings for Revenue, Profit, Employees, and Operating Margin.
- Notes: Automatically falls back to 2-digit division stats if 5-digit data is insufficient.

## Health Check

### GET /health
Health check endpoint
- Returns: Service status

## Example Usage

### Fetch company data from Brønnøysund:
```bash
curl -X POST "http://localhost:8000/companies/123456789/fetch" \
  -H "Content-Type: application/json" \
  -d '{"fetch_financials": true}'
```

### Get company with accounting:
```bash
curl "http://localhost:8000/companies/123456789"
```

### Get accounting with KPIs:
```bash
curl "http://localhost:8000/companies/123456789/accounting/2023"
```

### Search companies:
```bash
curl "http://localhost:8000/companies/search?name=Equinor"
```
