# Build 013 — Telephone/SMS Identity, Verification & Staff Re-Authentication

Status: **IMPLEMENTED — PROMOTION PENDING**

## Roadmap scope

Build 013 delivers:

- caller ID/SMS sender as routing hints only, never authentication;
- guest site/reservation/pass verification;
- short-lived one-time verification codes;
- staff channel PIN verification;
- stronger factor or recent approved-session re-authentication for privileged staff channel actions;
- rate limiting, bounded attempts, lockout and categorical fraud/abuse signals;
- strict no-secret-echo rules across voice, SMS, logs, persistence and I.T. health.

## Delivered design

### Private persistence

Migration `0017_channel_identity_verification.sql` introduces:

- `icamp_private.staff_channel_pin_credentials`;
- `icamp_private.channel_verification_challenges`;
- `icamp_private.channel_verification_attempts`.

Raw PINs, raw one-time codes, phone numbers, message bodies and guest reference numbers are not schema columns. Guest references, OTPs and PINs use salted scrypt verifiers.

### Guest verification

Guest challenges bind the campground, voice/SMS channel, remote endpoint as a non-authenticating routing hint, semantic subject kind and salted verifiers for both the guest reference and one-time code.

A successful reference + code proof satisfies the challenge at AAL1 for the verified lookup context only.

### Staff channel re-authentication

Staff challenges bind to an active staff identity and campground assignment.

Staff access requires the channel PIN. Privileged staff channel verification requires channel PIN plus either:

- the one-time code; or
- a recent non-revoked authenticated session that passes the Build 006 recent re-authentication freshness check.

A completed privileged channel challenge records AAL2 verification evidence without changing the browser session assurance level.

### Authorization and audit

Verification does not grant campground authorization. `assertChannelVerificationGrant` re-checks the requested campground permission after identity verification and applies the existing Build 006 privileged-action controls.

Successful staff channel verification writes append-only audit evidence containing only semantic factor/channel state. PINs, OTPs, phone numbers and guest references are excluded.

### Abuse controls

- five-minute challenge lifetime;
- maximum five attempts;
- fifteen-minute challenge/PIN lockout;
- bounded challenge issuance per endpoint/window;
- categorical fraud signals only;
- semantic attempt history with no secret material.

## Channel safety

- SMS structured lookup commands remain `verify.identity` gated.
- Voice DTMF site/reservation/pass entries now return `verify.identity` before any business lookup.
- Caller ID/sender endpoint is never promoted to an authenticated identity.
- PIN and verification DTMF kinds remain sensitive/redacted.

## Testing and evidence

Build 013 adds:

- verification-policy and secret-handling unit tests;
- PostgreSQL schema verification;
- PostgreSQL lifecycle verification for guest reference+OTP, staff PIN+OTP, staff PIN+recent-session re-authentication, permission re-checking, lockout and secret exclusion;
- CI database lifecycle execution;
- hosted iCamp Supabase rollback-only migration proof with zero retained Build 013 tables;
- aggregate verification health in I.T. & Analysis.

## Manual action

**None expected.**

No live telephony/SMS provider, paid service, production number or production verification secret is required for this build.

## Next build

**Build 014 — Messaging Consent, STOP/START/HELP & Preference Ledger**
