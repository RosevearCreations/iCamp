# Build 066 — Maintenance Roles, Foreman Queue & Escalation

## Status
**FULLY PROMOTED — `main` GREEN.**

## Queue authority
Active Build 066 advances the maintenance roadmap after Build 065 and implements the historical roadmap's Build 067 Maintenance Roles, Foreman Queue & Escalation capability.

## Delivered scope
- explicit permission-derived maintenance responsibility hierarchy:
  - Crew;
  - Foreman;
  - Main Foreman;
  - Manager;
- new `Maintenance Foreman` and `Maintenance Main Foreman` role templates;
- backward-compatible treatment of the existing `maintenance_lead` template as foreman-level responsibility;
- manager/owner maintenance escalation authority layered over the existing authorization model;
- assignment hierarchy enforced in PostgreSQL and reflected in Web/PWA assignee choices;
- foreman triage queue over canonical Build 065 work orders;
- campground-scoped escalation policies for:
  - Emergency priority;
  - Urgent priority;
  - Blocked work;
  - Response overdue;
  - Completion overdue;
- configurable escalation target, additional threshold, instructions and active/inactive state;
- append-oriented escalation raise, acknowledgement and resolution evidence;
- optimistic row-version conflict protection;
- audit evidence for escalation raise/acknowledge/resolve and policy changes;
- responsive foreman workspace with queue metrics, maintenance roster, policy controls and freshness state.

## Authorization model
Build 066 adds:
- `maintenance.triage` — foreman-level queue triage and escalation acknowledgement;
- `maintenance.escalate` — main-foreman/management escalation policy and resolution authority.

Responsibility is derived from active campground assignment permissions rather than stored in a second staff-authority system:
- Crew: maintenance create/complete capability;
- Foreman: `maintenance.triage`;
- Main Foreman: `maintenance.escalate`;
- Manager: staff-management plus maintenance escalation authority.

Assignment boundaries:
- Crew cannot assign work;
- Foreman may assign crew and may self-assign;
- Main Foreman may assign crew/foremen and may self-assign;
- Manager may assign any maintenance-responsible staff;
- assignment to non-maintenance staff is rejected;
- equal/higher-level assignment is rejected below manager level;
- Build 065's active-staff and campground-scope checks remain authoritative.

## Escalation defaults
Every active/new campground receives five default escalation policies:
- Emergency priority → Foreman immediately;
- Urgent priority → Foreman immediately;
- Blocked → Main Foreman immediately;
- Response overdue → Foreman at the Build 064 response target;
- Completion overdue → Main Foreman at the Build 064 completion target.

Main-foreman/management users can add a bounded additional threshold from 0 to 43,200 minutes, change the target level, update instructions, or deactivate a rule without deleting its identity.

## Security and evidence
- Build 066 reuses Build 065 work orders; it does not create a duplicate work-order model;
- escalation policy/evidence tables enable and **FORCE RLS**;
- direct `anon` and `authenticated` access is revoked;
- `icamp_app` receives only required read/update/insert operations and no DELETE;
- escalation identity and raise evidence are immutable;
- resolved escalations are terminal;
- acknowledgement is guarded by `maintenance.triage`;
- resolution and policy changes are guarded by `maintenance.escalate`;
- assignment hierarchy is enforced inside the Build 065 work-order update guard;
- Build 006 audit evidence records elevated escalation actions.

## Omnichannel contract
- Web/PWA provides the full visual foreman queue, staff responsibility roster and escalation policy editor.
- Voice/IVR/DTMF and SMS/MMS may invoke supported assignment, acknowledgement and escalation commands only through the same server-authorized domain operations.
- policy editing, long evidence and complex queue review use a verified secure-link or staff-assisted handoff instead of fake visual parity.

## Boundaries
Build 066 does **not** create:
- recurring maintenance schedules or occurrences — Build 067;
- versioned inspection templates/sign-off — later maintenance scope;
- duplicate work-order, maintenance-category or priority authorities;
- payroll, general employee scheduling or organization-wide HR hierarchy.

## Verification
- unit tests cover responsibility rank, assignment boundaries, escalation signals and threshold validation;
- static tests prove canonical Build 065 reuse, forced RLS, role/permission wiring and database assignment hierarchy controls;
- migration verification checks role templates, permission separation, five policies per active campground, forced RLS, no-delete posture and direct Data API denial;
- CI will apply the full migration history on PostgreSQL 17 and prove idempotent replay before promotion;
- final feature head `06fabfb2a9d6066eecf82b973d7b8931d96f7cbc` passed CI #39523457905, CodeQL #39523457937 and Secret Scan #39523457983;
- feature PR #246 merged to `dev` at `39e635dcb2a4261e945c7576e98e406e75569a69`;
- independent `dev` push passed CI #39523698063, CodeQL #39523683809 and Secret Scan #39523683808;
- hosted migration `20261021005246 / maintenance_roles_foreman_escalation` applied successfully and exact Build 066 verification SQL passed;
- Supabase Security Advisor returned zero findings;
- Supabase Performance Advisor returned zero Build 066 unindexed-foreign-key findings; only expected INFO-level unused-index notices remained;
- production PR #247 passed CI #39524006669, CodeQL #39524006626 and Secret Scan #39524006684;
- production feature `main` SHA `5e43374ce4b25aeb42908e2c587330caccb5fb7b` independently passed CI #39524236466, CodeQL #39524236470 and Secret Scan #39524236488;
- Verify, Browser E2E, PostgreSQL migration/lifecycle/idempotence, production build, dependency audit, CodeQL and Gitleaks were GREEN at the production feature checkpoint.

## Cost / infrastructure
No paid service, new hosted project, external provider, secret, Worker, D1 database, R2 bucket or additional Vercel project is required.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 067 — Recurring Maintenance Scheduler**, advancing the historical roadmap's Build 068 capability.
