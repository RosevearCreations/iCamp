# iCamp Build 268 — Original Database Reconciliation, Guest Confirmation Recovery & Shell

Source reviews: **Yard Workers and iCamp Shell Review (20 November 2026)**,
iCamp pages 4–5 and common controls pages 6–7; **Rosevear Source of Value Expanded**,
IC06–IC15 and IC21–IC25. Requirements are targets unless explicitly verified.

## Ownership boundary
- **Rosevear Shell**: service uptime, booking stage and failure counts, last source signal,
  escalation owner, SLA backlog, release/migration/restore evidence. No guest details,
  booking modification, tenant bank ledger, or refund capability.
- **Camp Rosevear**: sites, maps, events, rentals, guest cases, reservation changes,
  receipts, confirmations, provider transaction reconciliation, guest follow-up.
- **Guest**: correct campground booking confirmation or an authorized refund outcome.
  Preserve consent and privacy across tenants.

## Baseline checked in source
- Build 265: private support intake, guest safety/custody and local operations navigation.
- Build 266: response targets calculated from original case timestamps; no staffed guarantee.
- Build 267: protected owner assignment, escalation, signed-source telemetry admission and
  consent. Source deployment does NOT establish that original production migrations exist
  or that a real signed source has been enrolled.
- Build 043: unique reservation confirmation, receipt per captured payment, idempotent
  confirmation communications dispatch. The original 042/043 checkout financial history
  stays in the **campground's own system**.

## Build 268 implementation
1. Read-only runtime DB reconciliation against **actual DATABASE_URL** with independent
   `ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST` pin, version history for 0241–0243 and
   scoped Camp Rosevear status. Neither host nor connection secret is returned.
2. Tenant-only booking triage against original reservation, booking payment schedules,
   internally captured payment rows, provider event receipts, confirmation, receipt and
   email dispatch. Provider event rows do NOT independently prove settlement. Hold
   and site conflict verification stays unverified until checked against original allocator.
3. Database migration 0243: tenant-linked recovery case, next update, original case and
   reservation FK, immutable staff evidence events and explicit guest follow-up before
   a staff-attested closure. No auto rebooking, double capture, refund or email resend.
4. MFA-only Sysop support command page shows **aggregate** recovery and SLA status
   without guest/provider/payment details.
5. Deduplicated SLA outbox `(case_id,alert_tier)`; a bearer-authenticated internal
   scheduler endpoint can enqueue notices on expired first-review deadlines.
   **Queued is NOT delivered**. No external notification until a verified recipient,
   consent/policy, Comms Hub transport, scheduler configuration and independent ACK.
6. A deterministic **rehearsal-only** Camp Rosevear case tests the paid-but-not-confirmed
   recovery stages. The scenario is not a real payment, guest or site allocation.

## Guest paid, no confirmation — acceptance protocol
1. Create a real tenant-private case, confirm user authorization and associate only
   that campground's original reservation.
2. Compare payment schedule, immutable captured event, provider event ID, independent
   processor settlement and original idempotency key.
3. Compare site-night hold expiry, original assigned site and concurrent allocation
   under an operator-approved inventory decision. An expired hold is not silently revived.
4. Confirm exactly one reservation, one funding event, receipt and message dispatch.
   Reuse original dispatch key; do not generate a new payment or second booking.
5. Record guest-visible outcome and contact receipt at the campground. Verify that
   guest saw confirmation **or** finance approved and reconciled an original refund.
   Closure in this build records staff attestation, not external settlement certification.
6. Reopen the same case on renewed complaint; preserve previous status and evidence.

## Evidence and acceptance status
- The linked Supabase project named `iCamp` was read-only inspected and contains a
  Camp Rosevear row with lifecycle `inactive`. Its expected `icamp_private` schema
  and `icamp_meta` migrations were absent at that observation. It MUST NOT be
  presumed to be the original Vercel runtime DB. Do not modify that environment until
  the real host is independently matched.
- Original migration 0243 must be applied to the **actual, authorized, original** DB,
  with verified checksum, protected backup, migration replay and independent restore.
- Camp Rosevear may be used for synthetic tenant test data **after** its intended
  environment is identified and its owner enables a supervised pilot.
- Signed live telemetry must have source consent, HMAC custody, valid first sample,
  replay negative test, stale-state detection and recovered sample.
- External SLA notification transport must show receipt and recipient ACK; do not claim
  email or SMS sent based solely on the outbox.
- Do not call end-to-end support/financial/backup production GREEN on CI alone.

## Shell review gaps and future build priority
| Rank | Target | Current evidence | Next acceptance |
|---|---|---|---|
| P0 | Original production DB + recovery | Source checks and ephemeral CI only | Independently pin DB, migrate, restore isolated backup, get witnessed receipt |
| P0 | Real guest payment-confirmation journey | Read-only triage + staff audit + rehearsal | Supervised test payment under test processor, one booking, real email and acknowledgment |
| P0 | SLA communications | Deduped queue + protected scheduler API | Configure cron, recipient verification, Comms Hub signed transport, delivery/retry ACK |
| P1 | Real booking funnel telemetry | Build 267 signed counters; no enrolled source proved | Camp Rosevear opt-in real probe, last known good, stale/degraded/recovered state |
| P1 | Site booking health | Original checkout/availability code exists | Alert on hold expiry, blocked confirmation and allocation collision |
| P1 | Tenant self-service | Local operations links exist | Verify rental publish, event change, maintenance block and second-tenant isolation |
| P1 | Guest-facing status / case close | Private event records and existing documents | Confirm guest sees mail in its inbox and closure reopens correctly |
| P2 | Seasonal lifecycle and accessibility | Partial source capabilities | Off-season pause, reopening smoke, Meadow narrow-screen screen-reader acceptance |
| P2 | Financial reporting | Separate tenant ledger | Verify folio, deposit, tax, payout, refund and month-end reconciliation |

**Next proposed Build 269 — Supervised Camp Rosevear Provider/Test-Mode Enrollment,
Live Checkout/Confirmation Pilot, Verified Comms Hub SLA Delivery & Production Recovery Witness.**
Do not use a build number for an unverified cosmetic fragment. Publish evidence
status per capability: source, rehearsal, production and independently accepted.
