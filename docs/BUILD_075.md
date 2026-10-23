# Build 075 — Preventive Maintenance Program

Status: **IMPLEMENTED — promotion pending**

Build 075 advances historical Build 076 by turning the existing asset, recurring-maintenance and work-order foundations into one preventive-maintenance program for campground facilities and equipment.

## Delivered

- reusable immutable preventive-maintenance service templates for facilities, equipment or either asset class;
- explicit asset-to-template-to-recurring-schedule program bindings;
- exact canonical-asset validation so a preventive program cannot silently target a different asset than its Build 067 schedule;
- service intervals remain owned by Build 067 recurring schedules instead of adding a second timer or queue;
- overdue visibility from the canonical schedule's next occurrence;
- service history from Build 067 schedule occurrences and Build 065 canonical maintenance work orders;
- parts/material cost history from `maintenance_work_order_materials`;
- labour-minute history from `maintenance_work_order_labor`;
- template/program activation controls with optimistic row-version checks;
- forced RLS, direct Data API revocation and minimum `icamp_app` privileges;
- a dedicated Maintenance Web/PWA workspace for template, program, due-date and service-history review;
- no duplicate asset registry, recurrence engine, work-order completion state, parts ledger or labour ledger.

## Authority boundaries

Build 075 deliberately reuses:

- Build 029 for canonical facility/equipment assets and equipment meter snapshots;
- Build 065 for maintenance work orders, completion evidence, materials and labour;
- Build 066 for maintenance responsibility, assignment and escalation;
- Build 067 for service intervals, durable scheduling and occurrence history.

A preventive template is an immutable service instruction definition. If its instructions change, operators deactivate it and create a replacement so historical service context remains interpretable.

A preventive program binds one canonical asset, one preventive template and one asset-targeted recurring schedule. Program definition changes likewise use deactivate-and-replace semantics.

## Database

Migration:

- `database/migrations/0096_preventive_maintenance_program.sql`

Verification:

- `database/verify/0096_preventive_maintenance_program.sql`

The migration adds:

- `maintenance.preventive` elevated permission;
- `preventive_maintenance_templates`;
- `preventive_maintenance_programs`;
- exact asset/template/schedule binding guards;
- immutable template and program definition guards;
- forced RLS and explicit public/anon/authenticated revocation.

No duplicate service-event or completion table is created. Service history is derived from existing schedule occurrences and work orders.

## Application

New service:

- `lib/preventive-maintenance/postgres.mjs`

New Maintenance workspace:

- `/workspaces/maintenance/preventive`

The workspace provides:

- campground-scoped facility/equipment inventory;
- preventive service-template creation;
- exact asset/template/schedule program binding;
- current recurrence and next-service due date;
- overdue preventive-work visibility;
- canonical work-order status and completion summaries;
- itemized parts/material usage and costs;
- labour-minute history;
- direct handoff to recurring schedules and the work-order board.

## Omnichannel

- **Web/PWA:** full template, program, due-date, parts and labour review.
- **IVR/DTMF:** verified staff may receive concise next-service, overdue and open-work status; template editing and detailed evidence fall back to secure Web/PWA.
- **SMS/MMS:** verified staff may receive concise preventive-maintenance status and secure-link handoff; detailed parts/labour evidence and configuration stay in authenticated Web/PWA.

## Theme prerequisite

The Build 068 standard multi-theme semantic-token ruleset remains binding. Build 075 adds no one-off visual theme authority.

## Cost / infrastructure

No paid service, new hosted project, Worker, D1 database, R2 bucket, Vercel project or new secret is required.

## Promotion evidence

Promotion evidence will be filled in only after exact feature, `dev`, hosted database, `main` and closeout checks complete successfully.

## Next build

After successful Build 075 promotion: **Build 076 — Offline Maintenance Workspace**, advancing historical Build 077.
