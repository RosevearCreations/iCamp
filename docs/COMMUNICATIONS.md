# Omnichannel Communications Foundation

## Purpose

Build 009 establishes one provider-neutral communications domain shared by Web/PWA, voice, DTMF, speech, SMS/MMS, email and push.

No provider owns campground business logic. Later voice, IVR, SMS/MMS and notification builds plug adapters into this domain.

## Canonical channel vocabulary

The foundation recognizes:

- `web`;
- `voice`;
- `dtmf`;
- `speech`;
- `sms`;
- `mms`;
- `email`;
- `push`.

Voice, DTMF and speech are separate interaction modes over the telephone domain because they have different input and security behavior.

## Purpose classification

Every communication dispatch is classified as:

- `transactional` — tied to a user-requested transaction or account workflow;
- `operational` — campground/staff/service operations;
- `marketing` — promotional/commercial communication.

This classification exists now so future delivery adapters cannot accidentally treat promotional traffic as ordinary operations.

Build 014 adds the jurisdiction/compliance-specific STOP/START/HELP engine and provider synchronization. Build 009 deliberately does not pretend that a generic consent row alone is a complete CASL/commercial-messaging compliance program.

## Private endpoint registry

`icamp_private.communication_endpoints` stores delivery endpoints in the private schema.

Endpoint values may include phone numbers, email addresses, push destinations or web destinations. They are sensitive contact data.

Rules:

- browser-facing database roles have no direct access;
- raw endpoint values do not appear in I.T. health, audit snapshots or public diagnostics;
- safe display hints may be used for operator confirmation;
- caller ID/phone ownership is not authentication;
- endpoint verification is evidence about reachability/ownership only, never campground authorization.

## Preferences and consent evidence

`communication_preferences` stores current purpose/channel preferences.

`communication_consents` is append-only evidence. New evidence is appended rather than rewriting history.

Purpose and channel are separate so a person may, for example, allow operational SMS while disabling marketing SMS.

Build 014 extends this with compliance rules and provider STOP/START/HELP synchronization.

## Dispatch and provider attempts

`communication_dispatches` is the provider-neutral delivery/call work record.

It stores metadata, not ordinary raw message bodies or call audio/transcripts.

Key conventions:

- per-campground idempotency key;
- bounded maximum attempts;
- explicit queued/submitted/delivered/failed/cancelled state;
- sanitized short error code/summary;
- retry scheduling metadata;
- purpose and channel are immutable business classifications for a dispatch.

`communication_attempts` records bounded provider attempts.

Retryable failures use exponential backoff starting at 30 seconds and capped at one hour.

The Build 007 job queue remains the canonical future execution substrate. Side-effecting provider workers must use both job idempotency and communication dispatch/provider idempotency.

## Provider events

`communication_provider_events` stores normalized append-only event evidence.

Provider event IDs are unique per provider so webhook/event retries cannot create duplicate evidence.

Never store in event metadata:

- raw webhook request bodies;
- webhook signatures/secrets;
- passwords/tokens/API keys;
- payment card data;
- MFA/PIN/DTMF verification secrets;
- unrestricted message bodies;
- call recordings or transcripts by default.

Build 010 adds signed voice-provider webhook verification. Build 011 adds DTMF provider events using digit-free normalized metadata. Build 012 adds SMS/MMS provider event processing. All reuse this normalized event ledger.

## Provider abstraction

`lib/communications/provider.mjs` defines the current provider boundary.

Development defaults to the free in-process `mock` provider. No phone number, SMS registration, billing account or production credential is required for Build 009.

A real provider adapter may later supply voice/SMS/email/push capabilities while preserving the canonical channel, purpose, endpoint, dispatch and event model.

## Authorization and auditing

Campground communication administration uses existing canonical permissions:

- `communications.read`;
- `communications.send`;
- `communications.manage`.

Build 009 staff mutations use the same campground assignment/permission engine as every other protected domain.

Endpoint, preference and consent mutations create audit evidence. Raw endpoint values and consent evidence references are deliberately excluded from audit snapshots.

Trusted provider-event ingestion is a server/provider boundary, not a browser capability.

## I.T. health

The protected I.T. workspace shows only aggregate signals:

- queued/submitted/delivered/failed counts;
- overdue delivery/call work;
- active voice/DTMF/speech work;
- retryable/terminal attempt failures;
- provider event activity.

It does not show phone numbers, emails, push tokens, message bodies, call transcripts, provider payloads or secrets.

## Channel support matrix

| Channel | Build 009 support |
| --- | --- |
| Web/PWA | Full canonical communications domain and health foundation |
| IVR/DTMF | Foundation only; real gateway/state machine arrives in Builds 010–011 |
| Speech | Foundation only; provider capability arrives with voice integration |
| SMS/MMS | Build 012 provider-neutral conversation/command gateway; identity verification remains Build 013 |
| Email | Provider-neutral endpoint/dispatch foundation |
| Push | Provider-neutral endpoint/dispatch foundation |
| Staff-assisted | Uses the same endpoint/purpose/dispatch records |
| Secure-link fallback | Canonical handoff option for visual/protected workflows |

No channel is allowed to bypass authentication, campground authorization, privileged-action controls or domain validation.

## Failure and recovery

- provider attempts are bounded;
- retryable errors receive capped exponential backoff;
- terminal failures remain visible in aggregate health;
- provider events are idempotent;
- dispatch creation is idempotent within a campground;
- future workers can recover queued work through the Build 007 durable queue.

## Portability and cost

The canonical data model is vanilla PostgreSQL and the provider interface is ordinary application code.

Build 009 adds no paid provider. The default mock adapter is free.

Later provider replacement does not require replacing consent history, endpoint identities, dispatch IDs, provider-event evidence or campground authorization.

## Build 010 voice and IVR gateway

Build 010 adds the real voice gateway contract above the Build 009 communications domain:

- campground voice-line/provider bindings;
- inbound and outbound call records;
- provider-call idempotency;
- IVR session/state records;
- staff-transfer fallback;
- signed webhook verification;
- replay-window enforcement;
- sandbox/mock provider operation.

The default provider remains `mock`, so no external telephone number or provider account is required to verify the gateway.

### Signed webhook boundary

Inbound webhook traffic is accepted only after HMAC-SHA256 verification over the exact timestamp and raw request body.

The default replay tolerance is 300 seconds and is configurable only within 30–900 seconds.

Raw webhook bodies and signatures are not stored.

Provider-event IDs remain the durable idempotency key, and the event row plus call side effects occur in one database transaction so a failed transaction remains safely retryable.

### IVR state machine

Build 010 introduces semantic IVR events such as repeat, timeout, staff transfer and hangup.

It deliberately does **not** bind numeric keypad digits to menu choices yet. Build 011 owns DTMF collection, masking and numeric menu behavior.

IVR event evidence records semantic transitions only and never stores keypad digits, PINs, payment data, audio or transcripts.

### Staff transfer

A voice line may point to a same-campground private phone endpoint for staff transfer.

The transfer destination is fetched only inside trusted server code and never returned through the caller-facing API response or I.T. diagnostics.

If no active staff target exists, the call enters a safe fallback state rather than exposing or guessing a destination.


## Build 011 numeric keypad / DTMF

DTMF input uses the Build 010 signed voice webhook and the Build 009 provider-event idempotency boundary.

The normalized in-memory event may contain keypad input while routing, but durable provider-event metadata contains only:

- input kind;
- digit count;
- sensitivity flag;
- `rawDigitsExcluded: true`.

IVR evidence stores semantic transitions only. Site/reservation/pass values are transient lookup inputs, while PIN/verification values are treated as sensitive and never surfaced in ordinary diagnostics.

No new communications table or paid provider is introduced by Build 011.

## Build 012 SMS/MMS conversation and command gateway

Build 012 promotes SMS/MMS from foundation-only to an operational sandbox gateway:

- campground messaging-line/provider bindings;
- signed inbound webhook verification with replay-window enforcement;
- authenticated outbound SMS/MMS dispatch;
- provider-event and outbound idempotency;
- guided numbered menus and keywords;
- structured site/reservation/pass commands that remain verification-gated;
- natural-language command proposals that remain validation-gated;
- MMS metadata intake in pending-scan state;
- submitted/delivered/read/failed message evidence;
- aggregate messaging health without message bodies or phone numbers.

Raw message text is transient routing input and is not an ordinary durable telemetry field. Phone possession does not establish identity; Build 013 supplies the risk-based telephone/SMS verification layer.
