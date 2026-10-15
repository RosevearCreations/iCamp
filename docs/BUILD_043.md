# Build 043 — Confirmations, Receipts & Reservation Documents

Status: **FULLY PROMOTED — `main` GREEN.**

## Scope

Build 043 turns a Build 041 pending reservation plus Build 042 payment evidence into durable guest-facing reservation documents without rewriting either source of truth.

Delivered scope:

- deterministic guest-facing confirmation numbers;
- one immutable confirmation record per reservation;
- one immutable invoice snapshot per reservation;
- one immutable receipt per captured Build 042 payment;
- booking confirmation only when the Build 042 booking-time payment obligation is satisfied;
- reservation state transition from `pending` to `confirmed`;
- in-app confirmation and document review;
- printable reservation document view;
- transactional confirmation-email dispatch through the existing provider-neutral communications domain;
- free mock communications-provider completion in development;
- secure Web/PWA, IVR/DTMF and SMS/MMS channel boundaries.

## Confirmation rule

Build 043 does **not** require the entire reservation balance to be paid before confirmation.

The reservation may become `confirmed` when the immutable Build 042 schedule's `booking_due_cents` amount has been satisfied by captured payments.

This means:

- a full-payment-at-booking policy requires the full booking-time amount;
- a fixed or percentage deposit policy confirms after that booking-time obligation is captured;
- a later balance due date does not block confirmation;
- an arrival-stage security deposit does not block confirmation;
- a security deposit configured as due with the booking deposit remains part of `booking_due_cents` and therefore must be satisfied before confirmation.

The confirmation rule reads Build 042 evidence; it does not recalculate or rewrite the payment policy.

## Immutable documents

### Confirmation

One confirmation is stored per reservation with:

- confirmation number;
- reservation and payment-schedule linkage;
- accepted reservation total and currency;
- booking-time amount due;
- amount captured at confirmation;
- security deposit;
- balance due date;
- immutable document snapshot;
- confirmation timestamp.

### Invoice

One invoice is stored per reservation with:

- invoice number;
- accepted Build 041 reservation amount;
- refundable security deposit shown separately;
- total payable from the Build 042 schedule;
- immutable snapshot referencing the confirmation.

The invoice does not invent tax rates or change Build 041 pricing.

### Receipts

Each captured Build 042 payment can create exactly one receipt.

A receipt records:

- deterministic receipt number;
- captured payment ID;
- payment purpose;
- amount and currency;
- provider key/reference evidence;
- capture timestamp;
- explicit raw-payment-credential exclusion.

Later captured balance/security-deposit payments add new receipts without rewriting earlier receipts.

## Email & in-app confirmation

The in-app document surface is the canonical guest-accessible confirmation copy.

Build 043 reuses the existing private communications foundation for transactional email:

- creates/reuses the reservation contact email endpoint;
- creates one idempotent outbound `email` / `transactional` dispatch per reservation confirmation;
- references the reservation-confirmation record instead of storing unrestricted document bodies in dispatch metadata;
- uses the free `mock` communications provider during development;
- leaves non-mock delivery queued for a separately configured external provider adapter.

No paid email provider is required for Build 043.

## Printable view

The protected printable route renders:

- confirmation number;
- campground/site/cottage and stay dates;
- guest identity;
- invoice values;
- balance due date;
- all captured-payment receipts.

The browser print function is used; no PDF-generation service is introduced.

## Data security

Build 043 public document tables:

- enable and FORCE RLS;
- grant `icamp_app` SELECT only;
- have no `icamp_app` INSERT, UPDATE or DELETE privilege;
- restrict reads to the reservation guest owner or authorized campground reservation staff;
- preserve trusted-server-only document creation.

The document domain does not store raw PAN/card numbers, CVV/CVC, track data, provider secrets or raw payment webhook bodies.

## Channel parity

- **Web/PWA:** full confirmation, invoice, receipts, transactional email state and printable document view.
- **IVR/DTMF:** confirmation number, stay dates and concise payment/balance status may be spoken from canonical records. Visual document review uses secure-link or staff-assisted fallback.
- **SMS/MMS:** concise confirmation status plus secure-link handoff; sensitive document contents are not serialized into message bodies.
- **Email:** provider-neutral transactional dispatch referencing the canonical confirmation record.

No channel bypasses authentication, reservation ownership, campground authorization or the Build 042 payment requirement.

## Build boundaries

Build 043 does not implement:

- staff reservation editing/moves/extensions/shortening/cancellation — Build 044;
- cancellation/refund/financial-adjustment safeguards — Build 045;
- reusable guest profiles/history UX — Build 048;
- front-desk check-in — Build 049.

## Platform impact

No new Vercel project, Cloudflare project, Worker, D1 database, R2 bucket or paid provider is added.

The implementation uses the existing PostgreSQL database, communications foundation and free mock communications provider.


## Release evidence

- Feature PR: **#167**.
- Exact feature head accepted into `dev`: `c84f00a39b40d27dd26184929e1f4a7c15890e7d`.
- Exact merged `dev` SHA: `a434a8fa270220822ea2a578ad7c8589c361072a`.
- Production promotion PR: **#168**.
- Runtime production `main` SHA: `a98457e72863c61f9a4b9dd4973170c4a8522052`.
- Hosted Supabase migration: `20261015025538 / confirmations_receipts_reservation_documents`.
- Hosted Build 043 verification passed.
- Supabase Security Advisor: **0 findings**.
- Supabase Performance Advisor: no Build-043 WARN findings; only the existing `unused_index` INFO class.
- Exact merged `dev` and runtime production `main` independently passed Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan.
- No manual provider or deployment action was required.
