# Build 142 — Independent QL-245 Receipt Source Comparison, Trusted Pin Provenance and Gateway HOLD Recurrence

## Source-of-truth boundary

Build 142 implements an **owner-only, append-only documentary follow-up** for iCamp's Build 141 QL-245 receipt-verification queue. Its three ordered phases are: comparing real source SHA/CI metadata, comparing two **public** Ed25519 SPKI SHA256 fingerprints while keeping the independent trust-channel check pending, and escalating database-observed overdue/recurrent receipt exceptions. The app calculates age and recurrence, requires distinct reviewers, and never authorizes a connection.

The QL-246 six-app handoff (`ROSEVEAR_QL246_SIX_APP_SOURCE_PROOF_HANDOFF`) is a **request for evidence, not connection permission**. Our offline `lib/integration-v1/ql246-source-proof.mjs` implements its precise canonical 24-field JSON/Ed25519 signature verification, checks seven negative denial fields against a separately attested observation flag, checks public SPKI fingerprint against a separately supplied trusted pin, and returns `PENDING_BLOCKED` or `SOURCE_METADATA_MATCHED_GATEWAY_HOLD`. Neither outcome enables any gateway activity.

## Actual QL-246 source report — PENDING / BLOCKED

- No operator-generated iCamp-specific Ed25519 source key, secret-manager provisioning or independently authenticated public SPKI pin has been furnished.
- No private one-time `np-...` challenge ID and challenge SHA256 has been given for signing.
- No independently witnessed, real seven negative denial traces, valid nonproduction gateway GET receipts, gateway audit receipt, green run for the signed source revision or out-of-band owner identity acceptance has been furnished. CI **unit fixtures are not receipts**.
- No signed `docs/integration/ql246-source-proof.json` was created. Inventing a signer, signature, tenant ID, audit receipt or positive denial results would violate the QL-246 contract. The operator may accept this honest PENDING handoff instead.
- QL-246's demand that the signed `payload.source_revision` equal the commit SHA *containing the very same JSON* is self-referential and cannot be satisfied by ordinary Git/SHA256: file contents change commit SHA. **Needed contract clarification:** pin `source_revision` to a preexisting immutable tested source-code commit, then publish the signed proof in a separate subsequent immutable proof commit; report both hashes separately over the authenticated operator handoff. Until amended, no QL-246 signed acceptance proof should be asserted.

## Safe operator next steps (no action authorized by this document)

1. Independently verify the exact iCamp code revision, CI workflow result, app-specific business and `np-...` tenant identity and issue a one-time operator challenge.
2. An authorized local iCamp operator generates a unique Ed25519 key in its secret manager and supplies only its public SPKI SHA256 out of band. Do not expose private keys or challenge nonces in browser forms or Git.
3. Independently witness the two nonproduction signed GET endpoints and all seven real denial outcomes, with actual nonsecret `np-...` receipts, while retaining `owner_authorization=NOT_GIVEN` and `connection_state=DISCONNECTED`.
4. Once QL-246 clarifies the source/proof commit distinction, sign the exact 24-field canonical payload within one hour of retrieval and publish only the public envelope at the agreed immutable proof commit. Supply raw JSON digest and the trusted public pin over the separate authenticated channel.
5. AI Data Platform independent reviewers fetch and verify six separate source code revisions, signed proofs and pins, compare cross-app tenant isolation and durable audit evidence and record a **HOLD** result. Actual pilot enablement requires a later explicit owner approval and another gateway acceptance procedure, not this source-proof process.

All runtime external requests, credentials, dispatch, customer/visitor/reservation data transfer, physical gate commands, payments and public source claims remain **OFF / DISCONNECTED / HOLD**.

## Release requirements

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` succeed.
- CI applies migrations from clean state and replays migration history, including migration 0172 verification.
- Hosted migration and restrictive RLS/security advisor checked before production promotion.
- Both `dev` and `main` production checks GREEN and refs reconciled after merge, without treating a green code deployment as a live gateway test.

**Next expected:** Build 143 — Independent QL-246 Source-Proof Exception Intake, Out-of-Band Pin Challenge Reconciliation and Multi-Application HOLD Gate Decision.
