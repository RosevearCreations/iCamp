# iCamp Build 272 — Supervised Original Owner, Provider/Comms Pairing, Isolated Restore & Cross-Master Incident Review

## Baseline, known source facts and release limits

Build 271 is live READY in Vercel project `i-camp`, team
`johns-projects-8f256ece`, production domain
`https://i-camp-pi.vercel.app`, deployment
`dpl_7G3Ax9FLd1DBMn8hESZGsbX9zaee`, exact protected
`main` SHA `4bc7c372605f572354c74fd636b9e776a04122f3`.
Source: GitHub Build 271 PR #664, protected CI and verified Vercel
deployment readback.

That release never proved that the **original production** database received
migrations 0244–0246. The independently pinned original
`ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST` and actual original Comms and
payment TEST processor pairing were not configured. Connected development
Supabase previously exposed a **disabled** `rosevear` staff identity,
unreachable `.invalid` contact, no password verifier, pending platform
grant and no verified MFA factor. It is **not automatically the original
Vercel production source**. No real customer booking, provider refund,
password, permission, Comms recipient delivery, or backup restoration is
performed by this release.

The owner request is to promote the software; no unsafe credential
bootstrap, unapproved operator privilege or live payment charge is
authorized merely by a build number.

## Implemented independent original-field controls

1. **Migration 0247** creates four private, append-only, FORCE RLS
   source-linked ledgers with fixed-field constraints. Denies public direct
   access, guards reviewer identity and prevents duplicate acceptance.
   SQL verification runs in ephemeral CI database; original production
   migration adoption is a *separate live gate*.
2. **Real Rosevear first-login witness** requires a real
   `icamp_private.auth_sessions` row on the original source with live
   unrevoked AAL2 assurance, enabled staff identity `rosevear`, verified
   non-placeholder email, original password verifier, verified MFA factor
   and independently approved active platform owner grant. A *different*
   verified platform operator records an immutable evidence digest. The
   witness cannot enable the user, generate or reset a password, enroll
   MFA, or grant GOD MODE. The owner must complete the supervised secure
   enrollment steps through the original auth workflow.
3. **Tenant-specific paid booking provider review** accepts only a
   matched original Build 270 provider trace, separate original Build 269
   processor-settlement, site-allocation, delivered-confirmation and
   guest-ack witness records—all for the same original recovery and
   campground—and an existing signed source pair for payments. The
   reviewer must be a distinct authorized tenant manager. A test
   processor witness is **not** bank settlement; compare independently
   against the real payment provider's test-mode API and supporting
   original source receipt. No capture, refund, booking, inventory or
   guest communication is triggered by this review.
4. **Comms Hub / master incident review** requires the same original
   outbox, a Build 270 accepted durable send attempt, a Build 269 signed
   downstream *delivered* receipt, a Build 271 signed Comms source
   pairing and a verified separate platform reviewer. The private
   external master-ACK artifact SHA-256 and namespace is recorded with
   no tenant narrative or guest data. Actual recipient acknowledgment
   and platform case closure are still HOLD until original independent
   source verification; an artifact hash alone does not resolve a case.
5. **Isolated restore dry-run chain review** requires matching original
   backup SHA-256 and independent Build 269 review plus Build 271
   original, isolated-restore and current-production fingerprints across
   tenant isolation, reservation integrity, payment ledger and service
   health. Reviewer must differ from the original independent witness.
   The resulting artifact is explicitly not an independently verified
   live-host restore certificate. Never restore over production for a test.
6. **Separate administration and tenant views**: protected
   `/sysop/acceptance272` for source status, independently authenticated
   owner AAL2 session, cross-master Comms review and restore chain;
   `/workspaces/management/campgrounds/booking-recovery268` for only
   assigned-tenant private payment/booking original reviews. The master
   Shell never renders guest payment row IDs, full case narratives,
   customer names, email, source credentials or private tokens.

## Field verification sequence before claiming operational success

- Verify actual original production `DATABASE_URL` hostname against a
  separately verified pin, inspect migration 0247 ledger and original
  checksum history and four FORCE RLS tables.
- Recover owner access only using separately verified genuine email,
  supervised secure password reset and MFA enrollment. Independently
  approve source role and platform owner binding. A real `rosevear`
  AAL2 login session must exist before a second owner can witness it.
- On the actual original active Camp Rosevear test tenant, independently
  enroll source identities, verify HMAC challenge and test processor
  response; trace one original booking's payment, site, receipt,
  confirmation and guest acknowledgment without duplicate charge.
- Verify one original outbound Comms event, true provider-delivered
  receipt, recipient acknowledgment and original platform incident
  transition. A Comms API `accepted` response alone is insufficient.
- Back up verified original source to protected storage, run an isolated
  restore, read back each canonical scope from both sources and have a
  different platform reviewer attest. A database hash does not prove
  a provider-host restore happened.
- Independently verify GitHub `dev` and `main` protected merges,
  Vercel READY for **exact Build 272 main SHA**, target production and
  `i-camp-pi.vercel.app` alias. Software release readiness is separate
  from independent field-acceptance readiness.

## Next proposed build

**Build 273 — Original Production Source Enrollment Ceremony, Tenant
Booking/Comms Consumer Receipt Handshake, Signed Incident ACK Closure and
Restore Provider Attestation.** Do not mark actual customer flows
complete without original live witness receipts.

The user did not authorize a different test tenant to replace the
original Camp Rosevear provider or a production password reset sent
through an unverified address.
