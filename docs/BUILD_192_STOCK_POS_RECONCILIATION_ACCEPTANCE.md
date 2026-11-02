# iCamp Build 192 — Store Inventory, POS Session & Stock Reconciliation

## Release scope

Build 192 extends the real Build 183 catalog and staff-owned `inventory.*` permission model. The staff Web/PWA route `/workspaces/management/campgrounds/store/operations` is private and requires a campground assignment. The page uses Standard Theme shell, labelled inputs, keyboard focus, mobile reflow, empty/error states, source references and no guest/API exposure.

- A staff manager explicitly creates physical locations. Prior Build 183 **staff-reported catalog stock is not silently converted** to transactional sellable stock.
- Each product/location balance starts with a source-backed opening count or receipt. The private append-only stock ledger holds receipts, paired internal transfers, damage, returns, opening counts, internal POS stock issues and reviewer-approved count adjustments. Each row holds actor, source, reason, timestamp and before/after balance.
- PostgreSQL advisory locks serialize by product/campground, optimistic row versions detect stale forms, stock updates and movement receipts commit atomically, and negative stock is rejected. Transfer writes two immutable balanced entries in one transaction.
- POS registers have one live session per campground/register code. Manually observed opening/closing cash, stock-issue **expected** cents, close note, revision and an independent closing disposition produce an auditable till variance. This never contacts Stripe, cash/card processors or financial settlement.
- Physical count source snapshots read the current locked balance and preserve the expected quantity/revision. A different inventory auditor accepts or rejects the count. Accepted changed counts create a permanent ledger adjustment; stale count evidence is rejected for recount.
- Owner-set reorder points and targets yield internal-only suggestions, never purchase orders or supplier communication.

## Access and financial limits

`inventory.manage` enables location, stock, count and register operations. `inventory.read` enables scoped readback. New `inventory.audit` enables independent count and close review, with same-actor review denied by PostgreSQL. All eight private tables FORCE RLS. The `icamp_app` role cannot directly insert/update stock balances, ledger events or independent count reviews. Private database functions are revoked from PUBLIC and require authenticated campground permission. Cross-organization/product/location references are guarded by composite foreign keys.

**Billing / payments / Omnichannel / purchases / dispatch: HELD / DISCONNECTED.** Register prices are staff-entered unsettled expected amounts and do not constitute payment completion or invoicing. Guest cart drafts remain planning only; no allocation, order or outbound notifications. No external integrations were activated.

## Test and promotion gates

1. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and production Next.js build pass.
2. Apply all migrations locally; `npm run db:verify` and `npm run build192:verify` pass. The Build 192 lifecycle runs fully inside a rollback transaction: role isolation, stale versions, idempotency, negative inventory, paired transfers, immutable receipts, staff/independent count review, single-register close, unresolved till variances and scope escape.
3. Browser end-to-end checks unauthenticated redirect for the stock/finance workboard. Protected staff page is Web/PWA only; IVR/DTMF/SMS/MMS are marked unsupported while Omnichannel HELD.
4. Hosted Supabase migrations plus static verification and advisor review report no new permission/RLS warnings. A code diff and migration history are retained.
5. Feature PR into `dev`: CI/database/browser, CodeQL and Secret Scan pass; Vercel preview is READY at exact feature SHA.
6. `dev` push, promotion PR into `main` and post-merge six independent CI/CodeQL/Secret Scan push workflows pass at the identical SHA; both Vercel branches READY. Production version and health endpoints report that SHA/ready, protected inventory workboard redirects unsigned users, and runtime error scan is clean before `main` is called GREEN.

## Successor

**Build 193 — Seasonal Renewal, Winterization & Spring-Reopening Owner Queue.** Its implementation remains planned until separately authorized; Build 192 does not activate renewal billing or outbound notices.
