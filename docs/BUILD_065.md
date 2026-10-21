# Build 065 — Work Order Engine

## Status
**FULLY PROMOTED — `main` GREEN.**

## Queue authority
Active Build 065 advances the maintenance roadmap after Build 064 and implements the historical roadmap's Build 066 Work Order Engine capability.

## Delivered scope
- canonical campground-scoped maintenance work orders;
- direct reuse of Build 064 maintenance categories and priority policies;
- optional section, operational-asset, accommodation and free-text location targeting;
- campground priority targets copied into response/completion due timestamps at work-order creation;
- assignment to currently active campground staff;
- lifecycle states: Open, Assigned, In Progress, Blocked, Completed and Cancelled;
- controlled lifecycle transitions with terminal completion/cancellation;
- optimistic row-version conflict protection;
- append-only status transition history;
- append-only maintenance notes;
- secure-media evidence links that reuse Build 008 metadata/storage rather than duplicating files;
- append-only material usage and labour time;
- mandatory completion summary and completion actor/time evidence;
- cancellation reason and actor/time evidence;
- responsive maintenance work-order workspace with campground selection, queue metrics, create/assign/status/evidence controls and freshness state.

## Security and authorization
Build 065 reuses the existing maintenance permission catalogue:
- `maintenance.read` — read work orders and evidence;
- `maintenance.create` — create work orders;
- `maintenance.assign` — assignment and non-completion lifecycle transitions;
- `maintenance.complete` — completion authority.

Database controls:
- all six new public tables enable and **FORCE RLS**;
- direct `anon` and `authenticated` table access is revoked;
- the trusted `icamp_app` role receives only the minimum required operations;
- no Build 065 table grants DELETE to `icamp_app`;
- status-transition rows are not directly insertable by `icamp_app` and are written only by the canonical server transaction;
- append-only note/media/material/labour records have no UPDATE or DELETE grant;
- evidence creator/recorder columns must match transaction-local `icamp.user_id`;
- work-order assignment changes are database-protected by `maintenance.assign`;
- work-order completion is database-protected by `maintenance.complete`;
- completed/cancelled work orders are terminal and cannot be reassigned;
- the assigned worker must have a current active staff assignment to the same campground.

## Canonical references
Build 065 does not create duplicate maintenance or media authorities:
- category FK → `public.maintenance_categories` from Build 064;
- priority FK → `public.maintenance_priority_policies` from Build 064;
- media evidence FK → `icamp_private.media_assets` from Build 008;
- section/location targets reuse the campground structure;
- accommodation targets reuse `public.accommodations`;
- operational asset targets reuse `public.operational_assets`;
- audit evidence reuses the Build 006 append-only audit trail.

## Work-order lifecycle
Supported state flow:
- Open → Assigned / In Progress / Cancelled;
- Assigned → Open / In Progress / Blocked / Cancelled;
- In Progress → Assigned / Blocked / Completed / Cancelled;
- Blocked → Assigned / In Progress / Cancelled;
- Completed and Cancelled are terminal.

Starting work without a pre-existing assignee assigns the acting maintenance staff member. Entering In Progress or Completed records first-response evidence when it has not already been recorded.

## Secure media
Build 065 stores only a link to an existing active, validated, internal Build 008 secure-media asset. It does not create a second upload/storage layer and does not make maintenance evidence public.

## Omnichannel contract
- Web/PWA provides the full visual work-order board.
- Voice/IVR/DTMF and SMS/MMS must invoke the same server-authorized work-order commands for supported structured actions.
- graphical/media selection is explicitly handled through secure-link or staff-assisted handoff rather than fake keypad parity;
- raw file contents, media object keys and sensitive storage identifiers are not exposed through public channel flows.

## Boundaries
Build 065 does **not** create:
- maintenance crew/foreman triage hierarchy or escalation queues — Build 066;
- recurring hourly/daily/weekly/monthly/seasonal schedules — a later build that reuses Build 007;
- inspection-template versioning/sign-off;
- inventory procurement or fleet preventive-maintenance schedules.

## Verification
- core unit tests cover lifecycle transitions, invalid terminal transitions, target requirements, material/labour validation and completion evidence;
- static tests prove reuse of Build 064 taxonomy/priority authorities and Build 008 secure media;
- migration verification checks all six tables, forced RLS, no-delete posture, direct Data API denial and canonical cross-build FKs;
- CI database jobs apply the migration on PostgreSQL 17, run the full verification suite and re-run migration history for idempotence;
- feature PR #242 passed CI #39518867672, CodeQL #39518867643 and Secret Scan #39518867580 at final feature head `dfc3c2523f2bc6bac9d406a6002a481b35460e9e`;
- initial `dev` merge `a5baa186161c0b05eb08800f503eef4ba7f3c6d7` passed independent CI #39519090950, CodeQL #39519090975 and Secret Scan #39519090650;
- hosted migration `20261021000714 / maintenance_work_order_engine` applied successfully and exact Build 065 verification SQL passed;
- hosted Supabase Security Advisor returned zero findings;
- the initial 11 INFO-level Build 065 unindexed scoped foreign-key findings were corrected by advisor-hardening PR #243;
- hardening head `9dc6a7486b7192ef17608df26a055c9398b3a69f` passed CI #39519441379, CodeQL #39519441348 and Secret Scan #39519441347;
- hardened `dev` candidate `32e5b32b209a929765ff34caff3a8726b415dbe8` passed independent CI #39519712637, CodeQL #39519712827 and Secret Scan #39519712614;
- hosted hardening migration `20261021001253 / build065_advisor_hardening` and exact verification SQL passed;
- post-hardening Supabase Security Advisor remained at zero findings and Build 065 unindexed-foreign-key findings were reduced to zero; only project-wide INFO-level unused-index notices remained;
- production PR #244 passed CI #39519987876, CodeQL #39519987877 and Secret Scan #39519987898;
- production feature `main` SHA `3cdbcf01b1591f2da7b3f3db1f83026dab4b5bc2` passed independent CI #39520285693, CodeQL #39520285652 and Secret Scan #39520285684;
- Verify, Browser E2E, PostgreSQL migration/lifecycle/idempotence, production build, dependency audit, CodeQL and Gitleaks were GREEN at the production feature checkpoint.

## Cost / infrastructure
No paid service, new hosted project, external provider, secret, Worker, D1 database, R2 bucket or additional Vercel project is required.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 066 — Maintenance Roles, Foreman Queue & Escalation**, advancing the historical roadmap's Build 067 capability.
