# Build 196 — Financial Exception Review, Refund Readiness & End-of-Day Close

## Scope and operator entry

`/workspaces/management/command/finance-close` is a restricted staff workbench.
It requires campground `finance.read` or `finance.manage` **and**
`reservation.read` or `reservation.modify` because the existing Build 042/043
payment and receipt RLS grants are reservation-reader scoped. A missing source
permission never becomes a fabricated zero. The Workbench uses the existing
RLS-backed `icamp_app` role and contextual actor, no `service_role` bypass.

## Shipped workflows

- Bounded 100-day snapshot of provider-neutral payment attempts, captured
  payments, original-payment receipts, refund states, and append-only financial
  adjustment evidence; up to 400 records per table with a visible incomplete
  warning if any source truncates.
- Priority workboard: missing/mismatched receipts, missing provider references,
  failed payments/refunds, refund approval/submission states, over-captured
  refund exposure, inaccessible historical payment linkage, and pending
  independent adjustment decisions. Every entry links to the exact
  tenant-scoped reservation financial safeguards screen.
- Per-currency campground-local-day close worksheet (today or preceding 31
  days): captured movement, succeeded refunds, net recorded movement, receipt
  issuance and **separate gross** adjustment evidence. No foreign-exchange
  mixing or inferred settlement balances. It is a printable **review sheet**,
  not a posted end-of-day close.
- Authorized, no-store CSV export carrying campground, source timestamp,
  local day, time zone, explicit truncation marker, worksheet movements and
  exception IDs. `X-ICamp-CSV-SHA256` is a byte-integrity checksum, **not**
  a cryptographic signature or bank attestation. Formula-like strings are
  escaped for spreadsheet use.
- Browser-only provider-neutral CSV paste (`provider,provider_reference,
  currency,captured_cents,refunded_cents`) compares records for the selected
  local day, including success/refund variance, orphan and absent references.
  No file leaves the browser and no provider settlement API is invoked.
- Auditable maker/checker manual adjustment control without new schema: the
  existing append-only `reservation_financial_adjustments` stores zero-effect
  `review_resolution` proposal and independent decision rows, differentiated
  by `evidence.build196.type`. Different actor required for review, one
  decision per proposal via `(campground_id,idempotency_key)` uniqueness,
  independent `finance.manage` permission, audit trail and transaction.
  Manual adjustment posting requires a matching approved proposal and uses a
  proposal-derived unique key to prevent repeat posting. Posting records a
  financial adjustment, **not** a provider charge/refund or bank transaction.

## Important boundaries

- Existing cancellation-forfeit policy and refund approval workflows remain
  available; the direct general adjustment form is replaced by proposal →
  independent decision → explicit posted adjustment. Existing database RLS
  and immutable original payment/receipt evidence are unchanged.
- A succeeded refund is source evidence; an approved refund is **not** a
  succeeded refund. Provider activation and live settlement remain HELD.
- The current provider may be a mock adapter; this workbench cannot certify
  bank deposits, accounting books, cash drawer counts, or a signed close.
- No database migration, provider key, live email/SMS, financial authorization
  or automatic close event is created by this build.

## Acceptance checks

1. Run `node --test tests/build196-finance-close.test.mjs` plus the full CI
   checks. Verify `npm run lint`, `npm run typecheck`, `npm test`, and the
   production build.
2. Browser e2e denies anonymous workbench and CSV requests.
3. Test a finance-only user without reservation read; source is denied rather
   than exposing an incomplete total. Cross-campground access must fail.
4. Maker creates a zero-effect proposal; same user cannot approve/reject.
   Another authorized checker can decide once, and a rejected proposal
   cannot post. Approved exact-kind/amount/currency proposal can post once
   with audit evidence; duplicate submission cannot append another post.
5. Verify `main` GitHub CI, CodeQL, Secret Scan, exact-SHA Vercel READY, live
   `/api/health`, `/api/health/ready`, `/api/version` and runtime errors.

Next logical build: **197 — Guest Privacy Requests, Consent History, Retention & Export**.
