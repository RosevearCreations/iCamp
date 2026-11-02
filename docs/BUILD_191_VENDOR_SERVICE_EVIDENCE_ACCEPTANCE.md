# Build 191 — Vendor Service Requests, Contract/SLA & Follow-Up Evidence

Status: implementation in verification. **Do not mark Production GREEN until main/dev CI, hosted migration, Vercel and exact-SHA readbacks all pass.**

## Scope, privacy and workflow

- Authorized staff Web/PWA workboard at `/workspaces/management/campgrounds/vendors` with property selection, vendor filters, private sourcing contact details, contract/SLA summaries, recurring reminders, response/closure timeline and invoice-intake review. The management campground hub and finance workspace link to it. The route is staff-authenticated and `vendor.read`/`vendor.manage`/`vendor.invoice.review` authorized.
- Five append-only, forced-RLS `icamp_private` tables: `vendor_profiles`, `vendor_contracts`, `vendor_recurring_plans`, `vendor_service_requests` and `vendor_service_events`. No app role update/delete grants; no anon/authenticated access. Cross-property composite foreign keys and hard guards restrict every registration, event and link to the authorized campground. The existing private audit ledger records all writes within their transactions.
- Contract evidence includes externally traceable reference, effective/expiry dates, explicit response-hour and completion-day targets, and optional existing active, validated, confidential PDF. Renewal creates a new linked snapshot and marks the prior one superseded in readback; neither signed legal acceptance nor outside engagement is inferred.
- Recurring plans create **internal due-date reminders**, not automatic vendor work orders. A plan can be superseded without deleting history. New service requests may reference a matching current contract, recurring reminder and existing campground maintenance work order. Contract SLA targets are set on the request by a PostgreSQL trigger; ad hoc requests use manager-set targets. The database calculates immutable response and completion deadlines.
- Source-referenced vendor response, completion, and invoice-intake events; other progress/follow-up notes remain explicitly staff-recorded. The board flags overdue response/completion, expiring contracts, due reminders and pending invoice reviews. Finance reviewers independently acknowledge actual intake events, never their own and never twice. An acknowledgement is **not** an invoice approval, payable posting or payment.
- Confidential source attachments must already exist as validated active confidential media in the same campground. Existing media access route continues to enforce authentication and confidential-read permission; the public/guest site receives no vendor contact data or confidential files.

## Acceptance and release gates

1. Formatting, lint, typecheck, unit/static contract tests, application build and browser E2E.
2. PostgreSQL 17 CI: migrations `0203_build191_vendor_service_evidence.sql` and `0204_build191_vendor_fk_indexes.sql`, all database contracts and rollback-only `npm run build191:verify` covering restricted RLS, cross-property links, contract/recurrence mismatch, SLA deadlines, confidential attachment enforcement, evidence retention and independent invoice-intake review. The follow-up indexes fully cover campground-scoped contract and recurring-plan supersession foreign keys. Verify no supplier or payable execution happens.
3. Apply the reviewed migration to the linked iCamp Supabase project only after successful CI database lifecycle. Execute hosted `database/verify/0203...` and compare security/performance advisors against pre-build baseline, with no new WARN regressions.
4. Feature PR into `dev`, successful Verify, DB, Playwright, CodeQL and Secret Scan, and exact-SHA Vercel preview READY. Merge `dev`→`main` after independent dev push and PR gates. Fast-forward dev to main, then verify all six post-merge push checks, exact-SHA READY Vercel production/dev, live `/api/version` and `/api/health/ready`, private route redirect and runtime errors.

## Safety boundary / next queue

All external vendor communications, work authorization, purchase orders, payable execution, billing, Omnichannel, physical access and dispatch remain **HELD / DISCONNECTED**. No request is sent externally by a user recording a draft or evidence. Next planned Build 192: Store Inventory, POS Session & Stock Reconciliation.
