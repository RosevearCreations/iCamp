# Build 057 — Gate, Barrier & Access Device Registry

## Status
**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope
Build 057 introduces the provider-neutral physical access-device registry for:
- gates, doors and vehicle barriers;
- controllers, credential readers, keypads and intercom endpoints;
- administrative location/zone references;
- hardware and provider mapping;
- declared device capabilities;
- the latest administrative/provider health snapshot;
- management configuration.

## Database
Migration `0075_access_device_registry.sql` adds `public.access_devices` with:
- campground-scoped immutable device identity;
- optional parent-controller topology;
- local, provider or hybrid integration modes;
- provider-neutral external device references with no provider API secrets;
- manufacturer/model/serial mapping;
- bounded capability declarations;
- active/inactive lifecycle plus latest health state;
- forced RLS and deny-by-default Data API behavior;
- `gate.state.read` operational reads;
- `campground.configuration` create/update management;
- no application DELETE grant.

The parent-controller foreign key is indexed from the first migration so the Build 057 schema is advisor-ready rather than requiring a known FK-index correction later.

## Application contract
`lib/access-devices/core.mjs` provides:
- input normalization;
- provider-pair validation;
- capability validation/deduplication;
- health snapshot validation and operational summary;
- capability checks without issuing physical commands.

## Security boundary
Build 057 stores provider identifiers and provider device references only. It does **not** store provider passwords, API tokens, controller secrets, raw access credentials or command payloads.

An administrative `zone_reference` is descriptive configuration only. It is not an access authorization rule.

## Build boundaries
- **Build 058** owns open/closed/unknown observations plus append-only device/access events and denied-access evidence.
- **Build 059** owns permission-controlled manual open/close commands, reason capture, re-auth/rate limiting and provider outcomes.
- **Build 060** owns enforceable access zones, schedules and subject rules.
- **Build 056** remains the canonical credential abstraction.

## Channel contract
- **Web/PWA:** full management registry and device configuration contract.
- **IVR/DTMF:** status/configuration summary may be read through verified staff workflows later; device enrollment remains staff-assisted because hardware/provider identifiers are not suitable keypad input.
- **SMS/MMS:** concise status summary or secure-link handoff; provider secrets and control commands are never collected by Build 057.

## Cost and portability
No paid provider is required. The registry is ordinary provider-portable PostgreSQL and can map to future commercial gate/controller integrations without making one vendor authoritative.

## Hosted production verification
Supabase project `iCamp` received:
- `20261018035652 / access_device_registry`.

The Build 057 verification SQL passed against hosted PostgreSQL 17. Supabase Security Advisor returned zero findings. Supabase Performance Advisor returned no Build 057 warning-level or unindexed-foreign-key finding; the newly created access-device indexes appear only in the expected INFO-level unused-index list until production traffic uses them.

## Promotion evidence
- feature PR #214;
- final feature head `42e35d898eded12f3bd9e16731f8821017d4340b` passed Verify, Browser E2E, database migrations/lifecycle/idempotence, CodeQL and Gitleaks;
- exact `dev` merge SHA `4e135790d2faf897565a70d7e971bbea8037feae` passed the same complete gate set;
- production PR #215 passed its independent pull-request gate set;
- production feature `main` SHA `966c7f117df23b2f44dceffeb71753e9d05c5f61` passed Verify, Browser E2E, database migrations/lifecycle/idempotence, CodeQL and Gitleaks.

## Manual action
**None required.** Provider-specific credentials remain outside this registry and will only be introduced through a secure integration-secret boundary when a real provider is connected.

## Next build
**Build 058 — Access Event & Device Event Ledger**
