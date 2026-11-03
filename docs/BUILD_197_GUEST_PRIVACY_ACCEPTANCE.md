# Build 197 — Guest Privacy Requests, Consent History, Retention & Export

## Live interface

- Guest: `/guest/privacy` linked from Account; campground scope derives only from an account-linked reservation or saved profile.
- Authorized campground staff: `/workspaces/management/campgrounds/privacy` with `guest.manage` permission, plus Operations Command navigation.
- Guest-only JSON attachment: `/api/guest/privacy/export?campground=<uuid>`; no-store, `nosniff`, `Vary: Cookie` and byte SHA-256 integrity header (not a signature). Every successful generation also writes the digest and incomplete flag to the append-only audit ledger before returning the attachment.

## Authoritative boundaries

- Build 197 adds two append-only `icamp_private` tables, guest privacy requests and review events, with FORCE RLS, actor/campground policies, immutable triggers and guarded transitions. Migration 0212 adds a stable invoker actor helper to avoid per-row actor-setting re-evaluation. No contact details or guest-provided free-text narratives are stored in these request tables.
- Guests submit one of five categories (`access`, `correction`, `retention_review`, `erasure_review`, `consent_question`) against one of four subjects. Duplicate same-kind/same-subject submissions inside 24 hours are rejected. Staff only append controlled review states and source-ticket identifiers, never overwrite history.
- The current guest profile privacy switches remain authoritative in `public.guest_profiles`; consent timeline reads past profile privacy events and only **account-owned** messaging endpoints. It omits endpoint values, raw evidence refs, message bodies and unrelated contacts. Consent is **not** inferred from a mere contact preference change.
- Own export includes saved profile/contact details, related saved RV/vehicle/pet data, latest 100 account-owned stays **including historical completed/cancelled stays**, latest 100 receipts, seasonal associations, privacy status and sanitized consent timeline. If any source hits its 100-row cap, `coverage.incomplete=true`; this does **not** represent a complete statutory data-access response. Other categories (images, communication bodies, financing, external stores) require a manual verified access request.
- No automatic erasure, archive purge, retention clock, marketing re-consent, payment/financial mutation, outbound message or external provider action. Review states such as "retention hold review" and "manual action required" do **not** certify a legal hold, erasure, actual disclosure or legal-compliance completion.
- Before any real erasure/export outside the signed-in guest flow, a qualified operator must verify requester identity/authority, tenant scope, applicable legal/document retention requirements, outstanding payments/safety dependencies, external copies and an approved disposition. The application intentionally leaves these external actions manual.

## Acceptance gates

1. Run the complete `npm run verify` and CI browser, migration and security scans.
2. Migrate from schema version 0210 through 0212; run both Build197 SQL verifiers; prove `anon`/`authenticated` cannot read private request tables and `icamp_app` is tenant and actor restricted, with no new performance advisor actor-initplan warnings.
3. Verify guest with only a completed stay can submit a request but cannot read any other guest's requests or export; staff without `guest.manage` cannot see/review; cross-campground ID fails.
4. Confirm duplicate submissions are rejected, request/event tables are immutable, terminal decisions prevent further events and unsupported review categories/source ticket formats fail.
5. Confirm historical stays/receipts remain scoped by guest ID, source counts expose truncation, export responses are no-store, and anonymous requests return `401`.
6. Promote reviewed `dev` to `main` only after all required checks pass, exact-SHA Vercel production READY, live health/version/authorization smoke and error scan. Retention and erasure operations remain **manual**.

Next logical build: **198 — Backup/Restore Drills, Performance Budgets & Incident Runbooks**.
