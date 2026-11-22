# iCamp Build 271 — Original owner ceremony, signed source pairing, independent guest closure & restore replay

## Source-of-truth boundaries and starting evidence

The *Yard Workers and iCamp Shell Review* separates the Rosevear operator
Shell's platform health, incidents and security from each campground tenant's
reservations, customer communications, financials and staff. The *Expanded
Source of Value* iCamp goals require booking confirmation, real provider
reconciliation and guest support. They are goals, not proof of deployed data.

Current protected `main` before this build: Build 270,
`aa4f6f992757ecd24d509cd919e1800c46f403f7`. Its GitHub checks
passed, but Vercel production remained READY on Build 269
`a85ddb22bcbf4fb903727c464867ebe3b027cdf4`, while Vercel rejected
Build 270 production creation with `HTTP 402 api-deployments-free-per-day`.
Verify these exact SHAs and quota again after this build.

Only production Vercel `DATABASE_URL` and limited Shell telemetry settings
were listed. Independent `ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST`,
Camp Rosevear telemetry pairing and HMAC secrets, Comms provider handshake
and live payment processor verification were not installed. Do **not**
infer original production data from the connected development Supabase
project `cxgszmpbeswdikzofvjv`, where `rosevear` has a disabled
account, placeholder `.invalid` email, no password verifier, pending
platform grant, and no verified MFA. No privileged credential was reset.

## Code scope and acceptance semantics

1. **Original schema migration 0246** installs four private, FORCE-RLS,
   immutable evidence ledgers and independent authorization triggers.
   The booking recovery state-change trigger now prevents a new
   `closed` transition without an independent certified receipt and an
   actual `confirmed` outcome. Historic closed cases are not silently
   reclassified. Unverified refunds or `no_payment` findings remain on
   HOLD rather than being labelled independently reconciled.
2. **Rosevear owner ceremony** stores a nonsecret SHA-256 artifact
   digest for each distinct stage (verified real contact, existing
   password verifier, actual verified MFA factor, active separately
   reviewed owner binding). A different verified owner must witness
   it; every stage is separately checked against the original source.
   The ceremony itself **does not** enable accounts, write credentials,
   grant system privileges, revoke lockouts, set email, or enroll MFA.
   The safe path to first owner activation remains separately supervised.
3. **Signed original source-pairing proofs** require bounded raw HMAC,
   a unique nonce, a strict 60-second source timestamp, exact configured
   source ID and Camp Rosevear ID, original host pin and migration
   history. Traffic additionally requires explicit active campground
   consent and an active campground. Source kinds are traffic, Comms
   and payment TEST processor. Provider-specific proof secrets are
   `ICAMP_COMMS271_PROOF_HMAC_SECRET` and
   `ICAMP_PAYMENTS271_PROOF_HMAC_SECRET`; neither is populated by a
   dummy value. Proof custody is independent of a message actually
   reaching the recipient or the bank settling a charge.
4. **Paid but no confirmation recovery:** the local campground manager
   first obtains an original test provider match (Build 270), original
   site allocation, delivered confirmation and guest acknowledgment
   evidence (Build 269). A **second distinct authorized campground
   manager** records an immutable certification. Only then can the
   existing original case be closed as `confirmed`. No second payment,
   site booking, receipt or guest notification is created by the
   certification action.
5. **Restored-system evidence replay:** original backup,
   isolated-restored database and current production readback may
   append separately witnessed canonical digests for tenant isolation,
   reservation integrity, payment ledger and service health. Matching
   four-scope chains require distinct operators and the prior original
   Build 269 independent restore witness. A complete digest chain is
   labelled `EXTERNAL_RESTORE_UNVERIFIED`; actual restoration requires
   independently inspected source and restored host logs.
6. **User interfaces:** protected operator dashboard
   `/sysop/enrollment271` displays only source, safety and independent
   ceremony statuses; private campground recovery page
   `/workspaces/management/campgrounds/booking-recovery268` offers
   a reviewer-only certification action, with no payment modifications.
   Source endpoint `POST /api/internal/source-proof271` is HMAC-only,
   rejects unrecognized fields, replay, stale requests and unpaired
   identity. Its result is stored signed custody, not external approval.

## Real-world acceptance sequence — not fabricated in CI

A. Confirm the actual original Vercel database hostname independently,
   install migrations 0244–0246 there only after verified authority, then
   read back exact migration versions and custody constraints.
B. Independently verify the Rosevear original platform identity and
   accessible recovery contact; establish a one-time password through
   private secure credential operations, perform MFA enrollment and
   independent owner-grant approval. Witness each **real** stage. A
   disabled account with a `.invalid` address cannot use normal
   email recovery. A 12-character password alone does not grant access.
C. Confirm Camp Rosevear consent and seasonal state, obtain original
   source credentials privately, pair the three original source
   identities and observe fresh traffic, Comms signed downstream
   delivery and test-mode processor receipt separately.
D. Run one genuine sandbox paid/no-confirmation guest booking with an
   original idempotent payment reference. Verify original hold, site,
   provider captured vs independently settled outcome, and confirmation
   delivery. Reconcile without duplicate charge or new booking. Obtain
   guest acknowledgment and an independent campground review before
   closing the complaint.
E. Restore the original encrypted backup onto an isolated target, inspect
   actual replay canonicalization and unrelated tenant isolation, obtain
   two distinct independent original reviewers and verify current
   production is healthy. Never overwrite original production to test.
F. After two protected GitHub merges, verify Vercel's `target:production`,
   `READY`, exact new `main` SHA and `i-camp-pi.vercel.app` alias.
   Failed quota or missing original production proof is an explicit HOLD.

## Priorities for Build 272

**Build 272 — Supervised Original Owner Identity Activation, Provider-
Verified Camp Rosevear Booking/Comms Acceptance, Independent Restoration
Dry-Run and Cross-Master Live Incident Closure.** No build number alone
is evidence of real data or access.

The original 270 external Vercel quota watch is to follow the latest
safe verified `main`, not downgrade or overwrite a newer release.
