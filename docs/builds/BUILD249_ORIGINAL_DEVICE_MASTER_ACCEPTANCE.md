# iCamp Build 249 — Original Device Witness Admission, Owner Dossier Source Integrity & Cross-Master Evidence

## Scope and hard security boundaries

1. A new append-only tenant-private original-device witness admission follows a genuine Build 247 Ed25519 source-bound verification. The independent campground supervisor must not be the original field reporter, field witness, original-device reviewer or signature verifier. SQL checks the latest review and signature, same campground and organization, current exact deployed SHA, 24-hour freshness, uniqueness and RLS. A human witness statement is **not** proof of independent original device key custody, formal owner acceptance or Master connectivity.
2. The owner export now recomputes each stored Build 247 canonical v1 dossier digest from stored non-PII counts and linkage, in addition to the Build 248 chain pointer audit. It separately compares the latest snapshot to current private source counts and current exact source revision. A new deploy legitimately makes the latest snapshot stale, requiring a new owner capture. Historical digest integrity is not external authentication.
3. Each of the three Master evidence readbacks is inspected separately. Only protected server-side configuration can supply per-plane independently enrolled Ed25519 public-key pins and original signed source receipt packets. All receipts must be recent, domain-separated and bound to iCamp's exact deployment SHA, distinct plane, unique signer and nonce, and status SOURCE_HEALTHY_OBSERVED. Missing, duplicate, altered or stale evidence remains HOLD. No key or signature material is returned to clients; no browser claim can enroll authority. Even three valid receipts do not automatically change independent source signer, CONNECTED, device authority or formal owner production acceptance.
4. The existing owner-only no-store private JSON export provides independent witness counts, digest revalidation and per-plane source-only trust statuses. The Orbit Command campground owner view provides an independent witness admission form. The outer Sysop shell remains platform-only with no guest/worker records and no delegated tenant administration.

## Independent verification prerequisites

- An authorized custodian must provision the original device public key/pin through existing protected settings; never use a test fixture or archived key.
- For cross-Master readback, independently enroll three distinct Master signer SPKI pins in protected ICAMP_MASTER_RECEIPT_PINS_JSON and original signed receipts in protected ICAMP_MASTER_ACCEPTANCE_READBACK_JSON. Set ICAMP_MASTER_RECEIPT_CUSTODIAN_ENROLLED=true only after authenticating key custody out of band. These are protected runtime settings, never owner browser inputs. Missing settings deliberately yield HOLD.
- A real production DB migration 0232 must be applied and independently checked before authenticated witness intake. Successful CI only proves an isolated DB lifecycle, not the user's production DB adoption.
- Operational owner consent/acceptance and signed source HEALTHY remain separate supervised ceremonies.

## Release verification

Protected dev and main PRs must pass formatting, lint, typecheck, unit tests, Next production build, isolated PostgreSQL migration/verification, Chromium, CodeQL, Gitleaks and Vercel preview. Since dev and main contain unrelated divergent history, promote only the Build 249 file set, based on current main and source-blob-checked against dev. Declare production GREEN only after the exact main SHA is READY and aliased on Vercel, the protected production checks have passed, and live HTTP/version/convergence checks are corroborated when accessible.

Build 250 candidate: Supervised Original-Device and Three-Master Live Receipt Ceremony, Independent Source HEALTHY Custody & Explicit Owner Acceptance Decision Gate.
