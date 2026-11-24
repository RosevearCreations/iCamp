# iCamp Build 276 — Original peer signer enrollment, owner recovery readback and independent restore closure

## Design and operational guardrails

This release extends Build 275, without manufacturing credentials, source handshakes or original backup restores. Build 275 was promoted to both dev/main and exact main commit af9c0c5f7bb7d2cc4bfdbf04182a058779108ea7 was Vercel production READY with alias i-camp-pi.vercel.app.

The seven permitted source identities are ai-data-platform, rosevear-comms-hub, rosevear-ai-hub, yard-workers, rosie-dazzlers, devil-n-dove, and icamp.

### Two-person signer enrollment

1. Verify and pin the actual production database host before adopting migration 0250. Existing migrations 0247–0249 must already be independently adopted.
2. A verified platform operator at /sysop/acceptance276 submits the original peer's Ed25519 SPKI **public** key, original commit, key ID, SHA-256 fingerprint of the SPKI DER bytes, and an out-of-band source custody evidence digest. This creates an append-only candidate, not an active signer.
3. A *different* MFA-verified platform operator independently checks the original source key and revision through another channel and records a second evidence digest. The append-only review activates that exact candidate key+revision for cryptographic challenge checks. No application private key or administrative grant changes.
4. The original peer submits raw JSON with exactly source, keyId, commitSha, challengeId, nonce, observedAt, signed as an Ed25519 message. Send the base64url signature header x-icamp-ed25519-signature to POST /api/internal/source-handshake276. Two-minute freshness, signer ID, exact pinned commit, unique nonce and challenge are enforced. No sample or synthetic receipt is counted as genuine.
5. The operator console **reverifies raw stored receipt bytes** and original pins on every readback, not merely key IDs or counts, and holds all missing/stale/unsigned sources. Independently validate deployed source service identities and transports outside the app. A cryptographic receipt is not automatically a complete operational certification.

### Original Rosevear login readback

The protected operator view reads the existing actual original host, the original Rosevear account state, password presence, verified contact, independent owner binding/grant, MFA, current Rosevear AAL2 session, and independently witnessed original owner login (Build 272). It does not reveal passwords or actual one-time recovery credentials. No new reset function or MFA bypass is provided. An original owner may complete first-password recovery through /auth/owner-setup and then sign in with a personal password, followed by actual authenticator enrollment.

### Independent restore closure operations

A signed original provider attestation must reference an already independently reviewed Build 272 four-scope isolated restore chain, with different original and isolated host fingerprints. A **third** MFA-verified platform operator, distinct from the existing dry-run reviewer and backup witness, records an independent external host readback digest. All reviews remain immutable and FORCE-RLS. This receipt does *not* create a backup, restore a database, authorize customer impact, or automatically pronounce external recovery complete.

### Safety and certification

- Private rows: icamp_private.peer_signer_proposal276, peer_signer_review276 and restore_closure_review276. Each has an immutable guard, forced RLS, and replay restrictions. Schema verification in CI is disposable and is not original production evidence.
- Actions refuse access without the existing original, independently approved AAL2 platform operator identity. A reviewer cannot approve the same proposal they submitted.
- A ready Vercel production deployment and green protected CI certify only the **software release**. Original account login, all seven independent peers, production database migration adoption, booking/Comms original service evidence and original backup/restore acceptance retain independent field gates.
- Because original host pin and external source signers were absent from Vercel production at Build 275 inspection, do not assume these are newly configured unless actual live evidence proves it.

## Promotion requirements

Only merge a clean development PR after Verify, browser end-to-end, database migrations, CodeQL and secret scan pass. Mirror the exact Build 276 changed files onto protected main without rebasing divergent dev history; rerun all checks. Require Vercel target=production READY, exact new main commit SHA, alias i-camp-pi.vercel.app and real HTTPS health/route smoke checks. No test credentials in production, and never claim actual operational closure from simulation.

## Next proposed build

**iCamp Build 277 — Owner-Verified Original Source Pin Adoption, Field-Signed Peer Challenge Drill & Independent External Restore Acceptance.**
