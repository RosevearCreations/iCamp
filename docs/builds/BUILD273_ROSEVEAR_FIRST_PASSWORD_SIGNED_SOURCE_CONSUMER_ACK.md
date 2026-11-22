# iCamp Build 273 — Original production source, signed consumer ACK, incident closure and Rosevear first-password access

## Release baseline

Build 272 shipped to protected GitHub `dev` and `main`, exact `main`
SHA `e2739ad971dc2c437482467fc5b5ed95ffd8c6c4`, Vercel production
deployment `dpl_36AHFRcCZtB7AhQpcQdz6PZvgN7R` READY, alias
`i-camp-pi.vercel.app`. Prior release CI passed. Existing production
environment only exposed a `DATABASE_URL` (sensitive, inaccessible
plaintext) plus two platform telemetry variables; earlier original
`ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST` and real Camp Rosevear
Comms / provider source signers were not configured. Therefore real
external source checks and original migrations still require an
independent original host.

## Owner-priority remedy requested for username Rosevear

The user specifically authorized a temporary credential or first-password
flow. This release adds `/auth/owner-setup` and server POST
`/api/auth/owner-setup273`. The one-time 48+ character recovery
credential is kept as a Vercel *production-only sensitive* environment
variable, `ICAMP_OWNER273_FIRST_LOGIN_SECRET`. An explicit expiry
`ICAMP_OWNER273_FIRST_LOGIN_EXPIRES_AT` is enforced by the server:
**2026-11-25T22:00:00Z**. Neither value is checked into GitHub,
embedded into HTML, returned from an API or written to request logs.
The owner must keep the credential confidential and not show it in
streams or public support cases.

The page asks for the one-time credential and a **new unique personal
password** 12–128 characters, twice. Server uses constant-time
SHA-256 comparison and production-environment restriction. It only
locates `icamp_private.user_accounts.username_normalized='rosevear'`
and requires a non-archived staff identity with existing MFA-required
policy and **no existing password credential**. One row lock serializes
parallel claims, inserts a salted scrypt password verifier **only once**
and enables ordinary staff account sign-in, clearing old lockouts and
revoking old sessions. It never adds/approves a platform operator grant,
owner binding, independently verifies an email, changes guest accounts
or creates MFA factors.

One-time setup is contingent on the existing Vercel production
`DATABASE_URL` actually containing the original `rosevear` row,
authentication schema and no existing password. If the original record
is absent or password already exists, setup fails closed; **no
credential set in production may be claimed before owner completes
the form**. Once claimed, normal username/password sign-in is
available, but GOD MODE remains locked by the independent owner
binding/grant, and a real verified TOTP session is still needed.
`/auth/mfa` is the existing authenticator enrollment UI.
A new production-only sensitive `ICAMP_MFA_ENCRYPTION_KEY` was
provisioned for *newly enrolled* factors (no secret in source). If
the production database already has old encrypted TOTP factors whose
key was missing, they must be recovered by the prior original key;
do not overwrite encrypted factors automatically.

The earlier development Supabase project is not assumed to be
the original production database. Invalid `.invalid` recovery mail
cannot be made verified by a password setup. Trusted email recovery
must still be enrolled with authenticated original custodian approval.

## Source custody and consumer acknowledgment (migration 0248)

- `source_enrollment_review273`: only a distinct, MFA-protected
  verified platform owner may review an original active Camp
  Rosevear HMAC source pair already recorded within 24 hours.
- `consumer_ack273`: private original assigned-campground booking
  or Comms ACK from the actual HMAC-authenticated provider:
  original Build 272 booking/guest chain or original Comms delivery
  and cross-master review, signed enrolled pairing, fresh nonce/time
  and provider event reference. Never new payment, refund, booking
  or guest-message dispatch.
- `incident_ack_closure273`: a distinct platform owner may
  link the signed Comms consumer receipt only to a support
  incident **already marked resolved by authorized campground staff**.
  This immutable evidence ledger does not change original case state.
- `restore_provider_attestation273`: an external enrolled provider
  may sign a fresh host attestation against a Build 272 original
  independent backup review, with different hashed original and
  isolated host identities. It is only provider-reported evidence
  until independently audited, **not** a verified live source restore.

All four tables are FORCE RLS, private, immutable with SQL guard
functions, unique receipts and replay prevention. Strict
allowlisted request shapes and HMAC signatures are enforced by
private `POST /api/internal/consumer-ack273` and
`POST /api/internal/restore-attest273`; no anonymous status
endpoint can enroll a signer.

The 0248 runtime check remains HOLD until the actual production
database host pin and original migration ledger are verified,
including previous 0244–0247. Provider signing secrets are
**not configured** because an actual Comms / processor / restore
provider must first agree to sign the exact events and consent.

`/sysop/acceptance273` is the separate Rosevear operator-only
dashboard and `/workspaces/management/campgrounds/booking-recovery268`
shows signed consumer receipt counts to **authorized assigned
campground staff only**. Master Shell omits guest data and payment
details.

## Validation and remaining original host acceptance

1. Protected GitHub tests cover credential expiry, preview rejection,
   wrong token, existing password not overwritten, HMAC integrity,
   nonce and original/isolated host inequality. PostgreSQL CI
   applies migrations in disposable databases; no dummy customer
   records are inserted into production.
2. After actual deployment, owner visits `/auth/owner-setup`,
   enters one-time secret, chooses their own password, then
   signs in as username Rosevear and enrolls TOTP at `/auth/mfa`.
   Independently verified account contact and platform owner
   grant are still needed to reach `/sysop`. Never put a password
   or TOTP seed in this document.
3. Original source host must be verified separately before adopting
   migration 0248. Camp Rosevear seasonal consent state and
   real HMAC provider/Comms signer must be independently enrolled.
   A mocked provider ACK cannot certify a live consumer.
4. Actual Comms recipient ACK must be verified outside the
   outbound `accepted` receipt. Original tenant support case must
   already be resolved before signed closure evidence is admitted.
5. Independent provider host attestation must be checked against
   actual encrypted backup, isolated restored DB and original
   data readbacks. An attestation hash alone is not a restore.
6. Only after independent `dev`/`main` GitHub checks and Vercel
   target=production READY with exact new `main` SHA and
   `i-camp-pi.vercel.app` alias may Build 273 software release
   be marked Production GREEN.

## Next proposed

**Build 274 — Real Rosevear MFA and Email Recovery Acceptance, Original
Camp Rosevear Payment/Comms Signer Provisioning, Consumer-Delivered
Incident Closure and Independent Backup Recovery Witnessing**.
