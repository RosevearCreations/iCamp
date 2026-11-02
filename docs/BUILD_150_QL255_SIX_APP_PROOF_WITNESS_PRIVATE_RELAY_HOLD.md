# iCamp Build 150 — QL-255 six-app immutable proof disposition, private witness escalation & reversible TEST readiness (HELD)

The supplied **QL-254 six-app original proof/witness/private relay** handoff is an action request, **not** approval to connect applications. The Comms Hub's public-only snapshot at **2026-10-29T03:42:01Z** found the exact `docs/integration/ql246-source-proof.json` path HTTP **404 for all six** original source repos:

| Source | Immutable `main` observed in QL-254 handoff | Actual proof |
| --- | --- | --- |
| AI Data Platform | `9e570d82707fd476b43458fa869776bac9ddc65f` | 404 |
| Devil n Dove | `ae145e67d526119a90612e8e4151dc84416d1446` | 404 |
| Rosie Dazzlers | `056de275482a3b4a00e17610f634b1b79f3490c0` | 404 |
| Yard Workers | `37cac7dc25caa153088f0b58a76df98b23539730` | 404 |
| iCamp | `19db62c90a12bf48da74e4e063fb16c3b6f6c1ce` | 404 |
| Rosevear AI Hub | `d2cab6dfa98be39c8dd2775a020fe8c644768ceb` | 404 |

These are **historical immutable findings**, not an assertion that later `main` commits remain 404. Recheck every latest branch and immutable SHA to update them.

### Independent Build 150 public recheck — 29 October 2026 (Eastern)

We independently retrieved each current public GitHub `main` full SHA and then the exact immutable signed-proof path at that commit. These are actual returned results, not synthetic fixture outcomes:

| Repository | Newly observed immutable main SHA | Exact original proof path |
| --- | --- | --- |
| `ai-data-platform` | `c658bce8c207dcbfdf6c9afa5f304428dd3e31d3` | HTTP 404 |
| `devilndove-site` | `5017939f3b63e3f63d79a83f34357956cbafd0b4` | HTTP 404 |
| `rosiedazzlers` | `79751649527a3b4a887ce252f8a1c5b93a9434bd` | HTTP 404 |
| `yw` | `2c7b07037beb1b0ac239eb1b994cb6a87fd1923e` | HTTP 404 |
| `iCamp` | `19db62c90a12bf48da74e4e063fb16c3b6f6c1ce` | HTTP 404 |
| `rosevear-ai-hub` | `9cac2ebcb386bec7dfcf2379acb0998c531c6aa1` | HTTP 404 |

Do not reuse these responses as proof of a newer unqueried commit. All six signed source-proof publication blockers remain open at this check.

## Recheck safely

The default is **fully offline**, no public or private GETs:

```sh
npm run audit:ql255-six-app-proof
```

Only explicit opt-in requests current public GitHub main metadata and its immutable source-proof path for each of six allowlisted repositories:

```sh
npm run audit:ql255-six-app-proof -- --public-get
```

The report preserves observed HTTP `404`, `200` or `NOT_AVAILABLE`; a network outage is never silently relabeled 404. A 200 returns the actual raw SHA-256, but is **UNTRUSTED** until legitimate original A CI, distinct B ancestry, Ed25519 verification and independently authenticated separate private signer/witness custody are established. A public GitHub login is not service authentication. This command cannot contact any integration gateway, home server, customer application or authentication endpoint.

For iCamp, the original known tested source **A** is `5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9` and original source [CI run 40794126949](https://github.com/RosevearCreations/iCamp/actions/runs/40794126949). Its signed source-proof **B remains NOT_AVAILABLE**: neither ordinary CI success nor Build 150 creates a signed proof envelope. No signature, private registry or seven original denial receipts are fabricated.

## Persistent owner-only QL-255 HOLD reviews

Migration `0180` adds an append-only, forced-RLS, owner-only ledger, anchored to an independent Build 149 private-owner HOLD root for the same two campgrounds and source repository. Follow-up migration `0181` rejects even an unverified private witness claim unless the preceding source review has a real 200 public proof A/CI/B candidate and the nonce is currently valid within five minutes. Three stages must be recorded by separate independent reviewers:

1. **Six-app original immutable proof disposition:** exact observed main SHA and honest HTTP status, optional genuine original A/CI pair, and an actual B/raw digest only for an independently published 200 candidate (still UNTRUSTED).
2. **Independent private witness and custody escalation:** either mark genuine originals absent, or record three distinct nonsecret `np-` receipt references, an original private registry snapshot SHA-256, distinct public signer and witness SPKI digests, and a nonce **digest** with maximum five-minute UTC challenge. No raw private registry, witness identity, signing key or nonce enters code or GitHub. A self-reported receipt is not independent verification.
3. **Reversible private relay TEST-readiness:** `NOT_CONFIGURED`, `OUTBOUND_PLAN_ONLY` or `SYNTHETIC_ROLLBACK_REHEARSED` only, with a nonsecret plan index and **proposed** 30–300-second health interval. A private owner TEST-only request is limited to one named nonproduction tenant, future UTC window of at most 30 minutes, `GET` and exactly `/api/integration/v1/health` and `/api/integration/v1/capabilities`. It is a REQUEST, not authorization.

`simulateQl255RelayRollback()` runs purely in memory (`PLAN → SIMULATE_START → KILL_SWITCH → ROLLBACK`). It does **not** install a Windows service, connect Tailscale, change firewalls, bind a listener, start a daemon, use secrets or access the home's vault, cameras, devices or Home Assistant. There is no real GET, owner TEST permission, pilot approval or dispatch. All persisted flags remain `false`, `actual_gateway_test=NOT_RUN`, `connection_state=DISCONNECTED`, `gate_state=HOLD`. The private Rosevear AI Hub PC is only a future architecture candidate pending independently verified owner and host approvals.

## Safe Comms Hub response

```yaml
application_name: iCamp
repository: RosevearCreations/iCamp
observed_main_sha_at_ql254: 19db62c90a12bf48da74e4e063fb16c3b6f6c1ce
source_sha_A: 5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9
matching_source_green_ci_run_url: https://github.com/RosevearCreations/iCamp/actions/runs/40794126949
proof_commit_sha_B: NOT_AVAILABLE
immutable_proof_url_at_ql254: HTTP 404
proof_http_status_at_B: NOT_AVAILABLE
exact_raw_proof_sha256: NOT_AVAILABLE
public_signer_spki_sha256: NOT_AVAILABLE
private_registry_snapshot_sha256: NOT_AVAILABLE
independent_registry_custody_receipt_id: NOT_AVAILABLE
separate_witness_receipt_id: NOT_AVAILABLE
independent_witness_real_world_identity_verified: NO
owner_test_decision: NOT_GIVEN
actual_nonproduction_gateway_gets: NOT_RUN
real_original_seven_denial_cases: NOT_VERIFIED
connection_state: DISCONNECTED
```

Publish no secret or fictitious original evidence. Application release GREEN and integration connectivity are separate decisions. Build 149's GitHub `dev/main` had reached GREEN, but its Vercel production deployment was quota-blocked at its last independent check; Build 150 must verify its own production SHA before any Production GREEN claim.

**Next queued:** Build 151 — QL-256 Authentic Six-App Proof Publication Recheck, Separate Witness-Origin Exception Closure & Owner-Scoped Mini-Server TEST Safety Gate (HELD).
