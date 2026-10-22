# Build 074 — Cottage Housekeeping & Turnover

Status: **IMPLEMENTED — promotion pending**

Build 074 advances historical Build 075 by carrying the existing Build 027 rental-cottage housekeeping model through final versioned inspection, corrective-work reconciliation and canonical availability release.

## Delivered

- keeps Build 027 as the canonical cottage cleaning, linen, inventory and initial damage/security readiness model;
- links active departure-housekeeping templates to active published Build 068 cottage inspection templates for the same cottage;
- records append-only lineage from a cottage turnover to each final Build 068 inspection occurrence;
- starts final inspection only after required inventory checks are complete, checklist issues are clear and the latest Build 027 housekeeping/damage readiness inspection passes;
- reuses Build 068 failed-item handling so corrective actions become canonical Build 065 maintenance work orders instead of a duplicate issue system;
- requires a signed-off final inspection and zero open corrective work before turnover release;
- releases the cottage back to canonical Build 030 `available` status only after the Build 074 release marker is committed;
- adds a database guard preventing `inspection -> available` while a release-required cottage turnover remains unreleased;
- preserves compatibility for pre-Build-074 turnovers already `ready` or `cancelled`;
- adds a Maintenance workspace for final-inspection configuration, turnover readiness, corrective-work status and release;
- keeps the Build 068 standard multi-theme semantic-token prerequisite binding for future graphical/style work.

## Authority boundaries

Build 074 does not create a second housekeeping, inspection, maintenance or booking-state system.

It deliberately reuses:

- Build 027 for cottage housekeeping templates, linen/inventory snapshots, turnover records and initial damage/security readiness evidence;
- Build 030 for canonical accommodation status and availability;
- Build 050 for checkout-to-cottage-turnover handoff;
- Build 065 for maintenance work orders and corrective-work completion;
- Build 068 for versioned inspection templates, checklist results and sign-off.

## Database

Migration:

- `database/migrations/0095_cottage_housekeeping_turnover_operations.sql`

Verification:

- `database/verify/0095_cottage_housekeeping_turnover_operations.sql`

The migration adds:

- `cottage_housekeeping_templates.final_inspection_template_id`;
- `cottage_turnovers.release_required`;
- `cottage_turnovers.released_at`;
- `cottage_turnovers.released_by_user_id`;
- append-only `cottage_turnover_inspection_evidence`;
- same-cottage inspection-template validation;
- canonical accommodation availability release protection;
- forced RLS and minimum application-role privileges.

Hosted migration and advisor evidence will be recorded after the verified `dev` candidate reaches the database gate.

## Application

New service:

- `lib/cottage-turnover-operations/postgres.mjs`

New Maintenance workspace:

- `/workspaces/maintenance/cottage-turnover`

The workspace provides:

- campground-scoped cottage turnover status;
- departure-housekeeping to final-inspection configuration;
- linen/inventory and initial housekeeping/damage readiness;
- final inspection and sign-off status;
- linked corrective-work counts;
- explicit release only when all canonical authorities are clear.

## Omnichannel

- **Web/PWA:** full visual linen, inventory, housekeeping, damage, inspection and release workflow.
- **IVR/DTMF:** verified staff may receive concise turnover, inspection and release status; visual evidence decisions fall back to secure Web/PWA.
- **SMS/MMS:** verified staff may receive concise status and secure-link handoff; photos, detailed damage evidence and sign-off remain in authenticated Web/PWA.

## Cost / infrastructure

No paid service, new hosted project, Worker, D1 database, R2 bucket, Vercel project or new secret is required.

## Promotion evidence

Promotion evidence will be filled in only after exact feature, `dev`, hosted database, `main` and closeout checks complete successfully.

## Next build

After successful Build 074 promotion: **Build 075 — Preventive Maintenance Program**, advancing historical Build 076.
