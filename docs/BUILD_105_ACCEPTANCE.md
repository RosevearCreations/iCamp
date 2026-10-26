# iCamp Build 105 — Cross-Campground Owner Resolution Evidence Search & Export Acceptance

## Operator delivery

- The Build 104 independent reassessment screen links to a separate Build 105 owner evidence search workbench.
- Search the Build 103 original coordination resolution, its **latest** Build 104 independent reassessment and its (optional) acceptance. Search is literal by internal evidence reference; filter by source, target, current status and bounded UTC resolution date range. Pages contain at most 50 records; after 20 pages, narrow the filter. The first 50 owner-authorized campgrounds are in scope, with a visible warning if more exist.
- A downloadable CSV requires an explicit source/target pair, a written owner acceptance note, a source evidence reference and affirmative internal-use acknowledgement. The server re-runs the filters in a repeatable-read transaction. Zero matching rows or more than 50 matches refuse export; never silently issue a partial file.
- Only resolution/plan identifiers, campground identifiers, UTC timestamps, statuses and source evidence references are in the CSV. No applicant records, financial terms, source documents or free-text notes. CSV fields are quoted and spreadsheet-formula escaped.
- Every successful file generation is tied to an append-only acceptance receipt, whose SHA-256 digest matches the emitted UTF-8 CSV bytes. Recent receipt summaries appear for the selected pair.

## Security, database and operational boundaries

- Migration `0136_owner_resolution_evidence_exports.sql` introduces a private owner-accepted export receipt ledger with forced RLS and `icamp_app` SELECT/INSERT only. All public/client grants are explicitly revoked and an immutable trigger prevents alteration/removal.
- Application and RLS enforce a current `owner_admin` assignment and `permanent_unit.transfer` permission **separately on both campgrounds**. The query itself reads existing forced-RLS ledgers; it never falls back to privileged bypass. The write stores the authenticated actor ID and database policy checks the same session claim.
- Export HTTP requests are session-backed POSTs with a same-origin check, bounded input validation and non-cacheable, attachment-only responses. Forged hidden fields cannot expand authorization.
- No lending decisions, applicant movement, pricing, transfers, exception/hold changes, communications, workflow task creation or background export delivery.

## Production verification

1. `npm run verify` runs formatting, lint, types, Node tests and the Next.js production build. Build 105 tests cover filters, CSV injection, bounded export and SQL/UI access controls.
2. Feature checks (including database migration verification, browser tests, static analysis and secret scanning) must succeed before merging to `dev`.
3. Migration `0136` applies to the hosted iCamp Supabase project **only after** feature migration checks are green; verify table/grants/forced RLS and run security advisers.
4. A promotion PR from `dev` to protected `main` must pass all gates, merge and show successful final commit checks. Do not conflate GitHub production-branch checks with independent live hosting verification.

Next queued: **Build 106 — Owner Export Receipt Reconciliation & Evidence Retention Controls**.
