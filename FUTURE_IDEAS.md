# Future Development Ideas

This document consolidates feature ideas and strategic plans for the future development of Bedriftsgrafen.no.

## Priority 1: High Impact / Quick Wins (1-3 days each)

---

### ~~Sidebar Map Layout~~ ✅ (Jan 21, 2026)
- **Goal**: Redesign the Map view to use a sidebar + map layout (Desktop).
- **Why**: Norway's geography is tall and narrow. A sidebar (30% width) for controls and stats, and a map (70% width) filling the vertical height, optimizes space and provides a better UX.
- **Status**: **IMPLEMENTED**. All filters moved to a modular, vertically-scrollable sidebar. MapGuide is now collapsible.

### Subunit Map View (Avdelinger) 🟡 BACKLOGGED
- **Goal**: Add a "Map" toggle to the "Avdelinger" tab in the company profile.
- **Why**: Visualize the physical footprint of companies with many branches (e.g., Rema 1000, Equinor).
- **Tech**: Geocode `underenheter` table and implement `SubunitMap` component using `react-leaflet`.
- **Issue**: 826K subunits need geocoding (~9 days at API rate limit). High effort for niche value.
- **Plan**: [SUBUNIT_MAP_VIEW.md](docs/internal/plans/BACKLOG/SUBUNIT_MAP_VIEW.md)

### Share Cards v2 (SEO + Social) 🟡 PARTIAL
- **Goal**: Rich Open Graph images for company, municipality, county, and industry pages.
- **Status**: SVG OG images implemented for companies and municipalities (`/v1/og/company/{orgnr}.svg`, `/v1/og/municipality/{code}.svg`). Missing: county and industry OG images, sparklines in cards.
- **Remaining**:
  - Mini sparklines (last 3–5 years).
  - County and industry OG images.

### ~~Smart Badges for Search Results~~ ✅ (Jan 24, 2026)
- **Goal**: Add visual badges to search results to highlight key company traits.
- **Badges**:
  - 💎 **Solid**: Equity ratio (egenkapitalandel) >= 20%.
  - 🆕 **Ny**: Established in the last 12 months.
  - 🏛️ **Etablert**: Older than 20 years.
- **Status**: **IMPLEMENTED**. Dynamic badges added to `CompanyCard` component.

### "Nearby Companies" (Geo Discovery)
- **Goal**: Suggest relevant companies near a selected company or municipality center.
- **Features**:
  - Radius-based results (e.g., 2km/5km/10km).
  - Quick filters: same industry, same size, fastest growth.
- **Why**: Improves discovery and time-on-site with minimal UI changes.

### SSB-style NACE Classification Browser
- **Goal**: Make `/bransjer` feel like a real industry-code explorer, closer to SSB Klass: filter, expand/collapse, and drill down through sections, divisions, groups and classes.
- **Why**: Current bransje UX is too modal-oriented. Users should understand the NACE hierarchy and move from broad categories to precise codes without opening a company-list modal.
- **Features**:
  - Inline hierarchy from `backend/klass-version-3218-codes.csv` with direct links to bransje dashboards and filtered company search.
  - Search across NACE code and SSB name.
  - Show company counts where Bedriftsgrafen has indexed statistics, especially for 2-digit divisions and later for deeper levels.
  - Replace “click row to open companies modal” with “open bransje page / drill down / search businesses”.
- **Data note**: The CSV currently contains levels 2-4 and uses section letters as parents; section names come from Bedriftsgrafen's NACE section mapping.

### Adtraction Revenue Notifications (Discord)
- **Goal**: Send a Discord notification when Adtraction registers a commission-bearing event for Bedriftsgrafen, including CPL/lead commissions and generated payments, while keeping business notifications separate from Grafana operational alerts.
- **API basis**: Use Adtraction API v2 with `X-Token` authentication against `https://api.adtraction.net/v2/`. Alert sources are `/partner/transactions` with `transactionStatus=3` (approved + pending) and `commission > 0`, plus `/partner/payments/{currency}/{paymentId}`. Do not call click/statistics endpoints for alerting.
- **Secret hygiene**: Keep raw values only in `observability/secrets/ADTRACTION_API_KEY` and `observability/secrets/ADTRACTION_DISCORD_WEB_HOOK`; do not keep the Adtraction token or Discord webhook in `.env` or `.env.example`. The notifier should read file paths from config and pass the API key as an `X-Token` header, never as a query parameter.
- **Current status**: CLI, dry-run, `--mark-seen`, Discord sends, masked summaries, local ignored state, per-run Discord message cap, and hourly systemd timer files are implemented in the repo.
- **Runtime behavior**: Once the timer is installed and `.env` has `ADTRACTION_NOTIFIER_ENABLED=true`, it polls hourly and only sends previously unseen commission/payment events. The same event is not repeated after state is written.
- **Remaining hardening**: Optional Prometheus metrics for last successful poll/new events/API failures, a dedicated manual `--test-discord` command, and redacted recorded fixtures if the API shape changes.

---

## Priority 2: Core Features (4-7 days each)

### Lead Generator (B2B Tool) 🎯
- **Concept**: A powerful query builder for sales and marketing professionals.
- **Filters**: "Find me [Carpenters] in [Bergen] with Revenue > [5 MNOK] and Profit > [10%]."
- **Action**: Export filtered results to CSV (potential premium feature).
- **Why**: Moves the platform from research to an active business enablement tool.

### ~~County (Fylker) Dashboards~~ ✅ (Jan 29, 2026)
- **Goal**: Dedicated landing pages for Norwegian counties (e.g., `/fylke/46`).
- **Why**: High-volume SEO terms ("Virksomheter i Vestland").
- **Tech**: `/fylke/[code]` route with premium dashboard, shared components with municipalities.
- **Status**: **IMPLEMENTED**. Full premium dashboard with drill-down navigation to municipalities, DRY components, A11y improvements.

### ~~Industry Landing Pages (NACE)~~ ✅
- **Goal**: Dedicated SEO pages for industry sectors (e.g., `/bransje/41` for Byggevirksomhet).
- **Features**:
  - Industry-specific benchmarks and growth trends.
  - "Top performers" in the sector.
- **Status**: **IMPLEMENTED**. Full `/bransje/{code}` routes with dashboard, top lists, and benchmarking.

### Shareable Insights (Permalinks + Snapshots)
- **Goal**: One-click share of filters and charts with stable URLs.
- **Features**:
  - Short share links for filtered search and map views.
  - "Snapshot" card that freezes metrics at share time.
- **Why**: Improves virality and collaboration.

### Hierarchical Org Charts 🌳
- **Goal**: Visualize the parent-child relationship between main entities and subunits.
- **Tech**: Use `react-flow` to render a tree-like structure from `underenheter` data.

### Aksjeeierbok Ownership Explorer
- **Goal**: Import Skatteetatens aksjeeierbok for 2024 and 2025 and visualize ownership on company pages, similar to a dedicated `/virksomhet/{orgnr}/eierstruktur` view.
- **Why**: This closes a major competitor gap and adds a high-value network layer: who owns the company, what the company owns, and how ownership changes year over year.
- **Downloaded source**: `downloads/aksjeeiebok_2024.csv` (~3.05M rows) and `downloads/aksjeeiebok_2025.csv` (~3.09M rows), columns include company orgnr/name, share class, shareholder name, shareholder birth year/orgnr, location/country, shares and total company shares.
- **Phase 1: Import foundation**:
  - Create `shareholder_positions` table keyed by year, company orgnr, normalized shareholder id/name, share class and source row hash.
  - Store shareholder orgnr when present; keep birth year as non-unique contextual data and avoid exposing sensitive assumptions about private persons.
  - Add indexes for `company_orgnr`, `shareholder_orgnr`, `year`, and top-owner queries.
  - Build dry-run/apply importer with row-count, duplicate, malformed-orgnr and percentage-sum reports.
- **Phase 2: API**:
  - `GET /v1/companies/{orgnr}/ownership?year=2025` for top shareholders, “other owners” aggregation and source freshness.
  - `GET /v1/companies/{orgnr}/holdings?year=2025` for companies where this orgnr appears as shareholder.
  - Optional compare mode for ownership changes from 2024 to 2025.
- **Phase 3: UI**:
  - Company-page ownership tab with graph/list toggle, top shareholders, owned companies, year selector, share-class filter and source note “Skatteetatens aksjonærregister per 31.12.<year>”.
  - Aggregate long tails as “andre eiere” to keep the page fast and readable.
  - Link organization shareholders to Bedriftsgrafen company pages when orgnr is known.
- **Important caveats**:
  - Aksjeeierboken is annual, not live ownership.
  - Nominee/custodian shareholders can obscure beneficial owners.
  - Private persons need careful display, search and removal/privacy handling.
  - Percentages should be calculated per share class and total shares, with validation for zero/missing totals.

---

## Priority 3: Advanced Analytics (1-2 weeks each)

### Gaselle Detection & Trend Badges
- **Goal**: Automatically identify high-growth companies.
- **Algorithm**: 3-year revenue growth + consistent profitability.
- **Visuals**: Add badges like 🔥 Gaselle, 📈 Vekst, ➡️ Stabil.
- **Feature**: A dedicated "Growth Leaderboard" page.

### Real-time Bankruptcy Feed
- **Goal**: A live-updating feed of new bankruptcies from Brønnøysundregistrene.
- **Features**: Notifications for "3 new bankruptcies in [County] today".
- **Tech**: Backend polling of `kunngjoringer` and WebSocket/SSE for real-time UI.

### Advanced Financial Benchmarking (`/analyse`)
- **Goal**: Provide deep, industry-wide financial insights.
- **Features**:
  - Value Creation (EBITDA) heatmaps.
  - Solvency Benchmarking (% of companies with >20% equity in a sector).
  - Operating Margin distributions.

### Anomaly & Momentum Alerts
- **Goal**: Detect unusual changes in company performance.
- **Signals**:
  - Sudden revenue drop/spike.
  - Margin compression beyond industry norms.
  - Rapid employee growth or contraction.
- **Why**: Creates proactive insights and repeat visits.

### Source Worker Data Quality Hardening
- **Goal**: Make every worker job that fetches from Brreg, SSB, Kartverket, Skatteetaten or other sources auditable, replayable and visibly healthy.
- **Why**: Freshness pages are only as trustworthy as the jobs behind them. Data quality should be treated as product surface, not only backend plumbing.
- **Hardening checklist**:
  - Contract tests with recorded/redacted fixtures for every source response shape the workers parse.
  - Dry-run mode for destructive or large backfills, with expected insert/update/delete counts before apply.
  - Cursor monotonicity checks: no job should silently move a source cursor backwards or skip a failed window.
  - Idempotency tests for replaying the same update window twice.
  - Per-job data-quality metrics: rows fetched, rows persisted, rows skipped, parse errors, source lag and latest observed source timestamp.
  - Alert if a job has zero useful rows for too long, if source lag exceeds a threshold, or if malformed rows spike.
  - Public/internal “source health” view that maps worker state to Datastatus without exposing secrets or noisy internals.
- **Near-term targets**: Brreg entity updates, subunit updates, role updates, accounting fetches, geocoding, materialized view refreshes and future aksjeeierbok imports.

---

## Priority 4: Network & AI

### Bedriftsgrafen Assistant (AI Chatbot)
- **Concept**: Conversational interface for complex data queries.
- **Queries**: "Finn virksomheter i Bergen med >10% margin og <10 ansatte".
- **Tech**: RAG (Retrieval-Augmented Generation) using an LLM to generate safe SQL queries.

### Role Network & Ownership Graph
- **Goal**: Visualize connections between people and companies.
- **Features**:
  - "Hvem sitter i styret med hvem?"
  - Trace ownership chains to find the Ultimate Beneficial Owner (UBO).
- **Tech**: Graph database (Neo4j) or recursive SQL queries + `react-force-graph`.

---

## Technical & UX Improvements

- **Export to Excel/PDF**: Move beyond CSV to professional PDF reports for due diligence.
- **Alerts/Notifications**: "Varsle meg når [Selskap] leverer nytt regnskap".
- **Rate Limiting & API for Third Parties**: Commercialize the data via a public API.
- ~~**Search Speed Boost**~~: ✅ Trigram GIN index on bedrifter.navn — 50x faster short queries (466ms→9ms). Implemented 2026-03-30.
- ~~**Precomputed Trend Caches**~~: ✅ 8 materialized views (company_totals, industry_stats, county_stats, municipality_stats, etc.) already in production.
- **Share Link Tracking**: Attribute shares to pages and measure viral loops.

---

## Completed & Recently Launched ✅

- **[x] Industry Statistics Dashboard**: Aggregated stats per NACE code with sortable metrics.
- **[x] Geographic Visualization**: Choropleth maps for counties and municipalities.
- **[x] Bankruptcy Heatmap**: Visual density of bankruptcies across Norway.
- **[x] Enhanced Landing Page**: Modern homepage with company and person search.
- **[x] New Companies Feed**: Real-time list of latest established AS companies.
- **[x] Person Search (Commercial Only)**: Search for roles held by individuals across the professional network.
- **[x] SSB Population Integration**: Contextual "per 1,000 inhabitants" metrics on maps.
- **[x] "Look in Map" Button**: Seamless transition from list view to geographic visualization.
- **[x] Full CSV Export**: Streamed export of filtered company datasets.
- **[x] Subunit List View**: Display all avdelinger/underenheter for a company.
- **[x] Advanced Purpose Search**: Full-text search within company purpose descriptions.
- **[x] Immediacy Filters**: Quick-toggle 30d/90d shortcuts for latest company activity.
- **[x] Industry Top Lists (Topplister)**: Ranked view of top 100 performers within a sector.
- **[x] Professional Network Links**: Standardized LinkedIn, 1881, and internal role navigation.
- **[x] Sidebar Map Layout**: Consolidated all map filters into a modular, vertical sidebar. MapGuide is now collapsible for mobile.
- **[x] Mobile Map Optimization**: Fixed sidebar scrolling and improved map/filter distribution on small screens.
- **[x] Battle Mode (Gamified Comparison)**: Head-to-head comparison with winners per metric.
- **[x] Local Heroes (Municipality Dashboards)**: Dedicated `/kommune/[id]` pages with local statistics and SEO content.
- **[x] County (Fylker) Dashboards**: Dedicated `/fylke/[code]` pages with premium dashboards and drill-down navigation.
- **[x] Smart Badges for Search Results**: Dynamic badges (💎 Solid, 🆕 Ny, 🏛️ Etablert) on company cards.
- **[x] Search Speed Boost**: Trigram GIN index for 50x faster short-query name search.
- **[x] Precomputed Trend Caches**: 8 materialized views for fast aggregated stats.
- **[x] Industry Landing Pages (NACE)**: Dedicated `/bransje/{code}` pages with dashboard, top lists, and benchmarking.
- **[x] OG Images**: SVG Open Graph images for companies and municipalities.
