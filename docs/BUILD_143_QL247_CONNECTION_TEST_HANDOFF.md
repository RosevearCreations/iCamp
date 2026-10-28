# iCamp Build 143 — QL-247 / QL-246 Independent Source-Proof and Pin Challenge HOLD Handoff

## Current truth

Build 143 adds an append-only, owner-only review workflow to log **six separate applications' source-proof exceptions**, source revision/CI provenance, publicly shareable signer SPKI SHA256 comparisons, optional *nonsecret* one-time challenge identifiers/digests, and an independent six-app gateway **HOLD decision**. Everything remains disconnected. This is not a working integration test, not a claim that an external signer pin has been independently established, and not an instruction to provision live HMAC secrets.

The source handoff is `ROSEVEAR_QL247_SIX_APP_CONNECTION_TEST_HANDOFF` and the strict QL-246 canonical envelope contract. The Build 142 offline Ed25519 verifier remains available for genuine owner-supplied public proof, but **a locally generated fixture is not acceptance evidence**.

| QL-247 handoff field | iCamp source return |
| --- | --- |
| Application / GitHub repository | `icamp` / `RosevearCreations/iCamp` |
| Source SHA and matching GREEN CI run | Report from **this release's actual main** after final promotion, not a pre-release guess |
| QL-246 `docs/integration/ql246-source-proof.json` | **MISSING / BLOCKED** — no original operator-generated, signer-backed packet supplied |
| Public JSON digest / signer ID / independently sourced SPKI pin | **NOT PROVISIONED / UNVERIFIED** |
| Business and tenant | `icamp`; genuine campground-specific `np-...` tenant has **NOT** been confirmed |
| Scope | Readiness only for `GET /api/integration/v1/health` and `GET /api/integration/v1/capabilities` when separately authorized in nonproduction |
| Registered HMAC key ID, rotation receipt, private runner | **NOT PROVISIONED / UNVERIFIED** |
| Real authenticated GET health/capabilities receipt | **UNVERIFIED** — no original source receipt supplied |
| Seven real independently witnessed denials | **UNVERIFIED** — no actual witnessed tests supplied |
| Durable audit, separate signer pin and rollback/revocation | **UNVERIFIED** |
| Nonproduction test authorization | **NOT GIVEN** |
| Separate real owner read-only pilot approval | **NOT GIVEN** |
| Actual connection | **DISCONNECTED / HOLD** |

## Three separate phases

1. **Phase A — Public source preparation:** independently capture the exact current `main` SHA and CI run, separately sourced Ed25519 public-key pin (never the private key), source metadata and actual receipt availability. Record missing/blocked proof truthfully. A signed QL-246 final envelope must **not** be fabricated because its seven positive denial values require actual later nonproduction observations.
2. **Phase B — Controlled nonproduction test (not authorized by this build):** a real owner approves precise origin, tenant, two GET routes, expiry, reviewer and rollback; approved secrets stay in each server's secret manager. An independent witness observes signed HTTPS GETs, seven denials, durable audit after restart, public signing-key pin, key rotation and emergency kill-switch. Only actual nonsecret `np-...` receipts may be returned.
3. **Phase C — New owner pilot decision:** only after independently attested Phase A and B evidence and a fresh final QL-246 envelope can an authenticated owner consider an additional, time-limited reversible read-only pilot. No booking, gate/visitor, payment, merchandise, payroll, camera/device, voice/SMS or dispatch action follows from this build.

The previous QL-246 instruction to embed in the signed JSON the Git SHA of the commit **containing itself** remains self-referential. The gateway operator must explicitly approve two separate immutable refs: the tested source revision and the subsequent signed-proof publication revision, with an independently sourced public proof SHA256 digest.

## Release acceptance

- 180+ automated tests, TypeScript, ESLint, formatter, and Next.js production build GREEN.
- Database migration 0173 clean, replayable and verified; app-only owner RLS; immutable reviews; never sets phase B, owner pilot or external gateway verification true.
- GitHub secret scan and CodeQL GREEN for feature PR, release PR, and both `dev`/`main` final commits.
- Supabase security advisor clean and no invented independent proof or live payload rows.

**Next expected:** Build 144 — QL-247 Nonproduction Test Authorization Evidence Intake, Independent Seven-Denial Receipt Reconciliation & Reversible HOLD Decision Watch.
