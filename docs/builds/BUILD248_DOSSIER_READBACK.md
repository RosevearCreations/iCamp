# iCamp Build 248 — Independent Pin Readback and Owner Dossier Chain Review

## Scope

Build 248 extends the approved Build 247 Orbit Command and private campground evidence custody. The protected device verifier configuration is checked for canonical Ed25519 SPKI encoding, algorithm, authenticated SHA-256 fingerprint and explicit independent-custodian enrollment before it is usable. No browser key or temporary test signer is promoted as a trusted source.

An owner-only acceptance-evidence export now includes a dossier pointer-chain readback. The server checks the ordered tenant-scoped snapshot IDs, previous digest links, source-revision syntax, timestamp order and bounded evidence counts; missing roots, duplicate records, cross-tenant entries, broken pointers and truncated history fail closed. This is **pointer lineage only**, not recomputation of the original content digest, a signed attestation or external acceptance.

The export keeps no-store headers, active campground Owner/Admin authorization and RLS. Source-only counts and signer pin readiness remain separate from independent device acceptance, signed HEALTHY receipts, Master CONNECTED and formal owner production acceptance. Those gates remain HOLD unless independently evidenced.

## Verification and deployment

- Unit tests cover valid Ed25519, absent enrollment, mismatched pin, malformed and wrong-algorithm keys; normal/empty/cross-tenant/broken/truncated dossier chains.
- Protected PR gates: Prettier, lint, TypeScript, Node tests, Next production build, isolated PostgreSQL migration/verifier and Chromium smoke, CodeQL, secret scan and preview.
- Promote the exact feature file blobs to dev. Production promotion is an independently reviewed exact-file transfer from the current main baseline; never merge dev history wholesale because branches diverge.
- Production GREEN additionally requires exact main SHA, deployment READY, live health/manifest/version checks and confirmed CI, not simply a merged PR.
