# Build 056 — Access Credential Abstraction

## Status
**FULLY PROMOTED — `main` GREEN.**

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

Production verification identified two provider-specific hardening requirements, both retained in source:
- `0073_build056_data_api_hardening.sql` explicitly denies direct `anon`/`authenticated` Data API privileges when those Supabase roles exist;
- `0074_build056_fk_index_hardening.sql` adds the covering scoped foreign-key index for credential events.

## Application contract
`lib/access-credentials/core.mjs` provides:
- provider-neutral input normalization;
- secure random credential-secret generation;
- SHA-256 secret fingerprinting;
- masked display hints;
- revocation validation;
- effective scheduled/active/expired/revoked status.

## Channel boundary
- **Web/PWA:** canonical server-side credential contract is available for later management/arrival screens.
- **IVR/DTMF:** no raw credential secret is accepted or echoed by Build 056; later channel workflows must use verified/staff or provider handoff.
- **SMS/MMS:** no raw PIN or QR payload is requested or persisted by Build 056; secure-link/provider handoff remains the safe fallback.
- Physical gate/barrier control remains explicitly deferred to Build 057+.

## Hosted production verification
Supabase project `iCamp` received:
- `20261018022823 / access_credential_abstraction`;
- `20261018022837 / build056_data_api_hardening`;
- `20261018022851 / build056_fk_index_hardening`.

Hosted verification SQL passed after hardening.
Supabase Security Advisor returned zero findings.
Supabase Performance Advisor returned zero non-unused-index findings after the Build 056 FK-index correction. Newly created indexes may still appear in the normal INFO-level unused-index list until production traffic uses them.

## Promotion evidence
- feature PR #209;
- production feature PR #210;
- production hardening PR #212;
- final feature head `8ab2d4af17906e11fd3c6b6ae5c874dacded8681` passed Verify, Browser E2E, database migrations/lifecycle, CodeQL and Secret Scan;
- hardened `dev` SHA `0d61a6415851dbc929e39e550d7a8b3aa5453c70` passed CI run #39090480678, CodeQL run #39090480576 and Secret Scan run #39090480656;
- production hardening PR gates passed CI run #39090619658, CodeQL run #39090619678 and Secret Scan run #39090619759;
- hardened production `main` SHA `d87212e4df1fb1a55575466828b0f5df59b9aa13` passed CI run #39090737063, CodeQL run #39090737113 and Secret Scan run #39090737111;
- Verify, Browser E2E, database/lifecycle/idempotence, production build and dependency audit GREEN.

## Cost and portability
No new paid provider is required. The model is provider-neutral PostgreSQL and does not couple credential business rules to a specific gate/access vendor. Supabase-specific Data API grants are isolated in a conditional hardening migration that remains safe on plain PostgreSQL.

## Manual action
**None.**

## Next build
**Build 057 — Gate, Barrier & Access Device Registry**
