# Build 078 — Assistance Triage & Management Escalation

## Status
**IMPLEMENTED — validation and promotion in progress.**

## Queue authority
Build 078 follows the fully promoted Build 077 camper-assistance intake and
implements historical roadmap Build 079.

## Delivered scope
- protected Management → Campgrounds → Assistance queue;
- separate operational case projection over immutable Build 077 intake;
- operational category and routine/soon/urgent priority reclassification;
- campground-scoped assignment to active staff;
- dedicated `assistance.triage`, `assistance.escalate`,
  `assistance.communicate` and `assistance.close` permissions;
- append-only internal notes and guest-visible updates;
- explicit management escalation to main foreman, manager or owner;
- escalation acknowledge and resolve lifecycle;
- terminal outcome-based case closure;
- optimistic row-version checks on case and escalation mutations;
- My Stay visibility for operational state, guest-visible updates and final
  outcome;
- contextual help and management-shell entry point.

## Canonical authority boundaries
Build 078 does not mutate the camper's original report.

- Build 077 remains the immutable intake/media authority.
- Build 078 owns operational classification, assignment, escalation,
  communication evidence and closure.
- Build 009+ communications remains the authority for actual provider delivery.
  Selecting email/SMS/phone in Build 078 records a staff contact channel and
  never fabricates provider delivery evidence.
- Build 065 remains the maintenance work-order authority. An assistance case may
  route to maintenance staff but is not itself a maintenance work order.

## Assignment model
Assignment is limited to an active staff identity with a current assignment to
the same campground. The queue shows staff using the private account label and
current role codes. Cross-campground assignment is rejected.

## Escalation model
An assistance case can have only one active management escalation.

1. Authorized staff raises an escalation with a target level and reason.
2. Management may acknowledge it.
3. Management resolves it with a durable resolution note.
4. The case returns to assigned/triaged state after escalation resolution.
5. A case cannot close while an escalation is open or acknowledged.

Management escalation is campground routing only. It never means emergency
services were contacted.

## Guest communication
Guest-visible updates are append-only operational events.

- `in_app` means the update is visible in My Stay.
- email/SMS/phone records the channel staff used or intends to use.
- Build 078 sets `externalDispatchClaimed=false`; actual provider dispatch must
  use the canonical communications gateway and its consent/suppression evidence.

## Closure
Closure is terminal and requires:
- `assistance.close` authority;
- a valid outcome code;
- a guest-visible outcome summary;
- no active escalation;
- the current case row version.

Supported outcomes are resolved, referred, duplicate, guest cancelled, not
reproducible and other.

## Database/security controls
- `public.camper_assistance_cases`;
- `public.camper_assistance_case_events`;
- `public.camper_assistance_escalations`;
- all new public tables ENABLE and FORCE RLS;
- direct `anon`/`authenticated` privileges revoked;
- application role receives only required SELECT/INSERT/UPDATE capability;
- operational event evidence is append-only;
- terminal closed cases cannot be mutated;
- assignment and actor identity are validated server-side/database-side;
- assistance-only custom roles receive explicit read continuity over immutable
  Build 077 intake through additional RLS policies.

## Omnichannel contract
- Web/PWA: full queue, assignment, notes, guest updates, escalation and closure.
- IVR/DTMF: verified staff may use canonical commands where the existing
  identity, authorization and bounded keypad workflow can represent the action;
  visual/long-form work returns to secure Web/PWA.
- SMS: verified staff may use safe bounded commands; long notes, assignment lists
  and escalation history use secure-link/staff-assisted handoff.
- No channel may bypass campground permission checks or optimistic concurrency.

## Theme architecture
Build 078 uses existing semantic components and tokens. It introduces no
theme-specific styling fork, so the standard multi-theme prerequisite remains
binding.

## Cost / infrastructure
No new paid service, hosted project, Worker, D1 database, R2 bucket or Vercel
project is introduced. Existing PostgreSQL and communications/media
infrastructure are reused.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 079 — Garbage Service Models**, advancing historical Build 080.
