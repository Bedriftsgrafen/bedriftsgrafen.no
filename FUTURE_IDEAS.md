# Future Development Ideas

This document consolidates feature ideas and strategic plans for future development of Bedriftsgrafen.no.

## Priority 1: Quick Wins (1-2 days each)

### Purpose Search (Formål)
- [/] Add `vedtektsfestet_formaal` to search index
- Users can search "frisør", "konsulent", "eiendom" etc.
- **Status**: Backend column exists, logic in `lookups.py` exists, but the TSVECTOR database trigger needs an update to include this column.

### Industry Statistics Dashboard
- New endpoint: `/v1/stats/industries`
- Materialized view with pre-aggregated data per NACE code
- Show: Company count, total revenue, total employees, avg profit margin
- Frontend: Simple table/cards on a new "Bransjer" page

### Bankruptcy Heatmap by County
- Query existing data: `konkurs=true` grouped by `forretningsadresse->kommunenummer`
- Map visualization using Leaflet (already integrated)
- Color intensity = bankruptcy density

### Immediacy Filters (Shortcut Support)
- Add `period=30d` and `period=90d` filters to `/nyetableringer` and `/konkurser` routes.
- This supports the "Market Pulse" home page stats.

---

## Priority 2: Core Features (3-5 days each)

### Enhanced Landing Page
- Move current search/filter to dedicated `/utforsk` route
- New homepage with:
  - Hero section with central search field
  - Feature grid linking to Konkurser, Nyetableringer, Bransjer, Kart
  - Live statistics: "X antall bedrifter analysert"

### New Companies Feed ("Ferske Bedrifter")
- Query: Companies with `stiftelsesdato` in last 30/90/365 days
- Filter by: Organisasjonsform (AS, ENK), Fylke, NACE
- Feed/list view with trending industries

### Geographic Visualization (Kartbasert Bransjekart)
**Features:**
1. **Choropleth Map**: Color municipalities by:
   - Number of companies in selected NACE
   - Bankruptcy rate
   - New company rate
2. **Cluster Map**: Show individual company dots with clustering
3. **Toggle**: Switch between "All", "Bankruptcies", "New Companies"

**Technical:**
- Use existing geocoded data (latitude/longitude)
- Add municipality boundaries GeoJSON (from Kartverket)
- React component with Leaflet + react-leaflet

### "Battle Mode" (Company Comparison) ⚔️
- **Concept**: Gamified side-by-side comparison of two companies.
- **Visuals**: "Fighting game" style character select screen.
- **Metrics**: Compare "Revenue Growth", "Profit Margin", "Solvency", and "Efficiency".
- **Outcome**: Declare a "Winner" in each category and an "Overall Champion".
- **Why**: Highly shareable content making financial analysis fun and accessible.
- **Tech**: Frontend-heavy implementation reusing existing data + simple scoring logic.

### "Local Heroes" (Municipality Dashboard) 🏘️
- **Concept**: Dedicated dashboard for every municipality (e.g., `/kommune/bergen`).
- **Features**:
  - "Top 10 Most Profitable" in the area.
  - "Newest Establishments" (last 30 days).
  - "Largest Employers" (estimated via wage costs).
- **Why**: High local engagement and excellent for SEO (landing page per municipality).
- **Tech**: New route `/kommune/[id]`, filtered queries by `kommunenummer`.

### Map & Explorer UX Improvements 🗺️

#### "Look in Map" Button (Explorer → Map Navigation)
- **Concept**: Add a prominent button in the Explorer tab (next to the company list header or filter summary) that switches to the Map tab with the current filters pre-applied.
- **Why**: Currently, switching from Explorer to Map loses filter context. This provides a clear, intentional way to visualize the current search results geographically.
- **Technical**:
  - Add button in `ExplorerLayout.tsx` or `ActiveFilterChips.tsx`.
  - On click: Store current filters to `sessionStorage` and programmatically switch to the map tab.
  - Map reads filters on mount and syncs its state accordingly.
- **Effort**: Low (1-2 hours)

#### Always-Visible Population Context
- **Concept**: Display population data alongside company counts throughout the Bransje view to provide market context.
- **Features**:
  - Show population in map info panels when hovering/selecting regions.
  - Display "X companies per 1,000 inhabitants" metric.
  - Include population in the stats overview tab for the selected region.
- **Why**: Raw company counts lack context; "100 companies" means something very different in Oslo (700k pop) vs. a small municipality (2k pop). Population context enables meaningful comparisons.
- **Technical**:
  - The map already fetches population data via `perCapita` calculations.
  - Expose population in the `MapLegend` or `selectedRegion` display.
  - Consider adding a "per capita" toggle to the stats view.
- **Effort**: Low-Medium (2-4 hours)

#### Sidebar Map Layout (Better for Norway's Geography)
- **Concept**: Redesign the map view to use a sidebar + map layout instead of full-width. Place the map on the right (~60-70% width) and controls/legend/stats on the left.
- **Why**: Norway's map is tall and narrow. A full-width layout wastes horizontal space and makes the map appear zoomed out. A taller, narrower container lets the map fill more vertical space, appearing more zoomed in and focused.
- **Features**:
  - Left sidebar (30-40%): NACE filter, metric selector, legend, selected region stats.
  - Right panel (60-70%): The map itself, filling available height.
  - Responsive: On mobile, stack vertically (controls above map).
- **Technical**:
  - Refactor `IndustryMap.tsx` to accept a layout prop or use CSS Grid/Flexbox in the parent.
  - Move legend and controls outside the map component into the sidebar.
  - Apply consistent styling to both `/bransjer` and `/kart` routes.
- **Effort**: Medium (4-8 hours)

---

## Priority 3: Subunit Enhancements (Underavdelinger)

### Subunit Map View
- **Concept**: Add a "Map" toggle to the "Avdelinger" tab in the company modal. This would switch from the current grid view to an interactive map displaying pins for each subunit's location.
- **Effort**: Medium
- **Technical**:
  - Requires adding geocoding fields (`latitude`, `longitude`) to the `underenheter` table in the database.
  - A new batch script will be needed to geocode existing subunits.
  - A new `SubunitMap` component will be created in the frontend using `react-leaflet`.

### Hierarchical View / Organizational Chart
- **Concept**: Display a simple, read-only organizational chart that shows the parent company at the top and its subunits branching out below it. This provides a clear, immediate understanding of the company's structure.
- **Effort**: Medium-High
- **Technical**:
  - Integrate a library for rendering tree-like structures (e.g., `react-flow`).
  - Create a new `OrganizationChartView` component that formats the parent-child data for the charting library.
  - Could be a new sub-tab within the "Avdelinger" tab: "List" | "Map" | "Chart".

### Subunit-Specific Analytics & Comparison
- **Concept**: Allow users to click on a subunit to see more details, or even compare subunits against each other based on available data like employee count and founding date.
- **Effort**: High
- **Technical**:
  - Add a "Select for Comparison" feature to the subunit cards.
  - Create a comparison modal showing a side-by-side table of the selected subunits.
  - Could be extended to show historical trends if we start snapshotting data like employee counts over time.

---

## Priority 4: Advanced Analytics (1-2 weeks each)

### SSB Integration (Befolkning & Marked)
**Data Sources:**
- SSB PxWebApi (free, open)
- Table 07459: Population by municipality
- Table 07984: Business statistics

**Use Cases:**
1. **Market Saturation**: "1 dagligvarebutikk per 400 innbyggere (snitt: 800)"
2. **Growth Potential**: "Befolkningsvekst 5% siste år + få bedrifter = mulighet?"
3. **Employment Density**: "Ansatte i bransje X / Befolkning"

**Technical:**
- New service: `SsbApiService`
- Cache SSB data locally (doesn't change often)
- Join on `kommunenummer`

### Gaselle Detection (Trendanalyse)
**Algorithm:**
```python
def calculate_trend_score(company):
    growth_3y = (revenue_2024 - revenue_2021) / revenue_2021
    margin_trend = avg(margin_2024, margin_2023) - avg(margin_2022, margin_2021)
    consistency = all([r > 0 for r in [revenue_2022, revenue_2023, revenue_2024]])
    
    score = (growth_3y * 0.4) + (margin_trend * 0.3) + (consistency * 0.3)
    return score
```

**Features:**
- Badge system: 火 Gaselle, 📈 Vekst, ➡️ Stabil, 📉 Fallende
- New page: "Top Vekstbedrifter" (filterable by region/industry)
- Materialized view refreshed weekly

### Person Search & Role Analytics Hub (`/search/people`)
- **Vision**: Transform the search from a simple lookup to a deep exploration of the Norwegian professional network (6.4m+ roles).
- **Features**:
    - **Global Search**: Search by name across all roles, historical and active.
    - **Board Dynamics**: Filters for role type (Board, MD, Auditor), Board experience (e.g., "Mennesker med >5 styreverv"), and Age demographics.
    - **Network Visualization**: See "Who worked with whom" to identify clusters of influence.
    - **Gender & Diversity Tracking**: Industry-wide statistics on board composition.
- **Immediate Next Step**: Enable a dedicated `/personer` route that auto-focuses the person search on the home page as a bridge.

### Advanced Financial Analytics & Benchmarking (`/analyse`)
- **Vision**: Provide deep, value-driven insights beyond basic revenue.
- **Features**:
    - **Value Creation (EBITDA)**: Aggregated EBITDA per industry/region to show where the "engine" of the economy is.
    - **Solvency Benchmarking**: Interactive ranking of industries by financial robustness (% companies with >20% equity).
    - **Efficiency Ratios**: Operating margin and return on equity (ROE) benchmarks.
- **Technical**: Update `IndustryStats` materialized view to include `total_ebitda` and `solvency_count` for sub-second performance.

### Real-time Bankruptcy Feed
- Poll Brønnøysund for new bankruptcies (daily)
- Notification/feed: "3 nye konkurser i dag i Oslo"
- Historical trend chart: Bankruptcies per month

---

## Priority 5: AI & Natural Language Interface

### Bedriftsgrafen Assistant (Chatbot)
- **Concept**: An intelligent conversational interface capable of answering complex data questions in natural language.
- **User Value**: Democratizes access to data analysis, allowing non-technical users to extract deep insights without needing SQL or advanced filtering skills.
- **Example Queries**:
  - "What percentage of companies have more than 100 MNOK in revenue?"
  - "Compare bankruptcy rates between construction and retail sectors in 2024."
  - "Find companies in Oslo with >20% profit margin and <5 employees."
- **Technical Strategy**:
  - **RAG / Text-to-SQL**: Use an LLM agent aware of the database schema and domain logic (NACE codes, accounting terms) to generate safe SQL queries.
  - **Guardrails**: Strict read-only database user and query validation to ensure accuracy and prevent misuse.

## Priority 6: Future Vision (Post-MVP)

| Feature | Description | Effort |
|---------|-------------|--------|
| **Role Network** | Visualize connections between people/companies | High |
| **Ownership Graph** | Visualize ownership chains between companies | High |
| **Search Results Page** | Dedicated page for person search results (`/search?q=...`) | Medium |
| **Predictive Risk Score** | ML model predicting bankruptcy likelihood | Very High |
| **Export to Excel/PDF** | Professional reports for due diligence | Medium |
| **API for Third Parties** | Monetization via API access | Medium |
| **Alerts/Notifications** | "Notify me when X company files new accounts" | Medium |

---

## SEO & Discoverability

### Structured Data (JSON-LD)
- Implement Schema.org `Organization` objects on company pages
- Include: name, identifier (orgnr), address, foundingDate
- Canonical URLs without query params

### Meta Tags
- Dynamic meta descriptions per route
- Open Graph tags for social sharing
- Twitter Card support

---

## Technical Improvements

### Index Optimization
- Tier-based index strategy for performance
- Materialized views for expensive aggregations
- Regular VACUUM ANALYZE maintenance

### Rate Limiting
- Implement rate limiting for API endpoints
- Protect against abuse while maintaining UX

### Testing Coverage
- Expand unit test coverage
- Add E2E tests for critical user flows
- Performance benchmarking

---

## Strategic Positioning

### Market Differentiation
- **Real-time Visualization**: Faster updates than competitors
- **Comparative Analysis**: Side-by-side company comparison (free)
- **Sector Benchmarking**: Automatic industry context via SSB integration

### Competitive Advantages
- Open data foundation (no licensing costs)
- Modern tech stack (faster, more responsive)
- Geographic visualization (unique offering)
- Free tier with premium features

---

## Status Tracking

- [x] Purpose Search (Basic)
- [/] Purpose Search (Advanced/Formål)
- [x] Industry Benchmarking (basic)
- [x] Industry Statistics Dashboard
- [x] Bankruptcy Heatmap
- [/] Enhanced Landing Page (v1)
- [x] New Companies Feed
- [x] Geographic Visualization
- [/] SSB Integration (Basic)
- [/] Similar Companies (Backend Only)
- [x] Person Search (Commercial Only)
- [ ] Gaselle Detection
- [ ] Role Network Graph
- [ ] Ownership Chain Visualization
