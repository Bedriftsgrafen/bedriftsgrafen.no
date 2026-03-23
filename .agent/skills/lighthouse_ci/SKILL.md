---
name: lighthouse_ci
description: Run Lighthouse CI audits for performance, accessibility, SEO, and best practices.
---

# Lighthouse CI Audit

## Quick Run

```bash
# From project root — builds frontend, then audits
npm run lighthouse
```

Prerequisites: `npm install` at root level. No backend needed (static pages only).

## Audited Pages

Configured in `lighthouserc.cjs`:

| Page | URL |
|------|-----|
| Home | `/` |
| Search | `/search` |
| About | `/om` |
| Industries | `/bransjer` |
| Bankruptcies | `/konkurser` |
| New Establishments | `/nyetableringer` |
| Explore | `/utforsk` |
| Counties | `/fylker` |
| County Detail | `/fylke/03` |
| Municipalities | `/kommuner` |
| Municipality Detail | `/kommune/0301` |

**Excluded**: `/kart` (needs backend), `/bedrift/:orgnr` (dynamic), `/sammenlign` (noindex).

Preview server runs on port **5174** (see `vite.config.ts`).

## Thresholds

| Category | Minimum | Level |
|----------|---------|-------|
| Accessibility | 85% | Error (blocks CI) |
| SEO | 90% | Warn |
| Best Practices | 80% | Warn |
| Performance | 50% | Warn |

Performance is relaxed due to third-party scripts. Prioritize accessibility and SEO.

## Reports

After running:
1. JSON reports saved to `.lighthouseci/` (gitignored)
2. Shareable link printed to terminal (auto-expires after 7 days)

## Manual Steps

```bash
cd frontend && npm run build         # Step 1: Build
npx lhci autorun                     # Step 2: Audit (from project root)
```

For stable scores: `npx lhci autorun --collect.numberOfRuns=5`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No Chrome found | `sudo apt install chromium-browser` or set `CHROME_PATH` |
| Port 5174 in use | `fuser -k 5174/tcp` |
| Flaky performance scores | Increase runs with `--collect.numberOfRuns=5` |

## Disabled Audits

Intentionally disabled in config: `valid-source-maps`, `uses-http2`, `errors-in-console`, `unused-javascript`.
