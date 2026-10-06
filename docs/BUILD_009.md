# Build 009 — Omnichannel Communications Foundation

Status: **IMPLEMENTED — PROMOTION PENDING**

## Requirement satisfied

Build 009 creates one communications domain shared by Web/PWA, voice, DTMF, speech, SMS/MMS, email and push without coupling campground workflows to a provider.

## Canonical data

Migration `0011_omnichannel_communications_foundation.sql` adds private:

- communication endpoints;
- purpose/channel preferences;
- append-only consent evidence;
- communication dispatches;
- bounded provider attempts;
- append-only normalized provider events.

## Authorization

- endpoint/preference/consent management requires `communications.manage`;
- dispatch creation requires `communications.send`;
- provider event/attempt recording is a trusted server/provider boundary;
- browser-facing Supabase roles receive no direct table access.

## Purpose classification

Every dispatch is one of:

- transactional;
- operational;
- marketing.

Build 014 adds compliance-specific unsubscribe/help synchronization and jurisdiction rules.

## Reliability

- per-campground dispatch idempotency;
- per-provider event idempotency;
- bounded attempts;
- exponential retry backoff capped at one hour;
- explicit delivery/call health.

## Privacy

Raw endpoint values, message bodies, raw provider webhook bodies, signatures, secrets, call recordings and transcripts are excluded from ordinary audit/health evidence.

## Provider boundary

Development uses a free mock provider. No production telephone/SMS/email/push provider is connected in this build.

## Automated proof

CI verifies schema contracts, authorization rejection, endpoint privacy, preference/consent behavior, dispatch idempotency, retry recovery, mock provider delivery, provider-event idempotency, append-only consent evidence and aggregate health.

## Channel matrix

Web/PWA receives the full foundation. Voice/DTMF/speech, SMS/MMS, email and push share the same domain contract but real external gateways arrive in later provider-specific builds. Staff-assisted and secure-link fallback remain available.

## Manual action

**None.**

No telephone number purchase, provider account, billing, regulatory registration or production secret is required for this foundation.

## Next build

**Build 010 — Inbound/Outbound Voice & IVR Gateway**
