# Build 010 — Inbound/Outbound Voice & IVR Gateway

Status: **IMPLEMENTED — PROMOTION PENDING**

## Scope

Build 010 implements the roadmap requirements:

- campground telephone line/provider adapter;
- inbound and outbound call routing;
- IVR state-machine foundation;
- staff transfer/fallback;
- signed webhook verification and idempotency;
- provider sandbox/mock mode.

## Database

Migration `0013_voice_ivr_gateway.sql` adds:

- `icamp_private.voice_lines`;
- `icamp_private.voice_calls`;
- `icamp_private.voice_ivr_sessions`;
- append-only `icamp_private.voice_ivr_events`.

Campground-scoped foreign keys prevent a voice call from binding to a line, communications dispatch, remote endpoint or transfer endpoint from another campground.

## Runtime

- `lib/voice/provider.mjs` — replaceable voice provider contract, mock sandbox, HMAC signing/verification and event normalization.
- `lib/voice/ivr.mjs` — provider-neutral semantic IVR transition engine.
- `lib/voice/postgres.mjs` — voice-line administration, outbound calling, transactional provider-event ingestion, IVR sessions, staff transfer and health.
- `/api/communications/voice/webhook` — signed inbound provider boundary.
- `/api/communications/voice/outbound` — authenticated outbound voice entry point.

## Security

- inbound webhooks are rejected unless signature and replay window verify;
- raw webhook bodies/signatures are not persisted;
- outbound calls require `communications.send`;
- line administration requires `communications.manage`;
- raw phone numbers remain private;
- caller ID is not authentication;
- IVR events store no DTMF/PIN/payment/audio/transcript data;
- staff transfer resolves the raw destination only inside trusted server code.

## Reliability

- provider event IDs are idempotent;
- provider-event insertion and inbound call/dispatch/session side effects share one transaction;
- outbound calls reuse communication dispatch idempotency;
- terminal call state cannot be regressed by ordinary later events;
- IVR retries are bounded;
- staff transfer has a safe fallback state.

## Sandbox

The default voice provider is `mock`.

No external phone number, provider account, billing, regulatory registration or provider credential is needed for Build 010 promotion.

## Automated proof

CI covers:

- valid/invalid/stale signed webhooks;
- normalized provider events;
- outbound sandbox placement;
- sandbox transfer;
- semantic IVR transitions;
- bounded IVR timeout fallback;
- unauthorized line administration rejection;
- raw provider-number reference omission;
- outbound call idempotency;
- inbound provider-event idempotency;
- inbound IVR session creation;
- staff transfer;
- call completion;
- append-only IVR evidence;
- aggregate voice health;
- full PostgreSQL migration/schema verification.

## Manual action

**None.**

If/when a real telephony provider is selected, its setup will be handled as a separate controlled provider-connection step with explicit walkthrough instructions.

## Next build

**Build 011 — Numeric Keypad/DTMF Interaction Engine**
