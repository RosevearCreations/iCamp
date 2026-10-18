# Build 060 — Access Zones, Schedules & Rules

## Status
**FULLY PROMOTED — `main` GREEN.**

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

## Hosted production verification
Supabase project `iCamp` received:
- `20261018145114 / access_zones_schedules_rules`;
- `20261018145759 / access_rules_policy_hardening`.

The exact Build 060 verification SQL and advisor-hardening verification SQL passed against hosted PostgreSQL. Supabase Security Advisor returned zero findings. The initial four warning-level multiple-permissive-policy findings were corrected by the hardening migration; the final Performance Advisor has no Build 060 warning-level or unindexed-foreign-key regression. Remaining Build 060 index findings are expected INFO-level unused-index notices on newly created indexes.

## Promotion evidence
- feature PR #223;
- final feature head `a8a59a1a188aeaa330f450fbb5884cf563a31b41` passed Verify, Browser E2E, database migrations/lifecycle/idempotence, CodeQL/JavaScript & TypeScript analysis and Gitleaks;
- first exact `dev` merge SHA `410f97c0c1298ada825cc2999ea3df079a0c56b1` passed the complete push gate set;
- advisor-hardening PR #224;
- final hardening head `26e86620e872e180086bfc4816d9caddaa94e66a` passed the complete feature gate set;
- final production candidate `dev` SHA `915e476707bd0c14e4fdb13436dd9f7acc0dc11a` passed both push and production pull-request gate sets;
- production PR #225;
- production feature `main` SHA `5bb52fd05929a4277e7e712f069ec394e4726bf1` passed Verify, Browser E2E, database migrations/lifecycle/idempotence, CodeQL/JavaScript & TypeScript analysis and Gitleaks.

## Manual action
**None required.**

## Next build
**Build 061 — Passes, Wristbands & QR Codes**
