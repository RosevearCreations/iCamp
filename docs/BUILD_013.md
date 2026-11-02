# Build 013 — Telephone/SMS Identity, Verification & Staff Re-Authentication

Status: **FULLY PROMOTED — `main` GREEN.**

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

## Production promotion evidence

- implementation PR #43 promoted the exact tested Build 013 feature tree to `dev`;
- final tested feature head: `9a1c0f589bccd94b8ca77afe01479ffe8ab7571a`;
- exact-tree `dev` merge commit: `5f58ef767ca7584c598fd456e96e1014ccc8fbaa`;
- independent `dev` CI run `37668138194`: GREEN;
- independent `dev` CodeQL run `37668138168`: GREEN;
- independent `dev` Secret Scan run `37668138114`: GREEN;
- production PR #44 promoted the exact GREEN `dev` tree to `main`;
- runtime production merge commit: `eb002853fc1647d747b0f87715df78dfa429f3ce`;
- independent runtime `main` CI run `37668978314`: GREEN;
- independent runtime `main` CodeQL run `37668978240`: GREEN;
- independent runtime `main` Secret Scan run `37668978317`: GREEN;
- hosted iCamp Supabase migration `20261007183559 / 0017_channel_identity_verification`: applied;
- hosted rollback-only migration proof retained zero Build 013 tables before permanent application;
- hosted verification confirms all Build 013 tables and covering indexes exist;
- browser-facing `anon` and `authenticated` roles cannot select verification challenges directly;
- hosted Supabase Security Advisor: zero findings;
- Supabase performance advisor reports only expected INFO-level unused-index notices on the new/low-traffic schema.

The connected iCamp release boundary remains repository `main` plus hosted Supabase verification; no separate live telephony/SMS provider or paid production number is required by Build 013.

## Manual action

**None expected.**

No live telephony/SMS provider, paid service, production number or production verification secret is required for this build.

## Next build

**Build 014 — Messaging Consent, STOP/START/HELP & Preference Ledger**
