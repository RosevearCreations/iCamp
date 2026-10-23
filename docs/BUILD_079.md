# Build 079 — Garbage Service Models

Status: **IMPLEMENTED — production promotion pending**.

## Queue authority

Build 079 advances the historical roadmap's Build 080 after the Build 078
camper-assistance workflow. The next planned build is **Build 080 — Paid Garbage
Stickers/Tags & Pickup Redemption**, advancing historical Build 081.

## Delivered

- Standard garbage, recycling and organics service streams.
- Four independently configurable service models for each stream:
  central bins, included site pickup, scheduled site pickup and paid on-demand.
- Central bin instructions/location; configured weekday for scheduled pickup;
  Canadian-cent pricing for on-demand pickup.
- Campground-scoped availability, permissions and optimistic configuration
  version checks.
- Authenticated Maintenance → Garbage services workflow with accessible
  labels, information-circle contextual help, site selection and status queue.
- Pickup requests with enabled-policy validation, exact campground/site checks,
  client UUID retry safety and immutable fee/mode snapshots.
- Requested → scheduled → in progress → completed state machine, with
  cancellation before completion and terminal-state immutability.
- Append-only pickup event ledger and database-enforced transitions/versioning.
- Forced RLS, application-role-only Data API access, and explicit narrow
  accommodation read for waste dispatchers.
- Repository unit, SQL-schema, privacy and UI contract tests.

## Critical ownership boundaries

- The canonical campground/accommodation/reservation records remain the site
  and stay authorities.
- The existing maintenance-work-order model remains separate; garbage pickup
  requests do not silently fabricate maintenance tasks.
- The fee is a **quote snapshot**, not a charge or receipt. Paid on-demand
  pickups receive `pending_checkout`; completion of the physical service does
  not claim payment succeeded. Billing/receipt fulfillment must use the
  existing canonical payment workflow, with no fictitious provider event.
- Build 080 owns sticker/tag sales, optional serialized redemption, associated
  financial evidence and any billable redemption integration.

## Scheduling boundary

Build 079 records the configured weekday for a scheduled service and allows
staff to schedule individual pickup requests. It does not create duplicate
recurrence jobs or automatically charge guests. Automatic route generation
may later be coordinated with the canonical Build 067 scheduler and is not
misrepresented as active in this build.

## Omnichannel and theme contract

Web/PWA provides full configuration and dispatch. Phone and SMS must hand
off long-form configuration or visual site choice to the authenticated Web/PWA
workflow; future guided commands must reuse the same canonical records and
permission checks. Existing semantic UI tokens are retained; no new theme fork.

## Database changes

- `database/migrations/0103_garbage_service_models.sql`
- `database/verify/0103_garbage_service_models.sql`
- `database/migrations/0104_build079_advisor_hardening.sql`
- `database/verify/0104_build079_advisor_hardening.sql`
- `database/migrations/0105_build079_rls_initplan_hardening.sql`
- `database/verify/0105_build079_rls_initplan_hardening.sql`

## Verification and release

- Local formatting, lint, TypeScript and 115+ repository tests;
- local production Next.js build;
- hosted migration/verification dry-run within a rolled-back transaction;
- apply hosted migration and rerun Security/Performance Advisors;
- feature PR → exact `dev` verification → production PR → independent `main`
  verification and live route smoke check.

Production evidence must be appended only after those final steps succeed.
