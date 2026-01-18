# Future Development Ideas

This document consolidates feature ideas and strategic plans for the future development of Bedriftsgrafen.no.

## Priority 1: High Impact / Quick Wins (1-3 days each)

### Advanced Purpose Search (Formål)
- **Goal**: Full-text search within `vedtektsfestet_formaal`.
- **Status**: Backend column and storage logic exist.
- **Action**: Update the `search_vector` TSVECTOR database trigger to include the `vedtektsfestet_formaal` column. This enables searches like "frisør", "kunstig intelligens", or "gravemaskin".

### Immediacy Filters (Shortcut Support)
- **Goal**: Add `period=30d` and `period=90d` filters to `/nyetableringer` and `/konkurser` routes.
- **Why**: Supports the "Market Pulse" strategy by allowing users to see the absolute latest activity without manual date picking.

### Sidebar Map Layout 🗺️
- **Goal**: Redesign the Map view to use a sidebar + map layout (Desktop).
- **Why**: Norway's geography is tall and narrow. A sidebar (30% width) for controls and stats, and a map (70% width) filling the vertical height, optimizes space and provides a better UX.
- **Tech**: Refactor `IndustryMap.tsx` and move filters to a dedicated sidebar.

### Subunit Map View (Avdelinger)
- **Goal**: Add a "Map" toggle to the "Avdelinger" tab in the company profile.
- **Why**: Visualize the physical footprint of companies with many branches (e.g., Rema 1000, Equinor).
- **Tech**: Geocode `underenheter` table and implement `SubunitMap` component using `react-leaflet`.

---

## Priority 2: Core Features (4-7 days each)

### "Battle Mode" (Gamified Comparison) ⚔️
- **Goal**: Transform the current basic comparison into a gamified "Fighting Game" style experience.
- **Features**: 
  - Side-by-side "stats cards" for two companies.
  - Metrics: Revenue Growth, Profit Margin, Solvency (Egenkapitalandel), and Efficiency.
  - Declare a "Winner" in each category and an "Overall Champion".
- **Why**: High virality potential and makes financial analysis accessible.

### "Local Heroes" (Municipality Dashboards) 🏘️
- **Goal**: Dedicated landing pages for every Norwegian municipality (e.g., `/kommune/oslo`).
- **Features**:
  - "Top 10 Most Profitable" in the area.
  - "Newest Establishments" (last 30 days).
  - SEO-optimized content ("Se oversikt over bedrifter i [Kommune]").
- **Tech**: New route structure `/kommune/[id]` with aggregated local queries.

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
- **Structured Data (JSON-LD)**: Improve SEO by exposing `Organization` schema to search engines.
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