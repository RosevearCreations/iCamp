# Build 050 — Check-Out & Accommodation Turnover Trigger

Status: **IMPLEMENTED — promotion status is determined by exact GitHub and hosted-database gates.**

## Purpose

Build 050 creates the canonical departure checkpoint between an occupied reservation and post-stay accommodation operations. It completes the existing reservation, preserves unresolved financial/return follow-up, and triggers the appropriate cleaning/inspection handoff without creating parallel reservation or maintenance models.

## Delivered

- campground-scoped Front Desk departure queue for checked-in and recent completed stays;
- immutable checkout evidence linked to the Build 049 check-in record;
- live reservation balance, captured-payment and financial-review snapshot;
- unresolved charges preserved as explicit finance follow-up rather than blocking physical departure or being treated as paid;
- rental, physical-key and access-credential return status with unresolved follow-up evidence;
- canonical reservation transition from `checked_in` to `completed`;
- server-authoritative accommodation transition into the safe post-departure inspection path;
- automatic reuse or creation of the existing Build 027 cottage `departure` turnover when exactly one active template is configured;
- immutable Build 027 checklist snapshot creation for automatically triggered cottage turnover;
- explicit cottage configuration-required handoff when no single active departure template is available;
- campsite/other accommodation inspection handoff without inventing Build 074 cleanup tasks prematurely;
- optimistic reservation concurrency plus advisory locking and idempotent checkout;
- append-only `public.reservation_check_outs` with forced RLS and direct API-role denial;
- Web/PWA operator surface at `/workspaces/management/campgrounds/reservations/check-out`.

## Financial safety

Checkout does not erase, waive or imply payment of an unresolved balance. When current captured payments are below expected payable or Build 044 financial review remains active, the operator must explicitly acknowledge finance follow-up. The immutable checkout row preserves the outstanding amount and review state for later resolution.

No raw payment-card details are collected or stored.

## Return safety

Build 050 captures operational return status for rentals, physical keys and access credentials. If Build 049 recorded rental or credential handoffs, checkout cannot mark that category `not_applicable`.

These return states are departure evidence only:
- Build 063 remains the authority for canonical credential revocation/expiry/lost-replacement lifecycle.
- later rental/POS domain builds remain the authority for canonical rental inventory, charges and loss/damage settlement.

## Turnover behavior

For rental cottages:
1. reuse an unresolved Build 027 departure turnover if one already exists;
2. otherwise, when exactly one active departure template exists, create the Build 027 turnover and checklist snapshot automatically;
3. otherwise record `cottage_configuration_required` so checkout completes without silently choosing an ambiguous template.

For campsites and other accommodation types, Build 050 moves the accommodation into the inspection path and records `inspection_required`. Build 074 remains responsible for campsite-specific cleanup/inspection tasks and any configured rebooking block until cleared.

Existing `maintenance`, `winterized` and `closed` accommodation states are protected rather than overwritten by checkout.

## Channel parity

- **Web/PWA:** full departure queue, balance/return verification, reservation completion and turnover/inspection handoff.
- **IVR/DTMF:** verified staff may use concise departure and return-status confirmation through the same server service; complex unresolved financial/return review falls back to authenticated Web/PWA.
- **SMS/MMS:** verified staff receives concise checkout status and secure-link handoff; sensitive financial detail is not echoed before verification.

## Database

Migration: `database/migrations/0063_check_out_accommodation_turnover.sql`.

Verification: `database/verify/0063_check_out_accommodation_turnover.sql`.

Primary table:
- `public.reservation_check_outs`.

Existing Build 027 tables remain canonical for cottage housekeeping:
- `public.cottage_turnovers`;
- `public.cottage_turnover_item_checks`.

## Cost / provider impact

No new paid service, Vercel project, Cloudflare resource, communications provider or external API is introduced by Build 050.

## Next build

**Build 051 — My Stay Guest Portal**
