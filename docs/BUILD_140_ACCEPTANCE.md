# Build 140 — Independent Owner Proof Reconciliation Recurrence Renewal, Aged Exception Disposition & Cross-System Read-Only Gate Review

## Owner-proof continuation and exception integrity

- Build 140 starts from a real same-campground-pair Build 139 `owner_audit_proof_reconciliation` receipt and preserves Build 138 provenance. A positive review requires the Build 139 owner proof to have been independently verified.
- The append-only owner-only sequence is **independent owner proof recurrence renewal → aged exception disposition → cross-system read-only gate review → independent renewal again**. Reviewers must differ from prior owner proof authors and the immediately preceding reviewer.
- A positive renewal must identify a **newer**, independently authored same-root verified source event. The database snapshots proof age, elapsed time, earlier overdue days, later owner reopenings, unresolved peer recurrences and owner dispositions, open Build 139 exceptions and overdue leaf reviews. False positives are rejected if proof is older than 30 days, a prior source is 30 days overdue, or unresolved anomalies exist.
- `aged_exception_reconciled` requires a prior positive renewal and timely follow-up. `aged_exception_overdue` requires actual observed overdue evidence, not an operator's unsupported claim. All stages schedule a fresh independent review within 90 days.
- Every receipt is immutable, tenant-pair-scoped and protected by forced RLS. Only authorized finance owners of **both** campgrounds can read or insert records.

## QL-243 cross-system read-only gate — unconditional HOLD

- The gate review can record non-secret **reference IDs** for a health receipt, capabilities receipt, durable gateway audit receipt and independently witnessed owner attestation. The complete documentary state remains `gateway_documented_hold` and **does not prove signatures, ownership or external connectivity**. Without these references, choose `gateway_evidence_missing` or `gateway_review_escalated`; never fabricate IDs.
- Database checks and a guard force `gate_state = HOLD`, `owner_pilot_authorized = false` and `dispatch_enabled = false` on **every** record. No API keys, tokens, private signatures or cross-company databases are stored in this audit. Receipt IDs must be independently verified via the QL-243 trusted out-of-band process before anyone discusses a pilot; storing IDs in this owner screen is not authorization.
- The iCamp production gateway remains **DISCONNECTED / HOLD**. The only existing readiness routes are server-only nonproduction GET `/api/integration/v1/health` and `/capabilities`, with empty capabilities. No live customer, reservation, gate, payment, messaging, Etsy, employer/payroll or device command is enabled.
- AI Data Platform remains the sole gateway. iCamp does not create or claim independent gateway Ed25519 receipts, a verified owner witness, a completed Comms Hub four-GET run or external connectivity.

## Release gates

- Clean PostgreSQL migration `0170_owner_proof_recurrence_renewal_aged_exception_gateway_hold.sql` and matching verification, including replay/idempotence, forced RLS and append-only checks.
- Node automated tests, TypeScript, ESLint, Prettier, optimized production build, browser end-to-end tests, CodeQL, Secret Scan and hosted database/security verification.
- Feature PR → `dev`, release PR → `main`, fast-forward `dev`, verify final CI, CodeQL and Secret Scan workflows on both branches.

**Next expected:** Build 141 — Independent Gateway HOLD Evidence Freshness Review, Aged Exception Recurrence Watch & Owner-Safe Receipt Verification Queue.
