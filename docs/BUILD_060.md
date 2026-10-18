# Build 060 — Access Zones, Schedules & Rules

## Status
**IMPLEMENTED — promotion verification in progress.**

## Roadmap scope
Build 060 provides enforceable access policy for:
- guest access;
- visitor access;
- staff access;
- contractor access;
- camper-only areas;
- event-specific access;
- weekday/time/date restrictions;
- device-to-zone enforcement.

## Canonical policy model
Migration `0078_access_zones_schedules_rules.sql` adds:
- `public.access_zones`;
- `public.access_zone_devices`;
- `public.access_schedules`;
- `public.access_rules`;
- elevated permission `access.rules.manage`.

Build 057's `zone_reference` remains a descriptive hardware location label. Build 060 is the first enforceable zone model.

## Decision semantics
Access is fail-closed:
1. inactive zones deny;
2. camper-only zones require active-stay context;
3. event zones require event context;
4. staff zones require staff or contractor context;
5. inactive/nonmatching rules are ignored;
6. schedule/date/time requirements are evaluated in campground-local time supplied by the server;
7. highest priority matching rule wins;
8. deny wins a priority tie;
9. no matching allow rule means deny.

Schedules support selected weekdays, optional date windows, ordinary daytime windows and overnight windows.

## Subject model
Build 060 rules support:
- `guest`;
- `visitor`;
- `staff`;
- `contractor`;
- `camper`;
- `event`;
- `any`.

Contractor is deliberately a policy subject type, not a new contractor master-data table. Future vendor/contractor builds may supply canonical contractor IDs without changing the Build 060 decision model.

## Event access
Rules may include a bounded `event_reference`. This allows event-specific access before later event-registration/pass presentation builds. Build 060 does not create tickets, wristbands or QR credentials.

## Application contract
`lib/access-control/rules.mjs` implements deterministic schedule matching and zone-policy evaluation.

`lib/access-control/rules-postgres.mjs` resolves all enforceable zones bound to a Build 057 device, loads applicable rules/schedules and returns a fail-closed aggregate decision. A device bound to no enforceable zone denies.

## Security
- configuration requires `access.rules.manage`;
- Security, Campground Manager and Owner/Admin receive the permission;
- monitoring roles with `access.events.read` can read policy evidence;
- all new public tables enable and FORCE RLS;
- direct `anon` and `authenticated` Data API access is revoked;
- no PIN, QR payload, provider API key or controller secret is stored.

## Channel contract
- **Web/PWA:** full zone/schedule/rule management and decision preview.
- **IVR/DTMF:** verified staff may query concise zone/rule status; complex policy editing uses secure visual/staff-assisted handoff.
- **SMS/MMS:** concise policy status/denial summaries may be sent after verification; policy editing uses a secure link or staff-assisted workflow.

## Build boundaries
- Build 056 owns credential abstraction.
- Build 057 owns physical access-device registry.
- Build 058 owns access/device event evidence.
- Build 059 owns manual gate commands.
- **Build 060 owns enforceable authorization policy.**
- **Build 061 owns Passes, Wristbands & QR Codes per the active delivery queue.**

## Manual action
**None required for source implementation.**

## Next build
**Build 061 — Passes, Wristbands & QR Codes**
