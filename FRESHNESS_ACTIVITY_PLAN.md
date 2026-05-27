# Freshness And Activity Plan

**Date:** 2026-05-27  
**Status:** F2 verified in production; F3a event-ledger foundation is in progress  
**Purpose:** Make Bedriftsgrafen feel current and alive without making false freshness claims or adding unsafe production queries.

## Current Status

- F0 company profile freshness: implemented and validated before this plan was persisted.
- F1 homepage `Siste bevegelser`: implemented in `LiveDataPanel` using existing `/api/stats` and existing routes.
- F2 `/oppdateringer` V1: implemented with index-backed new-company and bankruptcy feeds, data status, and a visible deferred accounting feed.
- F2 production freshness verified on 2026-05-27 after rebuild: public activity API returned 200, newest company registration date was 2026-05-27, newest bankruptcy date was 2026-05-26, and Brreg cursors were updated on 2026-05-27.
- Next implementation item: F3a event-ledger foundation for durable activity history.

## Decision

Start with low-risk freshness cues that use data already available in the frontend. Move to public activity feeds only after source semantics, query budgets, and event storage are clear.

## Verified Data Reality

- `bedrifter`: 1,163,193 companies; newest `registreringsdato_enhetsregisteret` observed: 2026-05-27.
- `regnskap`: 420,174 accounting rows; newest Bedriftsgrafen write/update timestamp observed: 2026-05-27.
- `latest_accountings`: 416,706 rows; newest accounting year observed: 2025.
- `latest_financials`: 412,458 rows; newest accounting year observed: 2025.
- Brreg update cursors in `system_state` were current for company, subunit, and role sync on 2026-05-27.
- Production has no real `bedrifter.updated_at` column, and `bedrifter.data->>'oppdatert'` is null for checked rows.
- `last_polled_regnskap` is a Bedriftsgrafen control timestamp. Label it as `Regnskap sist kontrollert`, not official filing date.
- `regnskap.created_at` and `regnskap.updated_at` may support `lagt til hos Bedriftsgrafen`, but not `innsendt til Brreg` unless an official source timestamp is found.
- Employee counts are current-state data. Real employee-change feeds need snapshots or an event ledger.
- Brreg kunngjoringer should be ingested through XML/subscription or another approved source path, not frontend scraping.

## Phase F0: Company Profile Freshness V0

**Goal:** Make every company page feel current and trustworthy without backend migration.

Use existing frontend fields:

- `stiftelsesdato`.
- `registreringsdato_enhetsregisteret`.
- `registreringsdato_foretaksregisteret`.
- `konkursdato` with status flags.
- `regnskap[].aar` and `regnskap[].periode_til`.
- `siste_innsendte_aarsregnskap` when present.
- `last_polled_regnskap` as a Bedriftsgrafen control timestamp.
- `geocoded_at` as Kartverket-derived address enrichment timestamp.

Definition of done:

- No backend migration and no production DB writes.
- No broad JSON scans or new aggregate endpoints.
- Norwegian UI text.
- Unit tests cover event generation and the no-invented-update-timestamp rule.
- Light, dark, desktop, and mobile browser checks pass.

## Phase F1: Homepage `Siste Bevegelser`

**Status:** Implemented locally on 2026-05-27.

**Goal:** Give the front page a visible freshness entry point using existing page families and existing stats.

Scope:

- Add a homepage section linking to `/nyetableringer` and `/konkurser`.
- Reuse existing `/api/stats` values already fetched on the homepage: `new_companies_30d`, `new_companies_ytd`, `bankruptcies`, `total_accounting_reports`, and `geocoded_count` where useful.
- Label accounting as coverage/status, not latest filing activity.
- Keep the module navigational and confidence-building, not a fake live feed.

Definition of done:

- No backend changes.
- No new live full-table aggregates.
- Links deepen existing pages rather than creating duplicate SEO pages.
- Mobile and dark mode have no horizontal overflow and readable contrast.
- Unit/e2e coverage protects labels and layout.

## Phase F2: Public `/oppdateringer` Hub V1

**Status:** Implemented and verified in production on 2026-05-27 after query-plan review.

**Goal:** Add a dedicated activity hub after F0/F1 language and UX are proven.

Measured query-plan results on 2026-05-27:

- New companies by `registreringsdato_enhetsregisteret DESC`: uses `idx_bedrifter_reg_enhetsregisteret_desc`, `LIMIT 24` executed in ~0.39 ms after removing an expensive secondary sort.
- Bankruptcies by `konkursdato DESC`: uses `idx_bedrifter_konkursdato_partial`, `LIMIT 24` executed in ~0.19 ms after removing an expensive secondary sort.
- Accounting rows by `regnskap.updated_at DESC`: no supporting index, parallel sequential scan + sort over `regnskap`, `LIMIT 12` executed in ~3.86 s. Do not expose as request-time public feed yet.
- Datastatus from `system_state`: tiny keyed table with current company, subunit, and role sync cursors.

V1 tabs/sections:

- Nye virksomheter: indexed `registreringsdato_enhetsregisteret`.
- Konkurser og avvikling: indexed status/date fields.
- Datastatus: current `system_state` rows with source/provenance labels.
- Utsatt feed: Nye regnskap hos Bedriftsgrafen. This needs either an index on `regnskap.updated_at`/`created_at` or the F3 event ledger before public request-time use.

Backend requirements:

- Pydantic response models for activity rows.
- Hard `limit` with `le=24`, query-plan reviewed feeds only, and Redis caching.
- Clear distinction between source event time, observed time, and Bedriftsgrafen ingestion time.
- No joins on accounting freshness until query budget is proven.

Frontend requirements:

- New `/oppdateringer` route with Norwegian UI text.
- Link from homepage `Siste bevegelser` and the header quick menu.
- Show source semantics directly on each feed, not hidden in docs.
- Mobile/dark-mode Playwright coverage and a live E2E check against the real backend proxy.

Definition of done:

- Queries use indexes and stay inside agreed p95 budget.
- Page remains controlled in navigation and sitemap impact is intentional.
- No source timestamp is implied where none exists.
- Accounting feed is visibly deferred with the measured reason rather than implemented with a slow scan.

Validation completed:

- `GET /v1/activity/overview?limit=12` on dev backend returned 200 in ~24 ms against real local data.
- Frontend route `/oppdateringer` passed desktop/mobile Playwright with mocked API data.
- Optional live Playwright check passed against the dev backend proxy.
- Backend focused router tests, Ruff, and mypy passed.
- Frontend focused unit tests, `npm run validate`, and `npm run build` passed.

## Phase F3: Event Ledger

**Goal:** Store durable activity history at ingestion time.

Split F3 into safe slices:

- F3a: schema/model/repository/read endpoint plus feature-flagged write hooks. This can be implemented and tested without applying a production migration from the chat session.
- F3b: apply migration deliberately, enable event writes, add a controlled backfill/repair job, and expose event-backed feeds publicly.
- F3c: employee, address, role, subunit, and Brreg kunngjoring event types after provenance and privacy review.

Suggested table: `company_events` or `business_events`.

Suggested fields:

- `orgnr`.
- `event_type`.
- `source`.
- `source_update_id`.
- `occurred_at` when the source provides it.
- `observed_at` when Bedriftsgrafen saw it.
- `previous_value` and `new_value` for field changes.
- `payload` for source-specific details.

Initial event types:

- `company_registered`.
- `status_changed`.
- `accounting_added`.
- `employee_count_changed`.
- `address_changed`.
- `role_changed`.
- `subunit_opened` / `subunit_closed`.

### Phase F3a: Event Ledger Foundation

Scope:

- Add `company_events` table migration with idempotency key and indexes for `orgnr + observed_at` and `event_type + observed_at`.
- Add SQLAlchemy model, Pydantic response schemas, repository, and service methods.
- Add `GET /v1/activity/events/{orgnr}` for company timelines with hard pagination limits.
- Add feature-flagged read endpoint and ingestion hooks in `UpdateService`; default disabled until the migration is applied and explicitly enabled.
- Record only low-risk initial events when enabled: `company_registered`, `company_deleted`, and `accounting_added`.
- Do not backfill in the schema migration. Backfill must be a separate measured job.

F3a definition of done:

- Migration is reversible and contains no large data rewrite.
- Event writes are idempotent through `event_key`.
- Update-service hooks cannot break normal sync if the feature flag is off.
- Event endpoint is gated until the ledger is enabled, uses bounded `limit` and `offset`, returns clear source/timestamp semantics, and does not imply official source dates where only observation time exists.
- Unit/router tests cover repository idempotency, endpoint validation/error handling, service response shaping, and disabled/enabled update-service hooks.
- Ruff, mypy, focused pytest, and migration syntax checks pass.

Definition of done:

- Events are written during import/update jobs, not calculated by request-time scans.
- Diffs are deterministic and replayable.
- Every public row carries source and timestamp semantics.

## Phase F4: Employee Changes And Brreg Kunngjoringer

Only after F3 exists:

- Store old and new `antall_ansatte` values when Brreg updates show a change.
- Ingest Brreg kunngjoringer through XML/subscription or another approved official path.
- Normalize kunngjoringer into event types with source links.
- Enrich company profile timelines and `/oppdateringer` filters.

Definition of done:

- No frontend scraping.
- Provenance is visible.
- Sensitive or person-related data gets GDPR review before indexing.

## Implementation Order

1. F0 company profile freshness, completed first.
2. F1 homepage `Siste bevegelser`, next low-risk item.
3. F2 `/oppdateringer` hub after query-plan review.
4. F3 event ledger before true change-history features.
5. F4 employee changes and Brreg kunngjoringer after provenance and privacy checks.