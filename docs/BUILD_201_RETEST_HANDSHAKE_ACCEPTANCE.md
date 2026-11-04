# Build 201 — Pilot Finding Remediation, Real-Device Retest & Trusted Comms Hub Handshake Readiness

**Fixture:** Camp Rosevear. **Application scope:** Real review usability and safe nonproduction readiness; no live channel/billing activation.
**Pilot sign-off:** **NO-GO pending independent evidence.** **Authenticated Comms Hub private connection:** **DISCONNECTED / HOLD.**

## Source-grounded finding and changes

Build 200's local-only worksheet lost its data on a full route navigation or refresh, while its “Open actual workflow” links navigated in the same tab. This is verifiable from the source; it was **not** reported by a real owner or device witness. Build 201 corrects it without inventing an external finding:

- The original workflow links now open a separate tab. `/pilot/acceptance` adds a recoverable Build 201 finding/retest workboard.
- Session-only browser storage saves *sanitized reference IDs* across navigation/refresh. The owner can copy a SHA-256-labelled JSON packet and import it on a different device; packet schema, limit, unique reference, journey, profile, status and ID prefix are validated. Unknown approval/signature/guest fields are discarded. No free-text descriptions, passwords, names, phone numbers or emails are part of this form.
- Five owner-reported device/accessibility profiles distinguish phone, tablet, desktop keyboard, screen reader/keyboard and offline recovery; `RETEST_REPORTED_PASS` does **not** mean an actual device was independently observed. Imports cannot sign off a test, activate a channel or authorize go-live.

## Comms Hub private handshake trust boundary

As of the read-only **2026-11-04** source and hosted registry review:

| Source | Authentic readback | Consequence |
| --- | --- | --- |
| iCamp public discovery manifest | `signature.key_id=null`, `signature.value=null`, source signer `AWAITING_INDEPENDENT_SOURCE_SIGNER`, `transport.origin=null` | Unsigned discovery only |
| Comms Hub `master_shell_registry` | One iCamp shell, `DISCONNECTED / HOLD` | Public registration is not authenticated access |
| Comms Hub `master_source_manifest_pins` | One iCamp pin, `DISCOVERED_UNSIGNED` | Independent source not pinned as signed |
| Comms Hub `master_peer_issuers` | Zero iCamp records | No trusted iCamp peer to authenticate |
| iCamp `icamp_private.integration_handshake_receipts` | Zero current receipt rows | No witnessed signed source exchange |
| iCamp existing `/api/integration/v1/health` and `/capabilities` | Separate `ai-data-platform`-issuer HMAC read-only nonproduction gate, production disabled | **Not** an authenticated Comms Hub peer route |
| QL-335 source-owned `/api/integration/v1/shell/health` and `/capabilities` | Signed shell contract `rosevear.shell.nonproduction.v1` is deployed on `main`. Production requests are denied; isolated TEST returns HOLD when source/owner identity, signed issuer, pinned origin, KMS signature and durable nonce services are not independently supplied | Endpoint existence is **not** an authenticated handshake or active Comms Hub connection |

Build 201 adds an I.T.-permission-controlled, query-free, read-only `/api/it/comms-hub/handshake-preflight` returning **only** local public manifest/legacy-adapter readiness. Its UI states exactly what is missing and *cannot* set a trusted issuer, claim an external signature or open a private session. The separate public HTTPS transport probe from Build 200 remains available.

`npm run build201:handshake-drill` creates an ephemeral, entirely local **synthetic** HMAC fixture for the legacy `ai-data-platform` contract. It proves accepted isolated fixtures, denial of cross-tenant access and rejection of wrong issuer, tampering, expiration and production enablement. It **does not** exercise live Comms Hub, the hosted database nonce ledger, a real independent key, owner test consent or any external provider. Output is explicitly labelled `fixture_only` and `actual_comms_hub_signed_handshake=NOT_ATTEMPTED`.

## Outstanding authentic field evidence

1. Owner supplies real, non-sensitive issue/retest IDs and first-person phone/tablet/desktop accessibility findings, with actual device/browser and independent reviewer evidence retained in the proper secured system. This release contains no authentic external pilot sign-offs to remediate.
2. The original independent signer supplies signed iCamp manifest material, source binding/digest and separate custody evidence. Hub administrators verify and enroll the peer with least-privilege tenant entitlement; no fabricated credentials or trust records.
3. An approved isolated **TEST-only** nonproduction tenant and bounded handshake window are documented by the owner, followed by an actual nonce-replay-tested signed GET and independently reconciled source/target receipts. Production channels remain denied.
4. Independent owner acceptance decides whether each actual pilot finding is closed. Application CI/Vercel **GREEN does not authorize** live bookings, payment charge capture, omnichannel messaging, gate control or staff dispatch.

## Release checks

- `node --test tests/build201-pilot-retest-handshake.test.mjs` — retest sanitation, cross-device import, anti-forgery, trust boundary and fixture-only HMAC test.
- `npm run build201:handshake-drill` — read-only synthetic nonproduction cryptographic denial coverage, executed in protected CI.
- `npm run verify` — formatting, lint, TypeScript, full Node tests and Next production build, then protected GitHub CI, CodeQL, Secret Scan and Vercel exact-main readback.

**Next proposed:** Build 202 — Independent Pilot Evidence Intake, Trusted Peer Enrollment Review & Scoped TEST Handshake Witness. Scope remains contingent on authentic outside sign-off and explicit nonproduction approval.
