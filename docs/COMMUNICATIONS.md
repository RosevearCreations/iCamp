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

Build 010 adds signed voice-provider webhook verification. Build 012 adds SMS/MMS provider event processing. Both reuse this normalized event ledger.

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
| SMS/MMS | Foundation only; conversation gateway arrives in Build 012 |
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
