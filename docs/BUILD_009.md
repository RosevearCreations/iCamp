# Build 009 — Omnichannel Communications Foundation

Status: **FULLY PROMOTED — `main` PRODUCTION GREEN**

## Requirement satisfied

Build 009 establishes one provider-neutral communications domain shared by Web/PWA, voice, DTMF, speech, SMS/MMS, email and push without coupling campground workflows or authorization to a provider.

## Canonical communications model

Canonical migration `0011_omnichannel_communications_foundation.sql` adds private:

- `communication_endpoints`;
- `communication_preferences`;
- `communication_consents`;
- `communication_dispatches`;
- `communication_attempts`;
- `communication_provider_events`.

All records live in `icamp_private`. Binary media, unrestricted message bodies, recordings, transcripts, raw webhook bodies and provider secrets are deliberately outside ordinary communications telemetry.

Migration `0012_communications_fk_indexes.sql` adds the advisor-driven covering index for the communication-preference updater foreign key.

## Channel vocabulary

The canonical communication channels are:

- web;
- voice;
- DTMF;
- speech;
- SMS;
- MMS;
- email;
- push.

These are interfaces to the same iCamp backend. No channel owns campground business logic.

## Purpose classification

Every communication dispatch is server-authoritatively classified as:

- transactional;
- operational;
- marketing.

Purpose is independent from channel. Build 014 extends this foundation with compliance-specific STOP/START/HELP synchronization and jurisdiction rules rather than pretending a generic consent record alone is a complete commercial-messaging compliance system.

## Endpoint privacy and identity

Communication endpoints can represent phone, email, push or web destinations.

Security rules:

- raw endpoint values remain private;
- safe display hints can be used for confirmation;
- raw endpoint values are excluded from audit snapshots and I.T. health;
- caller ID, sender address or endpoint possession is not authentication;
- endpoint verification proves reachability/ownership evidence only, not campground authorization.

Browser-facing Supabase roles have no direct communications-table access.

## Preferences and consent evidence

`communication_preferences` stores current purpose/channel choices.

`communication_consents` is append-only evidence. Historical consent evidence is never rewritten in place.

The model supports cases such as operational SMS being enabled while marketing SMS is withdrawn.

## Authorization and cross-property isolation

Campground staff operations use the existing canonical iCamp permission engine:

- `communications.manage` for endpoint, preference and consent administration;
- `communications.send` for dispatch creation.

Endpoint/preference/consent changes and dispatch creation write sanitized audit evidence.

A composite database foreign key binds a dispatch endpoint to the same campground. The lifecycle proof verifies an authorized sender in Campground A cannot create a dispatch against a Campground B endpoint.

Trusted provider-attempt/event ingestion is a server/provider boundary and is not exposed as a browser capability.

## Reliability

The provider-neutral dispatch layer includes:

- campground-scoped dispatch idempotency;
- provider-scoped event idempotency;
- bounded provider attempts;
- retryable versus terminal failure states;
- exponential retry backoff starting at 30 seconds and capped at one hour;
- queued/submitted/delivered/failed/cancelled delivery states;
- sanitized provider error code/summary evidence.

Build 007's durable job queue remains the execution substrate for later side-effecting communications workers.

## Provider abstraction

`lib/communications/provider.mjs` defines the replaceable provider boundary.

Development defaults to the free in-process `mock` provider. No telephone number, SMS registration, billing account, production provider account or provider secret is required for Build 009.

Builds 010–014 progressively add real voice/IVR, DTMF/speech, SMS/MMS, phone identity verification and compliance synchronization while reusing this same domain.

## I.T. & Analysis

The protected I.T. workspace now exposes only aggregate communications health:

- queued/submitted/delivered/failed dispatch counts;
- overdue delivery/call work;
- active voice/DTMF/speech work;
- retryable and terminal provider-attempt failures;
- provider event activity.

It does not expose phone numbers, email addresses, push destinations, message bodies, call transcripts, recordings, provider webhook payloads or credentials.

## Automated proof

The Build 009 lifecycle verification proves:

- unauthorized endpoint administration is rejected;
- returned endpoint objects omit raw endpoint values;
- purpose/channel preference persistence;
- append-only consent evidence;
- cross-campground endpoint isolation;
- campground-scoped dispatch idempotency;
- retryable provider failure and bounded retry scheduling;
- mock provider acceptance;
- successful delivery transition;
- provider-event idempotency;
- aggregate communications health;
- deterministic database-pool closure.

Normal gates also verify formatting, lint, TypeScript, unit/repository tests, Next.js production build, production dependency audit, PostgreSQL migration history/idempotency, authentication, authorization, privileged audit, queues, media lifecycle, Secret Scan and CodeQL.

## Supabase hosted verification

The connected RosevearCreations iCamp project has canonical migrations:

- `0011_omnichannel_communications_foundation`;
- `0012_communications_fk_indexes`.

Hosted verification proved:

- all six private communications tables exist;
- `anon` and `authenticated` have no `icamp_private` schema usage;
- browser-facing roles cannot directly read communication endpoints/dispatches;
- a cross-campground endpoint dispatch is rejected;
- consent evidence rejects mutation;
- normalized provider-event evidence rejects mutation;
- rollback-only synthetic verification retained:
  - 0 endpoints;
  - 0 preferences;
  - 0 consents;
  - 0 dispatches;
  - 0 attempts;
  - 0 provider events;
  - 0 synthetic organizations.

Supabase Security Advisor reports **zero security lints**.

Performance Advisor originally found one Build 009 unindexed foreign key on `communication_preferences.updated_by_user_id`. Migration 0012 adds the covering index, and the finding is now gone. Remaining observations are INFO-level unused-index notices expected on the new/empty development dataset.

## Promotion evidence

### Feature implementation

- feature branch: `build-009-omnichannel-communications-foundation`;
- feature PR: **#29** → `dev`;
- exact tested feature head: `f29892c52149388c0307c89ef9a016ebde0e4536`;
- exact tested tree: `8d9be7c4ce370a9e2ef4d39e991714ec5c097189`;
- feature gates:
  - Verify/Build — GREEN;
  - Database migrations/lifecycles — GREEN;
  - Secret Scan — GREEN;
  - CodeQL — GREEN.

### Development promotion

- `dev` merge SHA: `b7c50ea6ea0968195ee2b09321981e8fc8516429`;
- `dev` tree: `8d9be7c4ce370a9e2ef4d39e991714ec5c097189`;
- independent `dev` push:
  - Verify/Build — GREEN;
  - Database migrations/lifecycles — GREEN;
  - Secret Scan — GREEN;
  - CodeQL — GREEN.

### Production candidate

- production PR: **#30** → `main`;
- exact `dev` head: `b7c50ea6ea0968195ee2b09321981e8fc8516429`;
- GitHub merge candidate: `4881a87bc28c525393450f9c1b5d717e19cf81cc`;
- merge-candidate tree: `8d9be7c4ce370a9e2ef4d39e991714ec5c097189`;
- existing GREEN Verify/Database/Secret/CodeQL checks were associated with the exact PR head;
- GitHub Advanced Security reported no new CodeQL alerts for PR #30.

### Production implementation

- `main` SHA: `0393a70076eae3f3b0113a09f04c6726fbd272af`;
- production tree: `8d9be7c4ce370a9e2ef4d39e991714ec5c097189`;
- independent `main` push:
  - Verify/Build — GREEN;
  - Database migrations/lifecycles — GREEN;
  - Secret Scan — GREEN;
  - CodeQL — GREEN.

The implementation Git tree is unchanged from the exact tested feature head through `dev`, the production candidate and the production implementation.

## Channel matrix

| Channel | Build 009 status |
| --- | --- |
| Web/PWA | Full foundation |
| IVR/DTMF | Foundation; real gateway/state machine begins Build 010 |
| Speech | Foundation; real provider capability arrives with voice builds |
| SMS/MMS | Foundation; conversation gateway arrives Build 012 |
| Email | Provider-neutral endpoint/dispatch foundation |
| Push | Provider-neutral endpoint/dispatch foundation |
| Staff-assisted call | Uses the same endpoint/purpose/dispatch records |
| Secure-link fallback | Canonical handoff path for visual/protected steps |

No channel bypasses canonical iCamp authentication, campground authorization, privileged controls or domain validation.

## Cost and portability

Build 009 introduces no paid provider dependency.

The canonical schema is vanilla PostgreSQL and provider adapters are replaceable application boundaries. A future telephony/SMS/email/push provider can change without replacing iCamp endpoint IDs, consent history, dispatch IDs, provider-event evidence or campground authorization.

## Manual action

**None.**

No phone-number purchase, external communications account, billing setup, regulatory registration or provider secret is required to complete Build 009.

## Next build

**Build 010 — Inbound/Outbound Voice & IVR Gateway**
