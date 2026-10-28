# Build 136 — Independent Renewal Evidence Freshness Comparison, Reopening Watch Exception Reassessment & Owner Continuity Decision Audit

## Independent evidence and escalation continuity

- Build 136 begins from an existing **owner evidence renewal** in the Build 135 append-only ledger. Pending and escalated renewals remain eligible for reassessment; no positive outcome can be assumed from an unresolved receipt.
- The ordered chain is **independent freshness comparison → independent reopening-watch exception reassessment → owner continuity decision audit**. After an owner decision, another independent freshness comparison can start with newly verified proof; consecutive reviewers must differ.
- Database safeguards compare new source proof with the actual same-root Build 130 follow-up underpinning the Build 135 renewal. `freshness_verified` requires a newer independently verified proof event; the same proof event cannot be reused in a later comparison. Stale or missing proof is a distinct outcome.
- A cleared watch requires a positively verified independent freshness comparison. Owner continuity can be confirmed only after a separate `watch_no_exception` reassessment, with proof no more than 30 days old, zero later owner reopenings and no unresolved peer, owner or recent escalation exceptions.
- PostgreSQL computes due-date aging and exceptions from source records. An overdue review of 30+ days cannot silently be cleared or deferred as ordinary renewal. All open outcomes schedule the next UTC review inside 90 days.
- Append-only records remain protected by forced row-level security, two-campground owner permission and separate reviewer restrictions. No reservation, payment, case, customer record, external message or operational hold changes.

## Rosevear Integration Contract v1

- iCamp remains the source of truth for campgrounds, guests, sites and reservations. AI Data Platform remains the sole proposed Integration Gateway. Its existing signed health/capabilities handshake remains tenant-scoped and default `HOLD` pending explicit approval.
- No cross-business customer data, signed live events, commands, phone/SMS dispatch, external writes or automatic owner approval are enabled by Build 136.

## Acceptance / release gates

- New migration `0166_renewal_freshness_watch_continuity_audit.sql` and matching SQL verification on a fresh PostgreSQL database, including idempotent replay.
- Node tests, formatting, ESLint, TypeScript, optimized production build, workflow parity and Chromium browser end-to-end acceptance.
- Hosted migration verified, security advisors checked, and no fabricated owner records inserted into the production database.
- Feature PR → `dev`; promotion PR → `main`; both synchronized to the release commit only after CI, CodeQL and Secret Scan are GREEN.

**Next expected:** Build 137 — Independent Continuity Decision Recurrence Watch, Renewal Exception Follow-Up Aging & Verified Owner Audit Recheck.
