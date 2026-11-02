# Build 141 — Independent Gateway HOLD Evidence Freshness Review, Aged Exception Recurrence Watch & Owner-Safe Receipt Verification Queue

## Revised QL-245 handoff interpreted for iCamp

The owner's revised `ROSEVEAR_INTEGRATION_V1_QL245_EVIDENCE_RETURN_HANDOFF` distinguishes implementation/readiness from original independently observed nonproduction gateway exchanges. Neither a green production release nor a fixture is a real HMAC call. The iCamp state therefore remains **DISCONNECTED / HOLD** and **UNVERIFIED**; no app-signing or HMAC keys, trusted Ed25519 pins, nonproduction deployment witness, independent assessor or owner pilot authorization were supplied through this handoff.

- QL-245 only permits separately authorized, server-only **nonproduction** signed `GET /api/integration/v1/health` and `GET /api/integration/v1/capabilities` (scopes `read_health` and `read_capabilities`). QL-243 12-line HMAC, exact campground tenant, atomic nonce/replay denial and fail-closed audit remain the gate. iCamp did **not** enable any new remote GET or registry provision, dispatch, public customer/guest/booking/payroll/payment/media access or write.
- The append-only owner workflow now follows **Build 140 documentary read-only gate → independent HOLD freshness review → database-observed exception recurrence watch → individual nonsecret QL-245 receipt verification queue**. Receipt queue entries can be appended repeatedly or a new freshness cycle can be started with a different independent reviewer. No review record upgrades documentary references into verified signatures, trust pins or owner approvals.
- The queue covers the exact iCamp source SHA/green CI Actions URL, nonproduction registry, separately sourced public signer pin, source health/capabilities, gateway audit, signed source return, **seven distinct** denial traces (nonce replay, stale request, wrong business, wrong tenant, revoked key, prohibited write and prohibited dispatch), independent assessor and independent witness. Enter one nonsecret `np-...` reference per record, or explicitly choose `receipt_missing` / `receipt_not_provisioned`. The SHA and Actions URL are syntax-checked but *never* independently verified by entering them.
- The server snapshots Build 140 gate age, proof age, elapsed due date, unresolved negative outcomes, overdue leaf reviews and newer gate receipts. Positive **no-new-exception-observed** requires zero detected unresolved, overdue or newer gate conditions; **recurrence detected** requires actual database observations. All owner reviews are independent of the source Build 140 gate and the immediately prior reviewer, scoped to authorized finance owners of *both* campgrounds, and due within 90 days.
- The database forces `receipt_proof_state = UNVERIFIED`, `connection_state = DISCONNECTED`, `gate_state = HOLD`, `owner_pilot_authorized = false`, `dispatch_enabled = false`. RLS is forced and only `icamp_app` with both campground finance-owner grants may SELECT/INSERT; UPDATE/DELETE are denied by permissions and an append-only trigger. No credential material, customer data, HMAC signatures, signed packets or trust PIN registry is stored in this ledger.

## Truthful iCamp response to QL-245

| Required evidence | Build 141 status |
| --- | --- |
| iCamp source revision / CI | Exact SHA and final GREEN Actions link available after promotion; not a nonproduction gateway receipt |
| Nonproduction tenant | Real issued separately trusted tenant ID **NOT PROVISIONED** in this handoff |
| HMAC key ID / registry proof | **NOT PROVISIONED**; no private secret to share |
| Source health/capabilities and gateway original signed receipts | **UNVERIFIED / NOT PROVIDED** |
| Seven witnessed denial tests with original audit traces | **UNVERIFIED / NOT PROVIDED**; unit tests do not count |
| Separate Ed25519 source signer and externally authenticated SPKI SHA-256 pin | **NOT PROVISIONED** |
| QL-245 assessor, independently witnessed source originals, restart/storage proof | **UNVERIFIED / NOT PROVIDED** |
| Owner identity challenge and scope-specific nonproduction pilot authorization | **NOT GIVEN** |
| Independently witnessed kill switch/rollback | **NOT VERIFIED** |
| Actual cross-system connection | **DISCONNECTED / HOLD** |

The source's existing health/capabilities handlers are **off by default** and only support nonproduction signed GET once separately approved secret-manager provisioning is in place. The new Build 141 owner queue neither makes source requests nor issues signed returns. To return a valid QL-245 packet later, independently obtain real source/gateway receipts and the seven distinct Ed25519 pins via trusted channels, verify genuine CI and deployed revision, and independently witness/retrieve nonproduction originals. No actual connection or owner pilot is authorized now.

## Release gates

Migration `0171_gateway_hold_freshness_exception_receipt_queue.sql` and matching verification; Node Build 141 tests, TypeScript, ESLint, Prettier, Next production build, browser E2E, CI clean PostgreSQL replay, CodeQL and Secret Scan; hosted Supabase migration and security check; feature PR to `dev`, release PR to `main`, `dev` fast-forward and six final push checks GREEN on one exact release SHA.

**Next expected:** Build 142 — Independent QL-245 Receipt Source Comparison, Trusted Pin Provenance Follow-Up & Gateway HOLD Recurrence Escalation.
