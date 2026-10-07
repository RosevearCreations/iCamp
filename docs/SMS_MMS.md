# SMS/MMS Conversation & Command Gateway

## Purpose

Build 012 promotes SMS/MMS from the Build 009 communications foundation into a provider-neutral conversation and command gateway.

The gateway supports:

- inbound and outbound SMS;
- outbound MMS using already validated secure-media assets;
- inbound MMS/photo metadata intake with quarantine/pending-validation state;
- guided numbered menus and keywords;
- structured site/reservation/pass commands;
- natural-language command proposals that cannot bypass server validation;
- normalized sent/delivered/read/failed provider events where the provider supplies them.

## Canonical rule

SMS/MMS is an interface to the same iCamp backend, not a second business system.

Messaging uses the canonical:

- campground authorization engine;
- communication endpoints;
- communication dispatches and attempts;
- provider-event idempotency ledger;
- secure-media boundary;
- audit system;
- future identity/verification controls from Build 013.

## Numbered and keyword navigation

The initial safe navigation vocabulary is:

- `1` / `SITE` — site lookup guidance;
- `2` / `RESERVATION` / `BOOKING` — reservation lookup guidance;
- `3` / `PASS` — pass lookup guidance;
- `8` — repeat/main guidance;
- `9` / `STAFF` / `AGENT` — staff handoff;
- `0` / `MENU` / `HOME` — main menu;
- `HELP` — help guidance.

Navigation commands may be accepted immediately because they do not disclose or mutate protected campground data.

## Structured commands and identity boundary

Structured commands such as:

- `SITE 120`;
- `RESERVATION 123456`;
- `PASS 55`;

are parsed, but the identifier is transient. They are marked `verification_required` and do not execute the protected lookup in Build 012.

Build 013 supplies telephone/SMS identity, verification and privileged staff re-authentication.

Phone-number possession, caller ID and SMS sender address are never treated as authentication.

## Natural-language intent

Natural-language input may propose a command. For example, a phrase containing a reservation or site number may be classified as a likely lookup.

A natural-language proposal is always marked `validation_required`.

It cannot directly:

- retrieve protected booking data;
- change a reservation;
- issue a pass;
- open a gate;
- perform a privileged staff command;
- bypass canonical server authorization or identity verification.

## Message privacy

Raw message text is processed transiently for routing but is not stored in ordinary messaging telemetry.

Durable message evidence records only privacy-safe fields such as:

- direction;
- channel;
- purpose;
- delivery state;
- body length;
- semantic command kind/source/state;
- timestamps;
- provider message reference.

Provider-event metadata explicitly records that raw webhook bodies, message bodies and provider payloads were excluded.

I.T. & Analysis exposes aggregate counts only. It does not display message bodies or phone numbers.

## Conversations

A campground messaging line has at most one active conversation with a given remote endpoint.

The private conversation record tracks:

- campground scope;
- messaging line;
- remote communication endpoint;
- preferred SMS/MMS channel;
- active/closed state;
- last-message time.

Conversation state does not itself prove the identity of the person holding the remote phone.

## MMS/photo intake

Outbound MMS may reference only existing iCamp image assets that are:

- in the same organization/campground;
- validated;
- active;
- JPEG, PNG, WebP or GIF;
- no more than 10 MiB each;
- limited to 10 attachments per message.

Inbound MMS initially stores only provider media reference, MIME type and byte count with `pending_scan` state.

Provider URLs and binary payloads are not written into durable messaging history.

A later media-ingestion worker can fetch and validate the provider object through the canonical secure-media boundary before the asset becomes usable.

## Provider gateway

Development defaults to the free `mock` provider.

Configuration:

- `ICAMP_MESSAGING_PROVIDER=mock`;
- `ICAMP_MESSAGING_WEBHOOK_TOLERANCE_SECONDS=300`;
- `ICAMP_MESSAGING_WEBHOOK_SECRET` only when signed inbound webhook traffic is enabled.

Inbound webhooks use HMAC-SHA256 over the exact timestamp and raw body with a bounded 30–900 second freshness window.

Provider-event IDs are idempotent.

## Delivery and read history

When available from the provider, normalized events can advance outbound message evidence through:

- submitted;
- delivered;
- read;
- failed.

The canonical communications dispatch remains the provider-neutral delivery record. A read receipt is treated as additional message evidence rather than a new business authorization signal.

## Channel parity

| Channel | Build 012 state |
| --- | --- |
| Web/PWA | Existing communications and I.T. health surfaces remain canonical |
| IVR/DTMF | Build 010/011 voice/keypad gateway remains available |
| SMS/MMS | Full Build 012 sandbox conversation/command gateway |
| Staff-assisted | `9`, `STAFF` and `AGENT` route to staff-handoff intent |
| Secure link | Remains the safe handoff for visual/protected workflows |
| Identity/verification | Explicitly deferred to Build 013 |

## Cost and portability

Build 012 adds no paid provider.

The persistence model is provider-portable PostgreSQL and the adapter boundary is ordinary application code. A later real SMS/MMS provider can replace the mock adapter without replacing campground permissions, dispatch IDs, conversation IDs or business rules.

## Next security layer

**Build 013 — Telephone/SMS Identity, Verification & Staff Re-Authentication**

Build 013 will turn verification-required messaging/telephone intents into risk-based authenticated workflows without treating caller ID or sender address as identity proof.
