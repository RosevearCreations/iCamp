# Build 056 — Access Credential Abstraction

## Status
**IMPLEMENTED — promotion pending.**

## Roadmap scope
Build 056 supplies the provider-neutral credential layer for:
- key cards and fobs;
- keypad PINs;
- QR, printed and wristband passes;
- external/provider credential references;
- validity, expiry observation and revocation.

## Security boundary
Raw keypad PINs, QR payloads and provider API secrets are never stored in the canonical credential tables.

Digital credentials store only:
- a SHA-256 fingerprint used for server-side comparison/integration;
- an optional masked display hint safe for staff screens;
- a provider reference when an external access platform owns the credential.

Build 056 does not unlock gates or doors. Build 057 introduces the physical access-device registry, Build 058 records device/access events, Build 060 owns enforceable zones/schedules, Build 062 owns wristband/QR/pass validation and Build 063 owns the full arrival/departure credential lifecycle.

## Database
Migration `0072_access_credential_abstraction.sql` adds:
- `public.access_credentials`;
- `public.access_credential_events`;
- forced RLS;
- append-only event history;
- immutable scope/identity rules;
- one-way digital credential fingerprints;
- provider-reference uniqueness;
- validity/revocation constraints;
- front desk, security, campground manager and owner/admin issuance/revocation grants.

## Application contract
`lib/access-credentials/core.mjs` provides:
- provider-neutral input normalization;
- secure random credential-secret generation;
- SHA-256 secret fingerprinting;
- masked display hints;
- revocation validation;
- effective scheduled/active/expired/revoked status.

## Verification
- `tests/build056-access-credential-abstraction.test.mjs`;
- `database/verify/0072_access_credential_abstraction.sql`;
- normal repository Verify, Browser E2E, database migration/lifecycle/idempotence, CodeQL and Secret Scan gates.

## Next build
**Build 057 — Gate, Barrier & Access Device Registry**
