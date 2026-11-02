# Build 010 — Inbound/Outbound Voice & IVR Gateway

Status: **FULLY PROMOTED — `main` PRODUCTION GREEN**

## Scope

Build 010 delivers the roadmap voice/IVR gateway requirements:

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

Migration `0014_voice_fk_indexes.sql` adds the advisor-driven covering indexes for the composite voice-call line and dispatch foreign keys.

Browser-facing Supabase roles have no direct access to the private voice/IVR tables.

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
- caller ID is routing information, not authentication;
- IVR events store no DTMF/PIN/payment/audio/transcript data;
- staff transfer resolves the raw destination only inside trusted server code.

## Reliability

- provider event IDs are idempotent;
- provider-event insertion and inbound call/dispatch/session side effects share one transaction;
- outbound calls reuse communication dispatch idempotency;
- IVR retries are bounded;
- staff transfer has a safe fallback state;
- webhook freshness is bounded and stale/tampered mock-provider requests are rejected.

## Sandbox

The default voice provider is `mock`.

No external phone number, provider account, billing, regulatory registration or provider credential was required to complete or promote Build 010.

## Automated proof

CI verifies:

- Prettier/format integrity;
- lint;
- TypeScript;
- repository/unit tests;
- Next.js production build;
- high/critical production dependency audit;
- PostgreSQL migration and schema verification;
- authentication, authorization, audit, queue, media and communications lifecycles;
- Build 010 voice/IVR lifecycle;
- migration idempotency;
- Secret Scan;
- CodeQL.

Build 010-specific proof covers:

- valid/invalid/stale signed webhooks;
- normalized provider events;
- outbound sandbox placement;
- sandbox transfer;
- semantic IVR transitions;
- bounded IVR timeout fallback;
- unauthorized line administration rejection;
- provider-number reference omission;
- outbound call idempotency;
- inbound provider-event idempotency;
- inbound IVR session creation;
- staff transfer;
- call completion;
- append-only IVR evidence;
- aggregate voice health.

## Hosted Supabase verification

Connected project: RosevearCreations iCamp.

Applied canonical migrations:

- `0013_voice_ivr_gateway`;
- `0014_voice_fk_indexes`.

Hosted verification proved:

- all four private voice/IVR tables exist;
- required voice-call line/dispatch covering indexes exist;
- `anon` and `authenticated` have no private-schema usage;
- browser-facing roles have no direct voice/IVR SELECT access;
- cross-campground voice-line endpoint binding is rejected;
- IVR event mutation is rejected by the append-only guard;
- rollback verification retained zero voice lines, zero calls, zero IVR sessions, zero IVR events and zero synthetic organizations;
- Supabase Security Advisor reports **zero security lints**;
- Performance Advisor has only INFO-level unused-index observations expected on the new/empty development dataset and no Build 010 release-blocking finding.

## Promotion evidence

Feature implementation:

- feature branch: `build-010-voice-ivr-gateway`;
- PR #32 → `dev`;
- exact final feature head: `efe0e264304f3870c40b7913468715035174fe2b`;
- exact tested tree: `5eb4c2f6a826f838e11c697e8c4cb91936a3218a`;
- feature checks: Verify GREEN, Database GREEN, Secret Scan GREEN, CodeQL GREEN.

Development promotion:

- `dev` merge SHA: `3ab98216e4e9ec357af2eecd369cb2454c3621c9`;
- `dev` tree: `5eb4c2f6a826f838e11c697e8c4cb91936a3218a`;
- independent `dev` push proof: Verify GREEN, Database GREEN, Secret Scan GREEN, CodeQL GREEN.

Production candidate:

- PR #33 → `main`;
- exact `dev` head: `3ab98216e4e9ec357af2eecd369cb2454c3621c9`;
- candidate merge SHA: `899b44efdeb3321e83d30b8ac898a2b356fa9678`;
- candidate tree: `5eb4c2f6a826f838e11c697e8c4cb91936a3218a`;
- candidate checks: Verify GREEN, Database GREEN, Secret Scan GREEN, CodeQL GREEN.

Production implementation:

- `main` SHA: `13c4c8fc59694b961933332f6c290a1652021bec`;
- production tree: `5eb4c2f6a826f838e11c697e8c4cb91936a3218a`;
- independent `main` push proof:
  - Verify / build / dependency audit — GREEN;
  - Database migrations and all lifecycle checks — GREEN;
  - Secret Scan — GREEN;
  - CodeQL — GREEN.

The exact Git tree is unchanged from the final tested feature head through `dev`, the production candidate and the production implementation.

## Manual action

**None.**

A real provider connection is intentionally deferred. When an external telephony provider is selected, the provider account, number, webhook secret and provider-specific configuration will be handled through a controlled setup with explicit operator instructions.

## Next build

**Build 011 — Numeric Keypad/DTMF Interaction Engine**
