# Build 139 — Independent Continuity Evidence Renewal Recurrence Review, Aging Exception Follow-Up & Owner Audit Proof Reconciliation

## Owner audit continuation

- Beginning with a genuine same-pair Build 138 `continuity_evidence_watch`, the append-only owner-only cycle is independent continuity evidence recurrence review → aging exception follow-up → owner audit proof reconciliation → next independent recurrence review.
- A positive recurrence result requires Build 138 independently verified continuity, fresh underlying proof (30 days or less), and no later reopening, unresolved independent peer recurrence or owner disposition, open renewal exception or overdue renewal watch. All counts and age snapshots are computed in PostgreSQL, not trusted from a form.
- The aging stage cannot claim `current` when its prior review is not stable, its source is overdue, or the source anomalies above are present. `aging_exception_overdue` requires a genuinely observed overdue source. Thirty-day prior overdue evidence cannot be positively closed.
- A reconciled owner audit requires both prior positive stages and a **new, later, independently authored same-root** source event, with its own verified provenance. Missing or stale proof stays an explicit gap or escalation; reuse is prevented by a unique evidence link.
- Campground-pair ownership, reviewer separation, immutable receipts, forced RLS and 90-day repeat scheduling remain mandatory. The build never changes bookings, reservations, gate access, guest data, payments or outbound messaging.

## QL-243 connectivity document review

- iCamp is **not** the gateway. The AI Data Platform is the sole gateway. Only two iCamp server-only, nonproduction endpoints exist: authenticated `GET /api/integration/v1/health` and `/capabilities`. Exact QL-243 12-line canonical HMAC-SHA256 with 256-bit base64 server secret, Unix millisecond timestamp, 32-hex nonce, business `icamp`, and an exact campground tenant are checked. The older Build 134 signature format fails closed.
- Every configured credential is bound to exactly one campground key ID and tenant. Explicit preview/development host, `nonproduction` environment and owner-controlled `ICAMP_INTEGRATION_V1_ENABLED=true` are required; production hosting cannot turn it on. Server output remains `connection_state: HOLD` and `capabilities: []` without customer references or commands.
- Independent private PostgreSQL receipts enforce atomic nonce replay denial; separate sanitized denial receipts log reason/path only, never signatures, guessed tenant IDs or customer records. Unknown key, wrong app/tenant, stale time, method, query and invalid signature fail closed. Current phase does not grant `read_site_reference` or `read_reservation_reference` and has no write route.
- iCamp does **not** manufacture gateway Ed25519 receipts, source revision proof, key registry verification, owner identity witness attestations or a production connection claim. Those require **independent AI Data Platform and Comms Hub** evidence under QL-243. No signing key, real secret or personal identity data is included in the repository.
- The safe release statement is *nonproduction scaffold present; live connection unverified, DISCONNECTED/HOLD*. A separately authenticated owner read-only pilot decision is still missing. Do not launch the four-GET test for Devil n Dove or Comms Hub from iCamp.

## Verification and rollout

- Clean PostgreSQL migration/verification replay for `0169_continuity_evidence_recurrence_owner_reconciliation.sql`, including forced RLS and append-only checks.
- Node tests (Build 139 and QL-243 negatives), typecheck, ESLint, formatting, production build, browser E2E and security scans.
- Apply hosted iCamp schema migration, check Supabase security advisors, promote PR to `dev`, then release PR to `main`, synchronize branches, and verify post-release workflows GREEN.

**Next expected:** Build 140 — Independent Owner Proof Reconciliation Recurrence Renewal, Aged Exception Disposition & Cross-System Read-Only Gate Review.
