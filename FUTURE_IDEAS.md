# Future Development Ideas

This document consolidates feature ideas and strategic plans for future development of Bedriftsgrafen.no.

## Priority 1: Quick Wins (1-2 days each)

### Purpose Search (Formål)
- Add `vedtektsfestet_formaal` to search index
- Users can search "frisør", "konsulent", "eiendom" etc.
- Already have data, just need to update the TSVECTOR trigger

### Industry Statistics Dashboard
- New endpoint: `/v1/stats/industries`
- Materialized view with pre-aggregated data per NACE code
- Show: Company count, total revenue, total employees, avg profit margin
- Frontend: Simple table/cards on a new "Bransjer" page

### Bankruptcy Heatmap by County
- Query existing data: `konkurs=true` grouped by `forretningsadresse->kommunenummer`
- Map visualization using Leaflet (already integrated)
- Color intensity = bankruptcy density

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

---

## Priority 3: Advanced Analytics (1-2 weeks each)

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
- Badge system: 🔥 Gaselle, 📈 Vekst, ➡️ Stabil, 📉 Fallende
- New page: "Top Vekstbedrifter" (filterable by region/industry)
- Materialized view refreshed weekly

### Real-time Bankruptcy Feed
- Poll Brønnøysund for new bankruptcies (daily)
- Notification/feed: "3 nye konkurser i dag i Oslo"
- Historical trend chart: Bankruptcies per month

---

## Priority 4: Future Vision (Post-MVP)

| Feature | Description | Effort |
|---------|-------------|--------|
| **People Search** | Search "Ola Nordmann" → Find all roles | Very High |
| **Ownership Graph** | Visualize ownership chains between companies | High |
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

- [x] Purpose Search
- [x] Industry Benchmarking (basic)
- [ ] Industry Statistics Dashboard
- [ ] Bankruptcy Heatmap
- [ ] Enhanced Landing Page
- [ ] New Companies Feed
- [ ] Geographic Visualization
- [ ] SSB Integration
- [ ] Gaselle Detection
