# Build 058 — Access Event & Device Event Ledger

## Status
**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope
Build 058 adds monitoring evidence for:
- gate/door/barrier open, closed or unknown observations when supported;
- device health observations, faults, recovery and heartbeat evidence;
- access attempts and outcomes;
- credential association;
- guest, visitor, staff and road-vehicle association;
- explicit denied-access reasons.

## Database
Migration `0076_access_device_event_ledger.sql` adds:
- `public.access_device_events`;
- `public.access_events`;
- append-only grants and FORCE RLS;
- provider-event idempotency references;
- scoped foreign keys back to Build 057 devices, Build 056 credentials, guest profiles, visitors and road vehicles;
- first-migration FK indexes for advisor readiness;
- `access.events.record` for security/management event ingestion;
- existing `gate.state.read` and `access.events.read` permissions for monitoring reads;
- direct `anon` / `authenticated` Data API access denied.

## Evidence model
Device state is never rewritten as history. The latest open/closed/unknown observation is derived from the append-only device-event ledger.

Access attempts preserve outcome, direction, associations and a required denial reason when the outcome is denied. Unknown/anonymous attempts remain representable without inventing a person or credential.

## Application contract
`lib/access-events/core.mjs` provides:
- device-event normalization;
- access-event normalization;
- denied-reason validation;
- staff-source recorder validation;
- latest-state derivation;
- access-outcome summaries.

## Security boundary
Build 058 stores no raw keypad PINs, QR payloads, provider API credentials or command secrets. Metadata remains bounded JSON evidence and must not be used as a side channel for secrets.

## Build boundaries
- **Build 059** owns permission-controlled manual open/close commands, reason capture, re-auth/rate limits and provider command outcomes.
- **Build 060** owns enforceable access zones, schedules and subject rules.
- **Build 062** owns pass/wristband/QR validation workflows.

## Channel contract
- **Web/PWA:** full monitoring timeline and access-event review can use the canonical ledgers.
- **IVR/DTMF:** verified staff may receive concise state/access summaries; detailed evidence uses staff-assisted or secure visual handoff.
- **SMS/MMS:** concise alerts/summaries may reference event IDs with secure-link handoff; no raw credential secret is ever echoed.

## Cost and portability
No paid provider is required. The event model is provider-neutral PostgreSQL and can receive normalized events from future gate/access vendors.

## Hosted production verification
Supabase project `iCamp` received:
- `20261018050416 / access_device_event_ledger`.

Hosted Build 058 verification SQL passed against PostgreSQL 17. Supabase Security Advisor returned zero findings. Supabase Performance Advisor reported only expected INFO-level unused-index notices for the new access/device-event indexes; there is no Build 058 warning-level or unindexed-foreign-key regression.

## Promotion evidence
- feature PR #217;
- final feature head `0e48f6436911ac035aa360a3ae1c14f583551fec` passed Verify, Browser E2E, database migrations/lifecycle/idempotence, CodeQL/JavaScript & TypeScript analysis and Gitleaks;
- exact `dev` merge SHA `d8a3aac92fecaa9d7e7b94905f364277543e6e34` passed the same complete gate set;
- production PR #218 passed its independent pull-request gate set;
- production feature `main` SHA `85845e4fd595119ac5df89a8b8782f014458cf43` passed Verify, Browser E2E, database migrations/lifecycle/idempotence, CodeQL/JavaScript & TypeScript analysis and Gitleaks.

## Manual action
**None required.**

## Next build
**Build 059 — Manual Gate Open/Close Override**
