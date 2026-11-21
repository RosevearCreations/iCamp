# iCamp Build 270 — Original Host, Signed Comms Delivery, Payment Trace & Owner Recovery

## Verified baseline
- GitHub `main` Build 269 deployed READY with exact SHA
  `a85ddb22bcbf4fb903727c464867ebe3b027cdf4`.
- Vercel original `i-camp` production has a server-side `DATABASE_URL`,
  but the independently verified host pin, production source-specific HMAC,
  Comms outbound key and test payment provider access are not configured.
- **Connected development Supabase** project `cxgszmpbeswdikzofvjv`
  contains `rosevear` staff account with disabled state, placeholder
  `.invalid` email, **no password credential**, pending platform grant,
  MFA required with **zero verified MFA factors**. This is a **different
  authority boundary** from the original production Vercel database until
  `DATABASE_URL` has been independently matched.
- A 12-character password does not enable a disabled account, approve a
  pending global grant, independently verify a platform owner binding,
  recover a nonexistent mailbox or enroll MFA. No credentials were changed.
- Username sign-in already exists; a public email reset intentionally avoids
  account enumeration and cannot deliver to an unverified `.invalid` email.

## Changes to actual software
1. **Source custody:** `sourceReadiness270()` opens the runtime's own
   connection, checks independent `ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST`,
   Build 268 migration chain and Build 270 `0245`. Missing history HOLD.
2. **Comms Hub outbound adapter:** private, CRON-authenticated
   `POST /api/internal/send-sla270` can claim ONE overdue assigned
   `support_sla_outbox268` notice with an immutable
   `support_delivery_attempts270` record. With the right enrolled
   provider configuration, it signs a bounded non-guest incident envelope
   and submits once over **independently pinned HTTPS**. A lost HTTP response
   stays `uncertain`, never automatically resent. A `receiptRef` means
   the remote receiver accepted the request, **not** that staff saw it.
   Build 269's separate signed downstream provider ACK is needed for actual
   delivery state. This worker has **no ability** to change payments,
   campsite bookings, guest personal information or operator roles.
3. **Original read-only payment trace:** authorized campground staff can
   compare a private `reservation_payments` captured record against a
   strictly pinned HTTPS TEST processor's reference, amount and currency.
   A matched processor response creates an immutable digest record in
   `provider_trace270`; it remains a captured-state comparison, not
   independent bank clearing. No capture or refund request is performed.
4. **Isolated restore certification:** audits matching prior backup,
   isolated-restore and independent reviewer witness chain plus four
   private restoration evidence categories. A complete local receipt set
   still says `externalHostRestorationVerified:false` until an actual
   separate restored environment is witnessed.
5. **Owner account access:** dedicated MFA-gated
   `/sysop/recovery270` displays only status booleans for original
   username `rosevear` (no email value, password digest or MFA secrets).
   Public nonenumerating guidance at `/auth/owner-access`.
   No privilege grants or password reset performed by this build.

## Production private settings (not stored in GitHub)
- `ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST`: independently verified
  hostname of original `DATABASE_URL`.
- `CRON_SECRET`: generated and stored in private environment, at least
  32 random characters, used to authenticate one-shot scheduler.
- `ICAMP_COMMS270_SOURCE_ID`, `ICAMP_COMMS270_SLA_ENDPOINT`,
  `ICAMP_COMMS270_HOST_PIN` and `ICAMP_COMMS270_SIGNING_KEY` (32+).
  Configure after **actual** Comms Hub receiver agrees to the
  `icamp.sla.delivery.v1` envelope contract and verifies original
  receiving identity. Never point production to a placeholder.
- `ICAMP_PAYMENTS270_READ_MODE=test`,
  `ICAMP_PAYMENTS270_READ_ENDPOINT`,
  `ICAMP_PAYMENTS270_HOST_PIN`,
  `ICAMP_PAYMENTS270_READ_API_KEY` (32+).
  A real test processor must confirm the response contract; the
  read-only endpoint performs no charge/refund.
- Build 269 source consent and HMAC enrollment variables, plus downstream
  provider ACK transport, are still prerequisites.

## Real Camp Rosevear acceptance
1. Verify provider, hostname, migration checksums and role boundaries on
   actual original production database; never install migration 0245 into
   a similarly named but unrelated connected Supabase.
2. Obtain Camp Rosevear owner consent, verify source state (including
   whether it is seasonally inactive), bind original source ID and
   HMAC secret, and observe real traffic in at least two stages.
3. Make only a **test-mode** original guest booking and provider payment.
   Inspect the external original processor reference, original reservation,
   site inventory, receipt, idempotent confirmation and guest acknowledgment.
   Confirm lost confirmation recovery without generating a second charge.
4. Verify staff recipient through original Comms Hub, queue one real
   authorized SLA incident, run authenticated send once, verify provider
   accepted receipt, signed downstream delivery and actual recipient
   acknowledgment; test timeout and duplicate prevention.
5. Back up the original source to a protected artifact, restore into an
   isolated environment, verify tenant boundaries and original booking
   financial rows, and obtain different independent reviewer signatures.
6. For `rosevear`, independently verify actual production account
   ownership. Provision a real accessible email and verify it, create a
   **fresh temporary 12+ character password through the secret store**,
   reset revoked sessions, perform verified MFA ceremony and approve
   platform operator/owner binding separately. Do not disclose temporary
   credentials or MFA seeds in issue threads, chat, code or logs.
7. A deployment READY means **source software release GREEN only**.
   Payment settlement, mail delivery, account recovery, and external
   original-host restoration are separate HOLD gates until witnessed.

## Next build
**Build 271 — Verified Production Owner Enrollment Ceremony, Real Camp
Rosevear Provider and Comms Source Pairing, Tenant-Safe Retry/Complaint
Closure & Restored-System Evidence Replay.**

Avoid claiming completed operational acceptance without original receipts.
