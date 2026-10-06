# Voice & IVR Gateway

## Purpose

Build 010 establishes the provider-neutral inbound/outbound telephone gateway used by later DTMF, speech and guest/staff telephone workflows.

The gateway is deliberately usable in sandbox mode without purchasing a telephone number or creating an external provider account.

## Campground voice lines

A voice line binds:

- organization/campground scope;
- a private phone communication endpoint;
- provider key;
- provider number reference;
- IVR route key;
- optional same-campground staff transfer endpoint;
- inbound/outbound capability flags;
- sandbox/production mode.

Raw telephone numbers remain in the private communication endpoint registry. Voice-line objects and I.T. health do not return them.

## Inbound signed webhook flow

1. Provider sends the exact raw event body plus timestamp/signature.
2. The gateway verifies HMAC-SHA256 over `timestamp.rawBody`.
3. Requests outside the bounded freshness window are rejected.
4. The provider adapter normalizes the event.
5. The provider event ID is inserted as the idempotency boundary.
6. Call/dispatch/IVR side effects execute in the same PostgreSQL transaction.
7. If processing fails, the transaction rolls back, including the provider-event row, so a provider retry remains safe.
8. Duplicate provider event IDs are acknowledged without repeating side effects.

The mock contract uses:

- `x-icamp-voice-timestamp`;
- `x-icamp-voice-signature`;
- signature format `sha256=<hex>`.

A future external adapter may implement that provider's native signature scheme while preserving the same verified-normalized event boundary.

## Outbound calls

The authenticated outbound endpoint uses the canonical staff session and `communications.send` permission.

The destination phone number is resolved inside trusted server code from a same-campground communication endpoint and passed directly to the provider adapter. It is not returned in the API response.

Outbound calls reuse Build 009 dispatch idempotency. A repeated identical dispatch key returns the existing voice call rather than placing the call twice.

## IVR state machine

Build 010 introduces semantic IVR transitions:

- repeat;
- timeout;
- staff transfer;
- goodbye/hangup.

The database stores only semantic state/evidence.

Build 011 maps numeric DTMF input to semantic events and adds digit collection, masking, retry and menu conventions. Build 010 intentionally does not persist keypad input.

Default IVR sessions:

- begin at `main_menu`;
- expire after 15 minutes;
- use a maximum of 3 retries;
- route repeated timeout failure to staff transfer.

## Staff transfer and fallback

A line can designate a same-campground staff phone endpoint.

When IVR requests staff assistance:

- the trusted server resolves the private staff destination;
- the provider adapter receives it;
- the caller-facing result contains only transfer/fallback status.

If no active staff endpoint is configured, the call enters a safe fallback state rather than exposing or inventing a destination.

## Provider abstraction

The current adapter is `mock` and supports:

- outbound call placement;
- call transfer;
- signed webhook normalization;
- sandbox call/provider references.

No paid provider dependency is introduced.

A production adapter must implement the same contract plus its native signature verification and provider response translation.

## Security rules

Never store in ordinary voice/IVR tables, provider events, logs or I.T. health:

- raw webhook bodies or signatures;
- provider API secrets;
- DTMF digits or PINs;
- MFA/verification codes;
- payment-card data;
- call audio;
- unrestricted transcripts;
- raw phone numbers outside the private endpoint registry.

Caller ID is routing information only and is not authentication.

## Channel matrix

| Channel | Build 010 status |
| --- | --- |
| Web/PWA | Authenticated outbound voice API and voice health |
| Voice | Full sandbox inbound/outbound gateway foundation |
| IVR | Semantic state machine and staff transfer |
| DTMF | Foundation only; digit engine arrives Build 011 |
| Speech | Provider-neutral route foundation only |
| SMS/MMS | Unchanged Build 009 foundation; gateway arrives Build 012 |
| Staff-assisted | Same-campground transfer/fallback supported |
| Secure link | Available for visual/protected workflows through later domain flows |

## Manual setup

None is required for Build 010.

When a real provider is intentionally selected later, operator setup will include the provider account/number and secret configuration. Until then, the sandbox mock adapter gives full CI and lifecycle proof without billing or regulatory setup.
