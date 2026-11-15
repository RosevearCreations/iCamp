# iCamp Build 255 — Seven-App Contract Identity Registry, Pin Lifecycle & Role Matrix

## Purpose
Implement an explicit versioned **source-only** contract registry for the seven Rosevear applications in the owner-mandated handoff order. This build **does not** turn on live network connections, trust pins, payments or owner approvals.

## Files
- `lib/release/build255-contract-registry.mjs` — pure policy validation, canonical identity list, named repository/connection model, six security tiers, per-app role/permission matrix, versioned source-envelope structure, freshness/nonce/tenant checks, advisory pin expiry and rotation readiness.
- `lib/release/build255-contract-registry.d.mts` — TypeScript contracts.
- `app/sysop/security-governance/page.tsx` — Sysop-only display of repository topology match and role matrix next to previously protected Build 254 original evidence. Existing `requireSysop` and original receipt/MFA boundaries remain in place.
- `tests/build255-contract-registry.test.mjs` — tenant isolation, cross-brand separation, role/MFA/source checks, T5 refusal, invalid/expired/revoked pins and Meadow theme invariants.

## Authoritative sources and signing boundaries
The checked-in `.github/rosevear-master-topology.v1.json` is the canonical repository topology validation input. The code registry must match all seven app IDs, repository names, connection models, 3/2/2 grouping and explicit `authorityTransfer=false`. The runtime contract version is `rosevear.seven-app-identity-registry.v1` and the metadata envelope version is `rosevear.seven-app-source-envelope.v1`.

A schema pass is **not a cryptographic signature pass**. `validateSourceEnvelope` validates shape, source and target identities, exact 40-hex source revision, 15-minute freshness, nonce syntax, an explicit non-sensitive classification, prohibited extra fields, tenant scope and cross-brand boundary. It intentionally never returns a connected or authenticated transport grant. The existing independent Ed25519 verification remains mandatory before any original receipt is admitted. Unknown fields such as personal addresses, card numbers or message payloads fail closed rather than entering the registry.

`evaluateRoleScope` maps seven application-specific roles to narrow permissions. It checks principal UUID, target app, tenant scope, role, MFA for privileged operations and refuses T5. Even when the policy matches it returns `allowed=false`, awaiting independently issued user grants, authenticated transport, owner review and properly scoped source proof. This does not replace application-level RLS, auth, audit, two-person approval, or consent.

## Original pin rotation
`assessPinLifecycle` is an **offline advisory** using metadata from original independent custodians, not a key store. It checks owner app, distinct SHA-256 fingerprint, exact source revision, custodian attestation field, not-before/not-after, revocation, an upper lifetime bound, and renewal due within seven days. Results are always `eligible=false`, `autoRotate=false` and `receiverConnected=false`. Never paste, store or log signing secrets, and never infer actual pin validity from a claim. Future supervised enrollment must verify signatures and private authority outside this module.

## App order & classification
1. **ai-data-platform** — top-tier Master; schema validation and evidence authority.
2. **rosevear-ai-hub** — Master; original-host OFF custody must not be activated by iCamp.
3. **rosevear-comms-hub** — Master; separation of messages, consent and signed routing.
4. **iCamp** — governed external shell, campground tenant access.
5. **YW** — governed external shell, independently segregated worker/job access.
6. **devilndove** — direct Master application, separate brand data.
7. **rosiedazzlers** — direct Master application, separate booking/vehicle/media data.

No guest, staff, vehicle or payment personal information is conveyed between company boundaries.

## Release gates
Required checks: formatting, lint, TypeScript, Node tests, browser E2E, disposable PostgreSQL migration replay and verification, CodeQL and secret scan, exact-source Vercel preview READY, source-exact `dev` and independent `main` pull requests, Vercel production exact SHA READY, HTTP 200 and runtime error readback. No new migration in 255; existing migration 0234 remains pending actual authenticated production DB custody.

**Operational state remains HOLD** for independently issued Master receipts/pins, original-host OFF witness, verified production database migration, T5 live transport, receiver ON and formal owner acceptance. Build 256 should address durable signed-event receipts, revocation propagation, renewal and replay/expiry escalation, but only after verified originals exist.

## Completion measurement
These tests advance architecture and security artifacts. A +10 percentage-point increase in each business domain is not asserted without the reproducible weighted baseline required by the roadmap. Preserve the existing Standard/Meadow visuals and selectable Orbit theme.
