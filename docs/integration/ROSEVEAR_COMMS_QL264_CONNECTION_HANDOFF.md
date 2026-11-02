# iCamp — Rosevear Comms Hub QL-264 source connection handoff

**Coordinator:** [Rosevear Comms Hub](https://github.com/RosevearCreations/rosevear-comms-hub) · **Source:** `RosevearCreations/iCamp` · **Status:** `DISCONNECTED / HOLD`.

This is an owner-requested, source-repository-local implementation guide. Its publication is **documentation only**: it does not install a gateway, create signing keys, allocate a test tenant, grant TEST authorization, enable communications, or prove the application is connected. The seven-app architecture is **one Comms Hub coordinator plus six source applications**, with AI Data Platform as the proposed gateway. No direct source-to-source access is approved. Ordinary source-app software builds may go GREEN while all integration gates remain HELD.

## Source-specific work to implement and verify

1. Establish a dedicated nonproduction campground in a truly isolated test project/database; sample Camp Rosevear in production is not isolation evidence.
2. Use synthetic camper/owner sessions and proper safe credential onboarding; do not reuse passwords that were posted in earlier conversations.
3. Scope the future test principal to nonproduction GET /health and GET /capabilities only; prohibit real campsite bookings, guest records, DTMF/gate controls, SMS, payments, access badges and dispatch.
4. Independently review source signer, distinct custodian/witness/reviewer, persistent restricted host and original signed source A→proof B.

**Known blocker:** No independently authenticated nonproduction campground/tenant proof or private custody evidence received.

## Genuine original signer and source-proof A → B

1. In an approved **private, separately authenticated** process, independently appoint/verify the real signing-key custodian, a *different* nonce witness and independent reviewer. Approve persistent restricted signer storage, determine real signer existence and verify the actual *public* Ed25519 SPKI fingerprint through a trusted second channel. None of those steps can be achieved by committing this guide.
2. Audit an immutable source commit **A** and its exact-SHA successful CI. Only after real private source-signing authority exists, publish the authentic, cryptographically signed original `docs/integration/ql246-source-proof.json` in a **later** immutable commit **B**, binding A and the authentic public signer. Have the independent reviewer verify actual signature, independently pinned key, A→B ancestry and exact-commit CI. **Do not create placeholder proof B, generated demo signatures, synthetic keys or fake approval receipts.**
3. Public GitHub source observation *before this QL-264 document*: `main` `040faeeb064c162fc97c059c9a271983b7f1f6bf`, original `docs/integration/ql246-source-proof.json` returned **HTTP 404** at that immutable SHA on 29 October 2026 Eastern. Re-query at each newer final main SHA; 200 proves publication only, not signature authenticity.

## Nonproduction test contract (proposed, NOT authorized)

- Contract: separate **nonproduction** origin/tenant and scoped server-only identity; strictly `GET /health` and `GET /capabilities`, with the approved minimum safe metadata only. Fail closed on absent authentication and wrong app, audience, tenant or SPKI pin. No personal data or production API reads.
- **Draft upper bound per app:** 15 minutes, **nine GETs total** — two allowed read-only responses and seven required *denials*: missing authentication, invalid credential, expired credential, wrong tenant, wrong app audience, replayed nonce, mismatched independently established public pin. This is a future plan only; never launch a network test from a document or CI.
- Separate approvals required first: actual private source proof, externally verified nonproduction isolation, exact scoped route and identity, independently reviewed controls, owner **TEST-only** signed/privately authenticated permission, start/stop/rollback procedure and restricted evidence custody.
- Explicitly prohibited: production/customer/admin reads, writes, calls, SMS, dispatch, provider POSTs, payment/booking changes, real owner approvals, background relay installation or private home-network access.

## Local verification and safe return to Comms Hub

- Run existing npm test, typecheck/build and any QL public source audit scripts; no real gate, booking or guest mutations.
- Return the **original exact QL-258 seven-question sanitized owner JSON** only when the owner actually supplies it. This is a nonsecret **self-report**, not human authentication. Include current immutable `main` SHA, genuine public proof A/B/CI URLs if they exist, and an independently reviewed nonsecret tenant-isolation disposition; otherwise state `NOT_VERIFIED`, `NOT_GIVEN`, `NOT_RUN`, `HTTP_404` accurately.
- A separate private reviewer retains actual human identities, key presence attestations, pin provenance, challenge nonce, host/store paths, endpoint origins, scoped credentials and any private receipts. **Never commit or paste** secrets, people's names, customer/guest data, home IPs or private challenge materials in GitHub, Cloudflare, Vercel, Comms Hub's static browser preview or the public return.
- For questions and coordinator's checklists, see [QL-263 master acceptance](https://github.com/RosevearCreations/rosevear-comms-hub/blob/main/docs/ROSEVEAR_QL263_ORIGINAL_RECEIPT_PRIVATE_ROLE_AND_GET_WINDOW_HANDOFF.md) and the forthcoming [QL-264 source coordination ledger](https://github.com/RosevearCreations/rosevear-comms-hub/blob/main/docs/ROSEVEAR_QL264_SIX_REPO_DIRECT_HANDOFF_AND_PRIVATE_GATE.md).

**Current disposition:** source app still `DISCONNECTED / HOLD`; owner TEST `NOT_GIVEN`; authenticated remote GETs `NOT_RUN`; twelve live-pilot prerequisites `HELD`. Publishing this file is **not** authorization to run a test.
