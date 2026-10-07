# Build 012 — SMS/MMS Conversation & Command Gateway

Status: **IMPLEMENTED — PROMOTION PENDING**

## Roadmap scope

Build 012 implements:

- inbound/outbound text messaging;
- guided numbered menus and keywords;
- structured SMS commands;
- MMS/photo intake where supported;
- natural-language intent proposals that never bypass server validation;
- delivery/read/provider event history where available.

## Runtime

New messaging modules:

- `lib/messaging/commands.mjs`;
- `lib/messaging/provider.mjs`;
- `lib/messaging/postgres.mjs`.

New HTTP surfaces:

- authenticated outbound route: `/api/communications/messaging/outbound`;
- signed inbound provider webhook: `/api/communications/messaging/webhook`.

The default provider remains the free in-process mock/sandbox adapter.

## Command model

Safe navigation is available through numbered choices and keywords.

Structured site/reservation/pass commands are parsed but marked `verification_required`.

Natural-language intent may propose a command but is marked `validation_required`.

Build 012 deliberately does not make sender phone number, caller ID or a known conversation equivalent to authentication. Build 013 owns that boundary.

## Persistence

Migrations `0015_sms_mms_conversation_gateway.sql` and `0016_messaging_fk_indexes.sql` add private messaging persistence plus covering indexes for every new composite foreign key:

- messaging lines;
- active conversations;
- privacy-safe message evidence;
- MMS attachment metadata.

Raw message text is not a column in the messaging message table.

Provider-event metadata stores only normalized semantic/count evidence and explicit exclusion markers for raw bodies/payloads.

## MMS safety

Outbound MMS reuses already validated active secure-media image assets.

Inbound MMS records provider media references and safe metadata in `pending_scan` state. Provider URLs and binary payloads are not persisted in ordinary messaging history.

## Authorization

- line administration requires `communications.manage`;
- outbound messaging requires `communications.send`;
- browser-facing database roles retain no direct access to private messaging tables;
- provider webhook ingestion is a trusted signed server boundary;
- protected identifier lookups remain gated for Build 013 verification.

## Webhook security

Messaging webhooks require:

- HMAC-SHA256 signature verification;
- timestamp freshness within a bounded 30–900 second window;
- provider-key match;
- provider-event idempotency.

Webhook responses expose semantic command state but never return an entered site/reservation/pass number or raw message body.

## Delivery/read evidence

Normalized provider events can record:

- sent/submitted;
- delivered;
- read;
- failed.

The Build 009 communication dispatch remains the canonical provider-neutral delivery record.

## I.T. & Analysis

Sanitized aggregate messaging health includes:

- active/sandbox messaging lines;
- inbound/outbound messages in 24 hours;
- failed messages in 24 hours;
- validation/verification-gated commands in 24 hours;
- MMS attachments pending scan.

Message bodies and phone numbers are never displayed.

## Automated proof

New commands/tests:

- `npm test` includes `tests/messaging-gateway.test.mjs`;
- `tests/build012-repository.test.mjs`;
- `npm run messaging:verify` for real PostgreSQL lifecycle proof.

Coverage includes:

- numbered menus and keywords;
- structured command verification gates;
- natural-language validation gates;
- HMAC signature freshness;
- SMS/MMS provider normalization;
- campground permission enforcement;
- outbound idempotency;
- inbound provider-event idempotency;
- delivery/read history;
- MMS pending-scan intake;
- database proof that raw message body columns do not exist;
- database proof that a known test reservation number/message phrase does not enter provider metadata;
- Supabase-advisor-driven covering-index proof for the new composite messaging foreign keys.

## Provider/cost boundary

No real telephone number, SMS registration, provider billing account or production credential is required to verify Build 012.

A real provider remains replaceable behind the messaging adapter.

## Manual action

**None.**

## Next build

**Build 013 — Telephone/SMS Identity, Verification & Staff Re-Authentication**
