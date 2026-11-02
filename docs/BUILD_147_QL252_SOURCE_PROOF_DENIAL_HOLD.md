# iCamp Build 147 — QL-252 source-proof publication blocker and independent HOLD continuity

Build 147 implements the QL-252 action sheet as an honest, fail-closed source-proof audit and an owner-scoped three-stage evidence-renewal chain. **It does not publish a signed QL-246 JSON because no authenticated source signing custodian/key, short-lived operator challenge, separately trusted public pin, approved nonproduction campground tenant, original seven gateway denial receipts, or owner TEST-only authorization was supplied.** Inventing any of those would undermine the exact proof that Comms Hub is requesting.

## Actual iCamp public-source return, 28 October 2026 (Eastern)

```yaml
application_name: iCamp
repository: RosevearCreations/iCamp
source_sha_A: 5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9
source_ci_run_url: https://github.com/RosevearCreations/iCamp/actions/runs/40794126949
proof_commit_sha_B: NOT_AVAILABLE
immutable_public_proof_url: NOT_AVAILABLE
exact_proof_bytes_sha256: NOT_AVAILABLE
public_spki_sha256: NOT_AVAILABLE
out_of_band_custody_receipt_id: NOT_AVAILABLE
distinct_witness_receipt_id: NOT_AVAILABLE
owner_test_decision: NOT_GIVEN
owner_test_receipt_id: NOT_AVAILABLE
actual_gateway_test: NOT_RUN
connection_state: DISCONNECTED
```

At immutable SHA `5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9`, a separate public GitHub fetch of `docs/integration/ql246-source-proof.json` actually returned **404**. The matching GitHub Actions CI was **successful** for that exact source commit, but CI success never means that a signed source proof was published. B and public proof byte digest remain `NOT_AVAILABLE`. This is the actual outcome, not a sample signed acceptance packet.

## Source-proof preflight, with no private gateway requests

`npm run audit:ql252-public-proof` defaults to `NOT_AVAILABLE` with **no network**. With the explicit flag below, it fetches only public GitHub metadata and raw file bytes at the immutable source A; it never fetches iCamp, Comms Hub or AI Data Platform integration endpoints:

```sh
npm run audit:ql252-public-proof -- --public-get --source-sha-A 5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9 --source-ci-run-url https://github.com/RosevearCreations/iCamp/actions/runs/40794126949
```

Once a real custodian privately signs a genuine canonical Ed25519 envelope, publish **only** the public JSON at exact path `docs/integration/ql246-source-proof.json` in a new descendant **proof commit B**. Run the same preflight with `--proof-commit-sha-B <full_B_sha>`: the tool checks original source A CI, exact raw B bytes, Ed25519 signature, and public GitHub A→B ancestry. Even a valid public signature remains `CUSTODY_UNVERIFIED_HOLD` without independent authenticated pin custody, QL-250/251 challenges and a real owner decision. Never publish a private signing key, private challenge, token, raw owner identity, tenant secrets, customer data or hidden gateway URL.

The QL-246 negative test flags in the signed payload are claims/configuration metadata unless genuine independent original receipts separately exist. Seven `true` flags or a locally generated fixture are not an acceptable substitute for real denied gateway requests.

## Owner QL-252 review chain

1. **Public proof continuity:** immutable public 404, untrusted public B/A candidate, or source CI/origin exception. A/CI and B/digest must be distinct and repository-scoped; no invented B on 404.
2. **Seven-denial aging renewal:** record honestly missing originals, seven unique indexed but **unwitnessed** originals with separate audit reference, or an actual mismatch. The database independently tracks 7 minus indexed original receipts, gap age, due-date overruns, open Build 146 exceptions and overdue Build 146 leaves.
3. **Independent owner TEST authorization HOLD review:** record `NOT_GIVEN`, private request, or **unverified** receipt claim. No private decision is accepted merely because it is named. Another authenticated owner decision must separately authorize precisely scoped nonproduction tenant, GET-only two paths and a future window not exceeding 30 minutes. **This build never schedules or runs a gateway request.**

Every row is append-only, FORCE RLS with dual-campground finance-owner checks, exact six-app repository binding, separate reviewer continuity and bounded 90-day follow-up. All `original_proof_signature_verified`, `independent_source_ci_verified`, `proof_ancestry_verified`, `independent_custody_pin_verified`, `seven_denials_independently_witnessed`, `owner_test_authorized`, `owner_pilot_authorized`, `dispatch_enabled` remain `false`; `actual_gateway_test=NOT_RUN`, `connection_state=DISCONNECTED`, `gate_state=HOLD`.

## Verification and release

- PostgreSQL migration `0177_ql252_public_proof_denial_hold_audit.sql`; read-only verification contract with forced RLS and immutable append-only trigger.
- Offline Node.js tests exercise the 404, the synthetic Ed25519 path, exact A/CI and ancestry, reviewer stage boundaries, and the refusal to invent proof/receipts. Synthetic keys are test-only and not committed or used for public evidence.
- `npm run verify` and the protected `dev`→`main` CI/secret/CodeQL/browser gates prove the software release only.
- Vercel deployment readiness and separate PostgreSQL environment setup never grant a live six-app connection.

**Next queued:** Build 148 — QL-253 Immutable Proof Publication Retest, Independent Custody-Pin Challenge Renewal & Owner TEST-Only Authorization HOLD Reconciliation.
