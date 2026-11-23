# Build 275 — Rosevear login recovery, seven-source signatures and recovery closure

## Verified baseline (November 23, 2026)

Build 274 has been merged into dev and main (main: a75839faa45ba3888f3e2e4fd86b3aebef348dbc), but the latest Vercel production deployment was still serving Build 273 commit 13884dc708b83f4f1f3fde0b00e0c86aeb9bec34. A GitHub merge is not a deployed production release.

Production Vercel metadata contained the Build 273 private owner recovery credential, issued-at/expiry controls, MFA key, a DATABASE_URL and telemetry keys. The original host pin and original source signer variables were not configured. Do not disclose protected values or infer the genuine production database host from DATABASE_URL alone.

## Deliverables

- Public /auth/owner-diagnostics explains the difference between the one-time setup secret and the subsequent personal login password without leaking whether a particular account exists.
- Private /sysop/acceptance275 displays independent source-specific signed receipt and owner acceptance statuses. It requires the existing sysop MFA/owner-grant gate.
- POST /api/internal/source-handshake275 accepts only a short-lived, Ed25519-signed JSON object with exactly six fields: source, keyId, commitSha, challengeId, nonce and observedAt. The body bytes themselves are signed.
- The server-only ICAMP_275_SOURCE_PINS_JSON setting must contain independently verified entries for seven sources, keyed by canonical application ID. Every entry has keyId, commitSha and publicKeyPem; private signing keys remain with the corresponding sources. Changing pinned revisions invalidates old receipts.
- Migration 0249 installs an immutable private FORCE-RLS receipt ledger with unique per-source nonce and challenge IDs and database freshness/digest enforcement. CI tests only structural safety, not original operator/provider field acceptance.

Seven distinct source IDs: ai-data-platform, rosevear-comms-hub, rosevear-ai-hub, yard-workers, rosie-dazzlers, devil-n-dove and icamp. Never manufacture signatures or silently trust a fixture as an original source.

## Completion gates

1. Independently verify the original production database host; safely adopt migrations 0248–0249 there and confirm schema readback.
2. Complete the originally issued one-time owner recovery form while valid, then authenticate with username Rosevear and the new personal password. Verify TOTP, a trusted account contact, original owner binding and independent platform grant.
3. Independently enroll each original peer public key and deployed commit, then receive genuine Ed25519-signed source handshakes with distinct fresh nonces/challenges and independently review signatures.
4. Review actual booking/payment evidence, delivered Comms receipt, resolved incident and independent isolated restore from the original source. Signed source receipts cannot automatically certify recovery closure.
5. Run protected GitHub CI, browser E2E, database migration, CodeQL and secret scan, promote exact clean changes dev then main without unrelated divergent commits, and require Vercel production READY for the new main SHA and live alias health before claiming software release GREEN.

## Next proposed

Build 276 — Original Peer Signer Enrollment, Owner Recovery Readback and Independent Restore Closure Operations.
