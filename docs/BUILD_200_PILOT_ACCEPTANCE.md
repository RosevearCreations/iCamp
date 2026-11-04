# Build 200 — Camp Rosevear Pilot, Omnichannel Trust & Go-Live Decision

**Scope:** Full Guest/Staff Pilot Acceptance, Omnichannel Proof Review & Go-Live Decision.
**State:** Application release candidate. Independent real-world pilot and signed Comms Hub private connection **HELD**.

## What the build actually provides

1. `/pilot/acceptance` includes seven linked guest/staff/IT pilot journeys and local, source-labelled review notes. An owner can mark `NOT_RUN`, `BLOCKED`, `FAILED`, or `PASS_OWNER_REPORTED` and copy a sanitized JSON packet with SHA-256 integrity digest. The packet can never turn a browser checkbox into an independent sign-off, go-live authorization, or real payment/communication.
2. `npm run build200:source-audit` inventories the actual route components and regression test files for all seven journeys, calculates each source digest and labels its outcome **SOURCE_FILE_AND_TEST_PRESENCE_ONLY**. It does not claim someone physically tested a guest account, staff permission, device, gate or provider.
3. `/integration/comms-hub` retains the QL-334 public navigation link and gains a staff-permission-guarded transport probe via `/api/it/comms-hub/transport`. The probe performs one allowlisted, no-credential **HTTPS GET of the public Comms Hub homepage**, follows no redirects, disallows user-selected hosts/queries and has a timeout. This proves *public HTTPS reachability only* if and when a staff member actually runs it. It never transmits customer data, signs a private request, or activates a provider.
4. Five Build 200 automated tests cover real source locations, safe packet state, reproducible digest, sanitization, transport allowlist/redirect failure and staff permission wiring. The existing project regression suite and protected production gates remain mandatory.

## Explicit independent evidence still required

| Gate | Verified source as of 2026-11-04 | Decision |
| --- | --- | --- |
| Real guest booking, arrival, assistance, checkout on actual phone/browser | Source routes/test inventory only. No first-person device receipts. | HELD |
| Front-desk, housekeeping, maintenance, offline, security and privacy walkthrough | Automated coverage catalogued; no authenticated human staff/independent witness packet. | HELD |
| Signed Comms Hub manifest and trusted identity | iCamp manifest `signature.value=null`, `key_id=null`, `state=AWAITING_INDEPENDENT_SOURCE_SIGNER`; `connection_state=DISCONNECTED / HOLD`. | DISCONNECTED / HOLD |
| Independently verified Comms Hub registration | Comms Hub database readback: 1 iCamp shell record, 1 `DISCOVERED_UNSIGNED` manifest pin, **0 iCamp peer issuers**. | DISCOVERY ONLY |
| TEST-only HMAC handshake | iCamp's existing guarded endpoints authorize separate `ai-data-platform` issuer in isolated nonproduction configuration. No independent signer/receipt or approved iCamp↔Hub private credential/test window. | NOT ATTEMPTED |
| Provider/legal/consent activation | Build 199 separate sandbox gates still require official provider, legal and consent evidence. | HELD |
| Independent pilot signer/witness and owner go-live authorization | No authentic signed external record available. | **NO_GO_PENDING_EVIDENCE** |

## Authenticated connection activation requirements

1. Receive a real, independently issued and verifiable source identity/signature for iCamp, bound to exact manifest digest, source repository/commit and official authority. Obtain distinct reviewer custody. Do not invent, self-sign as independent, or trust an unsigned discovery link.
2. Enroll the tenant-scoped iCamp peer and approved nonproduction issuer in the Hub's trusted identity store; configure restricted, managed secret custody/rotation and narrow capabilities. The current public shell registry and unsigned manifest pin are insufficient.
3. Schedule an explicitly approved isolated **TEST-only** nonproduction tenant handshake, with replay/nonce and consent checks, witnessed source/target receipts, exact SHA correlation and no real outbound communication.
4. Independently sign off each real user journey on actual devices and staffed workflows, and record owner defects, blockers, accessibility issues, evidence links and outcomes. Only then reconsider private channel activation and go-live; production deployment GREEN is not integration GREEN.

## Release acceptance

Safe code promotion to `dev`/`main` and a healthy Vercel production deployment may be marked **application Production GREEN** after full checks. This does **not** override the separate live guest pilot, provider billing, private signed Comms Hub connectivity or go-live decisions, which remain **NO-GO / HELD** until authenticated independent evidence exists. No production database write/migration, tenant billing, live SMS/voice, gate action or dispatch is part of Build 200.

**Next proposed:** Build 201 — Pilot Finding Remediation, Real-Device Retest & Trusted Comms Hub Nonproduction Handshake Readiness (subject to authentic new receipts and authorization).
