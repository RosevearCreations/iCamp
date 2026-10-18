# Build 058 — Access Event & Device Event Ledger

## Status
**IMPLEMENTED — promotion verification in progress.**

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

## Manual action
**None required for source implementation.**

## Next build
**Build 059 — Manual Gate Open/Close Override**
