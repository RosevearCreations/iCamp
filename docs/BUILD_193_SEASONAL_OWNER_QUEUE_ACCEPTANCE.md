# iCamp Build 193 — Seasonal Renewal, Winterization & Spring-Reopening Owner Queue

## Goal and source of truth

The staff-only `/workspaces/management/campgrounds/seasonal/owner-queue` brings active seasonal/yearly assignments, current-year winterization reviewer decisions, spring inspection decisions for the **latest recorded winter closure**, unresolved site work orders and append-only renewal interest into a private, campground-scoped dashboard. It is **not** a clearance or transaction screen.

### Delivered

- Append-only, versioned, staff-recorded renewal preferences, source reference, proposed term-end date and immutable evidence; the PostgreSQL trigger locks the canonical assignment and rejects stale row-version/expiry data or skipped versions.
- Campground-specific owner follow-up tasks with due dates and evidence references, and append-only follow-up, reopen and *independent owner acknowledgement* events.
- Strict role rights: `seasonal.owner.read`, `seasonal.owner.record`, and independent `seasonal.owner.review`. Owner acknowledgements from the task creator are denied at database level.
- The owner board shows missing or rejected winterization, spring inspections not linked to the latest winter closure, outstanding maintenance and stale/expired term evidence as unresolved conditions. No queue acknowledgement changes the canonical source evidence.
- No automatic renewals, new seasonal assignment dates, availability release, notifications, payment postings, purchasing, IVR/SMS or gate actions.

### Limits and interpretation

- Staff Web/PWA only, with text-accessible list and existing winterization/reopening source links. Staff-assisted office handoff is the non-Web fallback.
- The list is bounded to 250 active assignments and 250 tasks per campground; older evidence remains in immutable source ledgers.
- Interest is not a guest signature or binding agreement. Proposed terms are not price quotes or executed renewals.
- Owner acknowledgement is administrative only. **Winterization sign-off, spring return-to-service approval and maintenance clearance must be completed in their existing source workboards.**
- Billing and Omnichannel remain HELD / DISCONNECTED.

### Verification

- `database/migrations/0207_build193_seasonal_owner_queue.sql`: private ledger, scoped foreign keys, immutable triggers, independent reviewer and version-stale guards; FORCE RLS.
- `database/verify/0207_build193_seasonal_owner_queue.sql`: private schema and permission contracts.
- `tests/build193-owner-queue.test.mjs`: contract checks for staleness, independent review and safety/communications boundaries.
- Required promotion: PR to dev with CI, PostgreSQL 17, browser E2E, CodeQL and Secret Scan; hosted migration and live advisor review; dev/main exact source SHA; Vercel READY; live version, health, protected route and runtime-error checks.

**Next queued: Build 194 — Role-Aware Operations Dashboard, Saved Layouts & Actionable Drilldowns.**
