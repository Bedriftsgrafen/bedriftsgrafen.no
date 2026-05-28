# Freshness And Activity Plan

**Date:** 2026-05-28
**Status:** F0-F3b are live; F4a, the narrow company-event classifier slice of F4b, and the F4e business-change feed are implemented; true Brreg kunngjoringer remain deferred.
**Purpose:** Make Bedriftsgrafen feel current and alive without making false freshness claims, unsafe production queries, or unclear source/provenance claims.

## Current Status

- F0 company profile freshness: implemented and validated.
- F1 homepage `Siste bevegelser`: implemented in `LiveDataPanel` using existing stats and existing routes.
- F2 `/oppdateringer` V1: implemented with index-backed new-company and bankruptcy feeds, data status, and event-backed accounting/employee feed slots.
- F3a event-ledger foundation: implemented, migrated, enabled in production, and committed.
- F3b event-backed accounting feed: implemented, committed, deployed, and backfilled for recent accounting rows.
- Employee-count event tracking: implemented for changes observed after event-ledger activation.
- Footer Datakilde freshness link: implemented.
- Company-profile event timeline: implemented using `GET /v1/activity/events/{orgnr}`.
- Brreg update-derived company events: schema support, `includeChanges=true`, `Fjernet` handling, and narrow event classification for name, address, industry, status, and employee-count changes are implemented in the backend.
- `/oppdateringer` business-change feed: implemented as an event-backed `business_changes` feed and `Endringer` tab for selected company update events.
- Brreg kunngjoringer: still deferred. Research on 2026-05-28 shows that Enhetsregisterets `oppdateringer` API is excellent for update-derived change events, but it is not the same thing as official kunngjoring texts.

## Decision

Use two distinct lanes and label them honestly:

1. **Brreg oppdateringer / change events**: use the official open JSON API from Enhetsregisteret to create richer event-ledger rows for names, addresses, industry codes, status changes, employee counts, subunits, and role update signals. These are not official kunngjoring texts.
2. **Brreg kunngjoringer**: ingest only through Brreg's official subscription/XML path or another approved source path. Do not scrape the legacy `w2.brreg.no/kunngjoring` pages. Keep this deferred until source access, delivery format, retention, and GDPR handling are decided.

Do not add Gemini's suggested `virksomhet_oppdateringer` table. Bedriftsgrafen already has `company_events`, source-update idempotency, and event-type/observed-time indexes. Extend that ledger instead.

## Verified Data Reality

Production observations on 2026-05-28:

- `company_events` contains event-backed history and is the right serving surface for public activity feeds.
- Current production event counts observed: `accounting_added` ~101k rows, `company_deleted` rows present, and employee-change rows are expected only when future Brreg updates change a previously known employee count.
- `/v1/activity/overview?limit=3` returns active `accounting_updates`, active `employee_changes`, current data-status rows, and only `brreg_announcements` as a deferred feed.
- System cursors are fresh for company, subunit, and role updates.
- `last_polled_regnskap` is a Bedriftsgrafen control timestamp. Keep labeling it as `Regnskap sist kontrollert`, never official filing time.
- `regnskap.created_at` and `regnskap.updated_at` can support `lagt til hos Bedriftsgrafen`, but not `innsendt til Brreg` unless an official source timestamp is found.
- Role data contains person-related public data and has display restrictions when aggregating person roles. Any role-change feed needs a GDPR/product review before person-level names are shown in public activity streams.

## Brreg Research Findings 2026-05-28

### Enhetsregisteret Updates API

Official documentation confirms these open endpoints under `https://data.brreg.no/enhetsregisteret/api`:

- `GET /oppdateringer/enheter`
- `GET /oppdateringer/underenheter`
- `GET /oppdateringer/roller`

Important corrections to the quick Gemini research:

- The current documented parameters for enheter/underenheter are `dato`, `updatedBefore`, `oppdateringsid`, `organisasjonsnummer`, `includeChanges`, `page`, `size`, and `sort=id,ASC|DESC`. It is not just `oppdateringsdato=YYYY-MM-DD`.
- Brreg recommends first filtering by date, then continuing by update id. `oppdateringsid + 1` can be used to fetch the next set.
- `includeChanges=true` exists and returns JSON Patch-style `endringer` with `op`, `path`, and sometimes `value`. This means we can classify some changes without fetching every full object solely to know what changed.
- Endringstyper for enheter/underenheter include `Ny`, `Endring`, `Sletting`, `Fjernet`, and older `Ukjent` cases.
- Role updates are CloudEvents batches from `/oppdateringer/roller` with `id`, `source`, `type`, `time`, and `data.organisasjonsnummer`; they do not include role diffs directly.
- Live probe for 2026-05-27 UTC window returned thousands of enhet updates and hundreds of underenhet updates, with `endringer` paths such as `/aktivitet`, `/naeringskode1/kode`, `/postadresse`, and address fields.

### True Brreg Kunngjoringer

Brreg's public pages distinguish this from Enhetsregisteret updates:

- Brreg publishes kunngjoringer for registrations, important changes, debt negotiation, dissolutions, deletions, and more.
- A free email subscription exists for daily or weekly links to kunngjoringer.
- A separate XML subscription exists for daily registration announcements from Foretaksregisteret, Konkursregisteret, Regnskapsregisteret, Partiregisteret, and Stiftelsestilsynet. Brreg explicitly says this is suitable if you want to build a database with the same announcement texts used in the kunngjoring solution.
- Likely public web entry points remain legacy `w2.brreg.no/kunngjoring/...` pages. Do not scrape these for production ingestion.
- No open `data.brreg.no/.../kunngjoringer` JSON API was found; likely paths redirect to Brreg's general open-data page.
- RSS is for operational messages/news/open-data notifications, not individual company kunngjoringer.

## Event Ledger Principles

All public activity rows should be written at ingestion time and read from bounded event queries.

Required event fields already exist:

- `orgnr`
- `event_type`
- `source`
- `source_update_id`
- `event_key`
- `occurred_at`
- `observed_at`
- `previous_value`
- `new_value`
- `payload`

Timestamp semantics:

- `occurred_at`: source event/publication time when Brreg supplies it, or source period end when the event is a period-based accounting event.
- `observed_at`: when Bedriftsgrafen observed, imported, or backfilled the event.
- Public UI must show which timestamp is being displayed.

Idempotency:

- Use `(orgnr, event_type, source_update_id)` where Brreg gives stable update/event ids.
- Use deterministic `event_key` for derived events when one Brreg update maps to multiple public event rows.
- Never calculate a public activity feed by scanning `regnskap` or large raw JSON at request time.

## Phase F0: Company Profile Freshness V0

**Status:** Complete.

Goal: make every company page feel current and trustworthy without backend migration.

Implemented using existing frontend fields:

- `stiftelsesdato`
- `registreringsdato_enhetsregisteret`
- `registreringsdato_foretaksregisteret`
- `konkursdato` with status flags
- `regnskap[].aar` and `regnskap[].periode_til`
- `siste_innsendte_aarsregnskap`
- `last_polled_regnskap` as a Bedriftsgrafen control timestamp
- `geocoded_at` as Kartverket-derived address enrichment timestamp

## Phase F1: Homepage `Siste Bevegelser`

**Status:** Complete.

Goal: give the front page a visible freshness entry point using existing page families and existing stats.

Implemented with navigation to `/nyetableringer`, `/konkurser`, and freshness/status cues without implying unavailable live filing activity.

## Phase F2: Public `/oppdateringer` Hub V1

**Status:** Complete.

Goal: add a dedicated activity hub after F0/F1 language and UX were proven.

Implemented feeds:

- Nye virksomheter: indexed `registreringsdato_enhetsregisteret`.
- Konkurser og avvikling: indexed status/date fields.
- Nye regnskap hos Bedriftsgrafen: event-backed from `company_events`.
- Endringer i ansatte: event-backed feed slot from `company_events`, populated only for changes observed after activation.
- Datastatus: `system_state` rows with source/provenance labels.
- Deferred feed: true Brreg kunngjoringer.

Query principle remains unchanged: request-time public feeds must use reviewed indexes or the event ledger.

## Phase F3: Event Ledger

**Status:** F3a and F3b complete.

### Phase F3a: Event Ledger Foundation

Completed scope:

- `company_events` table with idempotency key and indexes.
- SQLAlchemy model, repository, service, Pydantic schemas, and read endpoint.
- `GET /v1/activity/events/{orgnr}` with bounded pagination.
- Feature-flagged write hooks.
- Initial event types for company/accounting lifecycle.

### Phase F3b: Event-Backed Accounting Feed

Completed scope:

- `accounting_updates` in `/v1/activity/overview`, sourced from `company_events`.
- Controlled recent accounting event backfill.
- `/oppdateringer` accounting feed active with source/timestamp semantics.
- Company-profile event timeline active.

Remaining cleanup for F3:

- Update stale docs/comments that still describe accounting as deferred.
- Consider adding an admin-only event-ledger diagnostics endpoint for event counts, latest ids, and ingest lag.

## Phase F4: Brreg Update-Derived Change Events

**Goal:** Turn Brreg's official update stream into richer event-log activity without pretending these rows are official kunngjoring texts.

### Phase F4a: Source Semantics And DTO Update

**Status:** Implemented for company update ingestion. Underenhet and role-specific DTO expansion remains for F4c/F4d.

Scope:

- Update `schemas/brreg.py` to model `endringer`, `Fjernet`, and the documented update fields.
- Add typed structures for JSON Patch-like changes: `op`, `path`, `value`.
- Add constants for public, internal, and sensitive change paths.
- Rename internal copy where useful from "kunngjoringer" to "Brreg-oppdateringer" unless the data really comes from the kunngjoring subscription.

Suggested path categories:

- Identity: `/navn`, `/organisasjonsform`, `/stiftelsesdato`.
- Status: `/konkurs`, `/konkursdato`, `/underAvvikling`, `/underTvangsavviklingEllerTvangsopplosning`, liquidation/dissolution date fields.
- Address: `/forretningsadresse`, `/postadresse`, underenhet `/beliggenhetsadresse`.
- Industry: `/naeringskode1`, `/naeringskode2`, `/naeringskode3`, `/hjelpeenhetskode`, `/aktivitet`.
- Employees: `/antallAnsatte`, `/harRegistrertAntallAnsatte`, employee-count registration-date fields.
- Registry flags: MVA, Foretaksregisteret, Frivillighetsregisteret, Stiftelsesregisteret, Partiregisteret.
- Capital/audit: `/kapital`, `/fravalgRevisjonDato`, `/fravalgRevisjonBeslutningsDato`.

Definition of done:

- Live sample fixture from Brreg update API is captured in tests.
- Parser tolerates unknown paths and records them as internal diagnostics, not public claims.
- UI copy and deferred labels distinguish "Brreg-oppdateringer" from "Brreg-kunngjoringer".

### Phase F4b: Company Update Event Classifier

**Status:** Narrow backend slice implemented for `name_changed`, `address_changed`, `industry_changed`, `status_changed`, existing `employee_count_changed`, and `company_removed_from_open_data`. Public `/oppdateringer` business-change feed is still F4e.

Scope:

- Extend `UpdateService.fetch_updates()` to request `includeChanges=true` once parsing is ready.
- Before upserting the Brreg company object, fetch a lightweight local snapshot of fields needed for previous values.
- After upsert, classify event rows from either `endringstype` or `endringer` paths.
- Record event rows in `company_events` with `source_update_id = oppdateringsid`, `occurred_at = dato`, and `payload.brreg_changes` for the normalized path list.
- Preserve the existing employee-count comparison, but enrich it with source `endringer` when present.

Initial public event types:

- `company_registered`
- `company_deleted`
- `company_removed_from_open_data` for `Fjernet` / 410-style legal removal cases
- `name_changed`
- `address_changed`
- `industry_changed`
- `status_changed`
- `employee_count_changed`
- `registry_flag_changed`
- `capital_changed` only if the copy is clear and useful

Implementation notes:

- One Brreg update can create several derived event rows. Build event keys with `event_type`, `orgnr`, `source_update_id`, and a stable path-category digest.
- Do not create noisy rows for every low-level address field. Collapse multiple address patches from the same update into one `address_changed` event.
- For `Sletting` and `Fjernet`, do not fetch full object unless needed for cleanup; record event and follow deletion/removal policy.
- Keep write failures isolated with nested transactions, as the current event hooks already do.

Definition of done:

- Unit tests cover path grouping, event-key stability, and unknown path behavior.
- Integration tests cover `Ny`, `Endring`, `Sletting`, and `Fjernet` update rows.
- Existing scheduler behavior and cursor advancement remain unchanged.
- No event-write failure can break the primary company sync.

### Phase F4c: Subunit Update Events

**Status:** Backend ledger slice implemented. `fetch_subunit_updates()` requests `includeChanges=true`, records subunit lifecycle/change events under the subunit orgnr, and includes `payload.parent_orgnr`. Public `/oppdateringer` inclusion remains intentionally deferred until the UI copy separates underenheter from main company changes.

Scope:

- Extend `fetch_subunit_updates()` to request `includeChanges=true`.
- Record subunit lifecycle and change events into `company_events` with the subunit orgnr and parent orgnr in payload.
- For company profiles, decide whether parent pages should also show major subunit events. Start by showing them only on the subunit page unless there is a strong UX reason.

Initial event types:

- `subunit_opened`
- `subunit_closed`
- `subunit_address_changed`
- `subunit_industry_changed`
- `subunit_employee_count_changed`

Definition of done:

- [x] Subunit events use the same source/timestamp/idempotency semantics as company events.
- [ ] `/oppdateringer` can include subunit events only after the copy makes clear that the changed entity is an underenhet.
- [x] Parent-company contamination is avoided unless explicitly designed.

### Phase F4d: Role Update Events, Privacy-First

**Status:** Backend ledger slice implemented. Role CloudEvents now produce coarse `roles_changed` events after a successful role refresh for the affected orgnr. The event payload keeps CloudEvent metadata and role count only; person-level role deltas remain intentionally out of public activity feeds.

Scope:

- Use `/oppdateringer/roller` CloudEvents as the source of truth for role update signals.
- Record a coarse `roles_changed` event per orgnr using CloudEvent `id` as `source_update_id` and `time` as `occurred_at`.
- Keep person-level names out of public activity feeds in the first implementation.
- Later, after review, compare previous and new role sets to derive safer summaries such as `styre_changed`, `daglig_leder_changed`, or `auditor_changed`.

Why coarse first:

- The role update endpoint tells us which company's roles changed, not the exact diff.
- Fetching full role lists and publishing person-level deltas creates privacy and product-risk questions.
- Brreg documentation explicitly warns about restrictions when showing a person's roles across organizations.

Definition of done:

- [x] Role cursor handling remains robust and idempotent.
- [x] Public/event-title copy says "Rolleinformasjon endret", not "styreleder byttet" or similar unverified diffs.
- [ ] Person-level role-change display has a documented GDPR/product decision before exposure.

### Phase F4e: Public Business Changes Feed

**Status:** Implemented for company-level `name_changed`, `address_changed`, `industry_changed`, and `status_changed` events. Event-type filters and geography/organization-form filters remain later enhancements.

Scope:

- Add an event-backed feed to `/v1/activity/overview`, for example `business_changes`, sourced from selected F4 event types.
- Add a `/oppdateringer` tab such as `Endringer` or `Virksomhetsendringer`.
- Keep the existing summary cards and feed model, but add event-type badges and source semantics.
- Add optional filters only after the base feed is stable: event type first, then geography/organization form.

Backend query options:

- Add repository method for latest events by a whitelist of event types with company join.
- Query against `company_events` only; do not diff current company rows at request time.
- For multi-type feed, either query each event type with `LIMIT` and merge in Python, or use `event_type IN (...)` only after query-plan review.

Frontend copy rules:

- Use `Brreg oppdateringsstrøm` for update-derived events.
- Use `Bedriftsgrafen eventlogg` for the storage/observation layer.
- Do not use the word `kunngjøring` for update-derived rows.
- Always show whether the date is Brreg update time or Bedriftsgrafen observation time.

Definition of done:

- API response models and TypeScript types include the new feed.
- Empty state is calm and truthful.
- Tests cover event-type badges, source labels, and timestamp semantics.
- Query plan is reviewed on production-sized data before exposing the feed publicly.

### Phase F4f: Backfill Strategy For Update-Derived Events

**Status:** First backend maintenance slice implemented for company updates. `backend/scripts/replay_brreg_update_events.py` can dry-run or apply bounded Enhetsregisteret company update windows with `--from-id`/`--from-time`, optional `--to-id`/`--to-time`, required `--limit`, required `--batch-size`, and explicit `--apply` for writes. Replay progress is stored in `system_state.company_event_replay_latest_id`, separate from the live scheduler cursor.

Scope:

- Do not attempt a broad historical reconstruction of all company changes from current-state tables.
- Backfill only from Brreg update API windows where source update rows can still be fetched and replayed safely.
- Build a dry-run-first replay script with explicit `--from-id`, `--to-id`, `--from-time`, `--to-time`, `--limit`, `--batch-size`, and `--apply`.
- Record replay progress separately from the live scheduler cursor to avoid disturbing production sync.

Definition of done:

- [x] Dry run reports candidate rows by event type and estimated writes for company update rows.
- [x] Apply mode commits in small chunks and is idempotent through `company_events` event keys/source IDs.
- [x] No unbounded production backfill is possible for the implemented company replay script.
- Backfill is optional; live forward history is acceptable if historical source rows are too expensive or noisy.

Example dry-run:

```bash
cd backend
.venv/bin/python scripts/replay_brreg_update_events.py \
	--from-id 123456 \
	--to-id 124000 \
	--limit 1000 \
	--batch-size 100
```

Apply requires `ENABLE_COMPANY_EVENT_LEDGER=true` and explicit `--apply`.

## Phase F5: True Brreg Kunngjoringer

**Goal:** Ingest and publish official kunngjoring texts only from an approved source path.

### Phase F5a: Source Access Decision

Options:

- **Email link subscription:** free and easy to order, but not good for automated ingestion because it delivers links via email. Good for manual monitoring only.
- **XML subscription:** the correct path for building a database of the same kunngjoring texts used by Brreg's public kunngjoring solution. Requires reading technical description, terms/prices, delivery method, agreement flow, and contact details before implementation.
- **Legacy web search pages:** useful for manual verification, not an ingestion source.

Decision gate before coding:

- Confirm exact delivery method, authentication, file naming, retention, and update cadence for XML.
- Confirm allowed publication scope and source attribution text.
- Confirm GDPR handling for person-related announcement content.
- Decide whether the business value justifies the subscription setup now or whether F4 update-derived events are sufficient for the next product iteration.

Definition of done:

- A short source decision note exists in this plan or a dedicated ops doc.
- No parser is built until the data contract is known.
- `/oppdateringer` continues showing Brreg kunngjoringer as planned/deferred until this gate passes.

### Phase F5b: Raw Announcement Ingestion Sandbox

Scope:

- Add staging storage for raw XML files/messages, separate from normalized public events.
- Suggested table: `brreg_announcement_imports` or `brreg_announcement_raw`.
- Store file name/source id, checksum, fetched/imported timestamp, raw XML payload or archived path, parser version, status, and error details.
- Build a parser that normalizes to internal DTOs without publishing them.
- Keep imports feature-flagged and admin-only.

Definition of done:

- Raw ingest is idempotent by checksum/source id.
- Parser tests cover representative XML samples from each subscribed register/type.
- Failed files are visible and retryable.
- No public endpoint reads raw XML directly.

### Phase F5c: Normalize Announcements Into Event Ledger

Scope:

- Map XML announcements into `company_events` rows with `event_type = brreg_announcement` plus `payload.announcement_type`, or use specific event types if the taxonomy is stable.
- Store official publication time as `occurred_at` where available.
- Store Brreg source link/id and register name in payload.
- Attach announcement text summary, not necessarily the full text, depending on terms and UX.

Candidate announcement categories:

- Foretaksregisteret registrations and changes.
- Konkursregisteret bankruptcy/debt negotiation events.
- Regnskapsregisteret filing/approval announcements if included and legally useful.
- Partiregisteret and Stiftelsestilsynet events if relevant to company profiles.

Definition of done:

- Idempotent event keys from official announcement id/source reference.
- Event rows clearly say `Brreg kunngjoring` as source.
- Legal/source attribution text is present in API and UI.
- Sensitive/person-heavy announcement categories are hidden until reviewed.

### Phase F5d: Public Kunngjoringer UI

Scope:

- Activate the deferred `brreg_announcements` feed in `/v1/activity/overview` only after F5b/F5c are stable.
- Add `/oppdateringer?tab=kunngjoringer` or replace the deferred card with an active feed.
- Add company-profile timeline rows for official kunngjoringer.
- Provide source links back to Brreg where available.

Definition of done:

- UI labels distinguish `Kunngjort hos Brreg` from `Observert hos Bedriftsgrafen`.
- Feed is event-backed and query-plan reviewed.
- Browser checks pass on desktop/mobile/dark mode.
- Public launch includes source/provenance copy and a rollback plan.

## Implementation Order From Here

1. **F4a:** Update schemas/types and source-language cleanup for Brreg update-derived events.
2. **F4b:** Add company update classifier using `includeChanges=true`, local snapshots, and new event types.
3. **F4e small UI slice:** Add `business_changes` feed to `/oppdateringer` once F4b has live rows.
4. **F4c:** Add subunit update events.
5. **F4d:** Add coarse role update events, keeping person-level detail hidden.
6. **F4f:** Add optional dry-run replay/backfill for update-derived events.
7. **F5a:** Make source/access decision for true Brreg kunngjoringer XML subscription.
8. **F5b-F5d:** Ingest, normalize, and expose official kunngjoringer only after the source gate passes.

## Near-Term Recommended Next Slice

Implement **F5a source/access decision for true Brreg kunngjoringer XML subscription** next.

Recommended target:

- decide whether XML subscription is worth pursuing now, and document source/access/legal constraints before any parser work

Keep `/oppdateringer` wording strict until this gate passes: Brreg update-derived rows are not formal kunngjoringer.
