# Build 042 — Deposits, Balances & Payment Provider Adapter

Status: **FULLY PROMOTED — `main` GREEN.**

## Scope delivered

Build 042 establishes the payment boundary on top of Build 041 pending reservations and immutable accepted quotes:

- campground-configurable full, fixed-dollar and percentage booking deposits;
- configurable refundable security deposits;
- security-deposit timing with booking deposit, with remaining balance or on arrival;
- reservation balance due at booking, a configured number of days before arrival or on arrival;
- immutable reservation-specific payment-policy schedules;
- provider-neutral payment attempts with server-side idempotency;
- a free mock/sandbox payment provider adapter;
- HMAC-signed, replay-bounded provider webhook verification;
- idempotent private provider-event evidence;
- guest-visible payment progress;
- campground-management payment policy controls.
- advisor-driven composite foreign-key index coverage for payment schedules and attempts.

## Payment schedule boundary

Build 042 never rewrites the Build 041 accepted checkout quote.

When a pending reservation first enters the payment flow, iCamp snapshots the effective campground payment policy into one immutable reservation payment schedule containing:

- accepted reservation total and currency;
- booking date and arrival date;
- booking deposit;
- remaining reservation balance;
- security deposit;
- security-deposit due stage;
- balance due rule and computed due date;
- amount due at booking;
- total payable including security deposit.

If a campground has not configured a payment policy, the safe default is full reservation payment at booking with no security deposit.

Existing reservation schedules remain immutable if campground policy changes later.

## Payment provider adapter

The payment provider boundary follows the provider-neutral patterns already used for voice and messaging.

Build 042 includes a free `mock` sandbox adapter that can:

- create a provider payment reference;
- perform a deterministic sandbox capture;
- emit normalized capture events;
- exercise the same payment attempt and provider-event processing path as a future live adapter.

A non-mock provider key is treated as external and requires a separately installed adapter. No paid payment provider account or credentials are required to complete Build 042.

## Verified webhooks

`POST /api/payments/webhook`:

- requires a configured payment webhook secret;
- verifies HMAC-SHA256 over timestamp plus raw request body;
- rejects stale timestamps outside the configured bounded tolerance;
- normalizes only supported payment event types;
- verifies provider identity;
- rejects amount or currency mismatches;
- deduplicates provider events by provider key plus provider event ID;
- records only normalized metadata, never the raw webhook body or payment credentials.

The mock sandbox can complete payments internally without requiring a production webhook secret. The verified webhook route is available for provider testing and future external adapters.

## Data security

Build 042 does **not** store or request:

- raw card/PAN numbers;
- CVV/CVC values;
- magnetic-stripe/track data;
- payment-provider secret keys in campground configuration;
- raw webhook bodies.

Public payment policy, schedule and payment-attempt tables FORCE RLS.

- `campground_payment_policies` may be read/inserted/updated only through the campground configuration permission and has no application DELETE privilege.
- reservation payment schedules and payment attempts are guest-owner/staff readable but trusted-server write only.
- provider-event evidence lives in `icamp_private` and is not readable through `icamp_app`.

## Web/PWA experience

Campground management now has a Build 042 payment policy workbench for deposit, security-deposit and balance rules.

A pending guest reservation now links to a payment page that shows:

- reservation total;
- booking deposit;
- remaining balance and due date;
- security deposit and due stage;
- total including security deposit;
- captured amount;
- amount due now;
- total outstanding.

When the free mock provider is active, the guest can run **Complete sandbox payment**. The payment is recorded through the same provider-neutral payment ledger used by verified provider events.

## Channel parity

- **Web/PWA:** full payment schedule review and sandbox payment flow.
- **IVR/DTMF:** reservation/deposit/balance status can be spoken from the same canonical payment schedule. Raw card numbers, CVV values and complete payment credentials are never collected through DTMF.
- **SMS/MMS:** concise payment status plus secure-link handoff. Raw payment credentials are never requested or accepted by SMS/MMS.
- A future live provider can supply its own PCI-scoped hosted/tokenized payment experience behind the adapter without changing reservation payment policy semantics.

## Build boundary

Build 042 records payment state but intentionally leaves the reservation `pending`.

Build 043 owns:

- confirmation numbers;
- receipt/invoice records;
- email/in-app confirmation;
- printable reservation documents.

Build 045 remains responsible for cancellation refunds and adjustment safeguards.

## Platform impact

No new paid service, Vercel project, Cloudflare project, Worker, D1 database or R2 bucket is introduced.

The built-in payment adapter is free and local to the application. A future production provider is replaceable and can be added without rewriting the reservation/payment domain.


## Production promotion evidence

- Feature PR #162 promoted the complete Build 042 payment implementation into `dev`.
- The exact final feature head was `dd72e39c1f6558ec6fbde1eaabc823187fd129f4`; Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan were GREEN before merge.
- The feature implementation merged into `dev` as `5d83a18a020f39c5f8f1fc09ccc6fb90c618e4ff`, and that exact merge SHA independently passed all five push gates.
- Hosted Supabase migration `20261015012157 / deposits_balances_payment_provider` is live and Build 042 verification SQL passed.
- Hosted Security Advisor returned zero findings. The first Performance Advisor pass identified three Build-042 unindexed composite foreign keys.
- Advisor-hardening PR #163 added covering indexes and verification, passed all five PR gates, and merged into `dev` as `17b5122a23f2aa208af948e11734311a56499d03`.
- Hosted Supabase migration `20261015012647 / payment_provider_fk_indexes` is live and its verification SQL passed.
- After hardening, Security Advisor remained at zero findings and the Build-042 unindexed-foreign-key findings were closed; only the existing/new unused-index INFO class remained.
- Production PR #164 passed fresh Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan gates on exact `dev` head `17b5122a23f2aa208af948e11734311a56499d03`.
- The validated runtime payload merged to `main` as `78ff27ae929fa59e2af478c90302688039d6fa06`.
- The exact runtime production SHA independently passed Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan after merge.
