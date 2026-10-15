# Build 044 — Reservation Management Console

Status: **IMPLEMENTED — promotion gates pending.**

## Scope

Build 044 adds the staff reservation-management surface for creating and changing canonical reservations while preserving the immutable evidence produced by Builds 041–043.

Delivered scope:

- staff reservation creation;
- edit/move/extend/shorten workflows;
- accommodation changes protected by the existing live-inventory conflict trigger;
- current-rate repricing through the Build 039 pricing engine;
- add-on/pass/service-fee repricing through the Build 040 charge engine;
- cancellation that releases live inventory but never executes a refund;
- one current management-state row per reservation;
- append-only change history with before/after snapshots, financial delta and reason;
- explicit paid-change/cancellation handoff to Build 045;
- campground-scoped reservation permissions;
- Web/PWA management UI plus IVR/DTMF and SMS/MMS fallback contracts.

## Evidence boundaries

Build 044 does not rewrite:

- the accepted Build 041 checkout snapshot;
- the immutable Build 042 payment schedule or captured-payment evidence;
- Build 043 confirmation, invoice or receipt evidence.

A management revision records the new operational reservation state separately.

## Reservation creation

The management console may create a canonical pending reservation using:

- an active campground;
- an active accommodation;
- current rate plans and dynamic pricing rules;
- current automatic and optional booking charges;
- a staff-entered guest display name/contact email;
- a required operational reason.

The database live-inventory trigger remains the final concurrency/conflict authority.

Build 046 later adds walk-up, overflow and office-specific intake behavior.

## Edit, move, extend and shorten

A reservation update:

1. requires `reservation.modify`;
2. uses optimistic reservation row-version checking;
3. serializes the reservation with a transaction advisory lock;
4. validates the target accommodation;
5. recalculates current stay pricing;
6. recalculates automatic and selected optional charges;
7. updates the live reservation dates/accommodation;
8. updates the current management state;
9. appends one immutable history row;
10. writes an audit event.

The change is classified as move, extend, shorten, fees or general edit.

## Live availability signal hardening

Build 035 already prevents live inventory conflicts when `accommodation_id`, dates or active status are changed.

Build 044 adds a dedicated availability-revision trigger for accommodation-only moves so both the old and new accommodation revision counters advance and live refresh consumers do not miss the move.

## Financial review boundary

Build 044 calculates the management price delta but does not collect, refund or adjust money.

Financial review is required when:

- a managed total changes after a Build 042 payment schedule exists;
- a managed total changes after captured payment exists; or
- a reservation with captured payment is cancelled.

The ledger records:

- prior total;
- revised total;
- delta;
- captured amount at change time;
- financial-review-required flag.

Build 045 owns policy evaluation, refund/forfeit handling, approval thresholds and financial adjustment execution.

## Cancellation

Cancellation requires `reservation.cancel`.

Build 044:

- changes the canonical reservation to `cancelled`;
- releases it from active availability;
- preserves all earlier quote/payment/document evidence;
- appends a cancellation history record;
- audits the action;
- flags captured money for Build 045 review.

It explicitly records `refundExecuted: false`.

## Change history

`public.reservation_change_history` is append-only.

Each row contains:

- per-reservation sequence number;
- change kind;
- source channel;
- required reason;
- immutable before/after snapshots;
- previous/revised totals and delta;
- captured amount;
- financial-review flag;
- idempotency key;
- actor and timestamp.

Application roles receive SELECT/INSERT only. UPDATE/DELETE are denied and a defensive database trigger rejects direct mutation.

## Current management state

`public.reservation_management_state` stores the current staff-managed projection:

- guest display/contact;
- currency;
- stay subtotal;
- charge total;
- current total;
- optional charge selections;
- source quote kind;
- financial review state.

Existing Build 041 reservations can be managed without modifying their original checkout rows.

## Authorization

- list/read: reservation read/create/modify/cancel authority;
- create: `reservation.create`;
- edit/move/extend/shorten/fees: `reservation.modify`;
- cancel: `reservation.cancel`.

Both Build 044 tables FORCE RLS.

## Channel parity

- **Web/PWA:** full create/edit/move/extend/shorten/fees/cancel/history experience.
- **IVR/DTMF:** verified staff may use concise canonical reservation commands; multi-field move/repricing review uses staff-assisted visual fallback.
- **SMS/MMS:** verified staff may use concise status/action workflows with secure-link fallback for complex repricing/history review.

No channel bypasses authentication, campground authorization, availability conflict checks or the Build 045 financial boundary.

## Cost and portability

No new paid provider or hosting resource is introduced.

Build 044 uses the existing PostgreSQL database, Next.js application, pricing engine, booking-charge engine, authorization layer and audit ledger.
