# Future Development Ideas

This document consolidates feature ideas and strategic plans for the future development of Bedriftsgrafen.no.

## Priority 1: High Impact / Quick Wins (1-3 days each)

---

### ~~Sidebar Map Layout~~ ✅ (Jan 21, 2026)
- **Goal**: Redesign the Map view to use a sidebar + map layout (Desktop).
- **Why**: Norway's geography is tall and narrow. A sidebar (30% width) for controls and stats, and a map (70% width) filling the vertical height, optimizes space and provides a better UX.
- **Status**: **IMPLEMENTED**. All filters moved to a modular, vertically-scrollable sidebar. MapGuide is now collapsible.

### Subunit Map View (Avdelinger)
- **Goal**: Add a "Map" toggle to the "Avdelinger" tab in the company profile.
- **Why**: Visualize the physical footprint of companies with many branches (e.g., Rema 1000, Equinor).
- **Tech**: Geocode `underenheter` table and implement `SubunitMap` component using `react-leaflet`.

### ~~Smart Badges for Search Results~~ ✅ (Jan 24, 2026)
- **Goal**: Add visual badges to search results to highlight key company traits.
- **Badges**:
  - 💎 **Solid**: Equity ratio (egenkapitalandel) >= 20%.
  - 🆕 **Ny**: Established in the last 12 months.
  - 🏛️ **Etablert**: Older than 20 years.
- **Status**: **IMPLEMENTED**. Dynamic badges added to `CompanyCard` component.

---

## Priority 2: Core Features (4-7 days each)

### "Battle Mode" (Gamified Comparison) ⚔️
- **Goal**: Transform the current basic comparison into a gamified "Fighting Game" style experience.
- **Features**: 
  - Side-by-side "stats cards" for two companies.
  - Metrics: Revenue Growth, Profit Margin, Solvency (Egenkapitalandel), and Efficiency.
  - Declare a "Winner" in each category and an "Overall Champion".
- **Why**: High virality potential and makes financial analysis accessible.

### Lead Generator (B2B Tool) 🎯
- **Concept**: A powerful query builder for sales and marketing professionals.
- **Filters**: "Find me [Carpenters] in [Bergen] with Revenue > [5 MNOK] and Profit > [10%]."
- **Action**: Export filtered results to CSV (potential premium feature).
- **Why**: Moves the platform from research to an active business enablement tool.

### "Local Heroes" (Municipality Dashboards) 🏘️
- **Goal**: Dedicated landing pages for every Norwegian municipality (e.g., `/kommune/0301`).
- **Features**:
  - "Top 10 Most Profitable" in the area.
  - "Newest Establishments" (last 30 days).
  - SEO-optimized content ("Se oversikt over bedrifter i [Kommune]").
- **Tech**: New route structure `/kommune/[id]` with aggregated local queries.
- **Status**: **BACKEND IMPLEMENTED** (Sitemap & Repository support added).

### County (Fylker) Dashboards 📍
- **Goal**: Dedicated landing pages for Norwegian counties (e.g., `/fylke/46`).
- **Why**: High-volume SEO terms ("Bedrifter i Vestland").
- **Tech**: `/fylke/[id]` route mapping to `COUNTY_CODES`.

### Industry Landing Pages (NACE) 🏗️
- **Goal**: Dedicated SEO pages for industry sectors (e.g., `/bransje/41` for Byggevirksomhet).
- **Features**:
  - Industry-specific benchmarks and growth trends.
  - "Top performers" in the sector.
- **Why**: Captures professional search traffic for specific business sectors.

### Hierarchical Org Charts 🌳
- **Goal**: Visualize the parent-child relationship between main entities and subunits.
- **Tech**: Use `react-flow` to render a tree-like structure from `underenheter` data.

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

---

## Priority 4: Network & AI

### Bedriftsgrafen Assistant (AI Chatbot)
- **Concept**: Conversational interface for complex data queries.
- **Queries**: "Finn selskaper i Bergen med >10% margin og <10 ansatte".
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
