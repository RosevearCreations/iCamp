# iCamp Build 256 — Original Signed-Event Renewal, Replay/Expiry Escalation and Revocation Custody

## Change scope
Build 256 extends Build 255's seven-app identity/contract validation with real Ed25519 **verification of independently issued originals**, source-bound 15-minute signed receipt lifetimes, deterministic issuer/tenant nonce digests, pin fingerprint and revocation checks, expiry/renewal status and three private PostgreSQL ledgers.

The implementation deliberately **does not mint or simulate production source signers**. It cannot grant live T5 transport, receiver ON, automatic dispatch or formal owner acceptance. Existing Master signed readbacks are verified independently by Build 254 and must all be current before accepting a Build 256 original. The source schema must match Build 255, and SHA of the original issuer is distinct from the SHA of the deployed iCamp code.

## New code
- `lib/release/build256-signed-events.mjs`: canonical v1 signed-event message, Ed25519 original verification against **server-protected** SPKI pin/fingerprint, 60-second clock skew, 15-minute event lifetime, revocation checks, five-minute renewal warning and hold-only Master handoff plan.
- `lib/release/build256-signed-events-postgres.mjs`: scoped owner access, independent current three-Master proof requirement, protected server-only event and pin readback, digest-only append-only source claims, separate reviewer signed revocation, audited Master-only outbox HOLD records.
- `database/migrations/0235_build256_signed_event_revocation_outbox.sql`: tenant/org/private FORCE-RLS claims, revocations and undelivered outbox. Global replay uniqueness across nonce/receipt digests, distinct independent owner review and source SHA binding. Insert/select only; no UPDATE/DELETE grant. Outbox is not a background job and does **not** deliver to remote Masters.
- `database/verify/0235_build256_signed_event_revocation_outbox.sql`: migration verification for append-only private ledgers, unique replay/disposition constraints, SQL guards and role separation.
- `/workspaces/management/campgrounds/signed-event-custody`: authenticated MFA `aal2` and owner_admin + two permissions, no browser-supplied signature, source-only receipt/expiry review and independent revocation UI. This is within the visibly marked iCamp Slave Application Shell.
- `tests/build256-signed-event-revocation.test.mjs`: synthetic **test-only generated** ephemeral Ed25519 pairs, forged/expired/reused/revoked pin cases, signature tamper tests, held delivery plan and app theme invariants.

## Protected configuration names (do not put values in GitHub)
The values must be **genuine independently issued source and custodian evidence**, not fabricated examples:
- `ICAMP_BUILD256_ORIGINAL_EVENT_JSON` — one original Ed25519-signed source packet with v1 envelope and safe non-sensitive metadata only; 15-minute issuance; no guest/customer/payment PII.
- `ICAMP_BUILD256_ORIGINAL_ISSUER_PIN_JSON` — original custodian-attested Ed25519 SPKI public pin (not a private key), fingerprint, exact issuer source revision, key ID, expiry and revocation status.
- `ICAMP_BUILD256_SOURCE_CUSTODIAN_ENROLLED=true` — **only when** externally independently enrolled; an environment flag is not proof of enrollment.
- `ICAMP_BUILD256_ISSUER_REVOCATIONS_JSON` — array of independently verified original issuer revocation metadata; empty array permissible only when there is genuinely no revoked issuer.

Existing three-Master protected receipt/pin variables, signed DB provenance, genuine production `DATABASE_URL`, expected DB host and source SHA must remain separately verified. Never paste keys or passwords in a public issue.

## Runtime permissions and security
- Every admission enforces the existing owner_admin role, `staff.manage`, `reservation.modify`, current `aal2` session and signed original evidence from protected server settings. Every one is required; no browser can supply signer evidence.
- Source envelope `rosevear.seven-app-source-envelope.v1` rejects unapproved fields, guest PII and cross-brand tenant routing; Ed25519 signature uses a fixed ordered `rosevear.seven-app-signed-event.v1` domain.
- Database rejects globally duplicated nonce or receipt digest even when another tenant or user retries. Source and revocation receipts are immutable, signed original and reviewed by different users. Renewal warnings and revocations remain HOLD until independently issued source renewal or reviewer evidence.
- Each reviewed revocation queues only a non-sensitive per-Master **hold-undelivered** record. The three Masters: ai-data-platform, rosevear-ai-hub, rosevear-comms-hub. Devil n Dove and Rosie Dazzlers have independently typed Master contracts, but this build does not bypass their original credentials, media/booking consent or direct communication authority.
- A signing pin revoked by genuine original custodian evidence is rejected. A database receipt revocation cannot retroactively rewrite the original; it creates separate immutable evidence. Cross-app revocation propagation requires a future independently approved transport and genuine recipient ACK (not implemented here).

## Theme, shell and branch boundaries
- iCamp and YW are the **two governed Slave Application Shells**. Existing Build 407 iCamp shell banner remains visible in both AppShell and SysopShell. iCamp retains independently themed Standard/Meadow and selectable Orbit.
- The three Masters must share the **same instrument-style theme**; Build 256 does not change the separate Master repositories. Verify their live theme settings independently before marking that cross-app requirement complete.
- Devil n Dove and Rosie Dazzlers remain direct Master-connected applications rather than Slave Shells. Read-only schema and handoff contracts are provided; **live communication is not proved** without original signed handshake and actual receiver ACK.
- GitHub branch policy: only `dev` and `main` should be retained after protected promotion. Feature/release branches needed for review are temporary. Preserve open unmerged PRs and do not delete their unique work until independently reconciled.

## Release gates and operational HOLD
Pass Node unit, lint, formatting, TypeScript, browser end-to-end, isolated PostgreSQL migration+idempotency, CodeQL, Secret Scan, exact-SHA Vercel Preview READY, source-exact main release checks, then exact SHA Production READY, live HTTP/version and runtime error review. A disposable CI migration is not evidence that production migration 0235 was adopted; never apply 0235 to an unverified live Supabase target.

**Distinct HOLD gates:** original source custodian enrollment, authentic original three-Master signed evidence, physical-host OFF authority, production DB migration 0234/0235 adoption, actual T5 transport and ACK, brand customer consent, receiver ON and formal owner ACCEPTED.

## Next queued
**Build 257 — Consent-Aware Inbox, Telephone/SMS/IVR Handoff and Role-Isolated Contact Tasks.** Builds 257–264 remain proposed, with measurable completion requiring independently reproducible baselines.
