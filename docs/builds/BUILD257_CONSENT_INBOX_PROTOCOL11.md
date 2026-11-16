# iCamp Build 257 — Consent-Aware Inbox and Independent Protocol 1.1 Releases

## Local product functionality
This release extends iCamp's **existing** Build 009–015 private provider-neutral messaging, telephone, DTMF, IVR and Build 014 STOP/START/HELP consent policy. It does not introduce a parallel gateway, does not assume a working telephone/SMS provider, and does not copy contact data into Master apps.

New MFA-protected /workspaces/management/campgrounds/contact-inbox is for real campground staff. Current staff with communications.read may review role-visible tasks; communications.manage can admit a task from an **existing original inbound provider event**, and authorized staff may acknowledge, escalate or resolve subject to role/permission checks. Source event IDs, tenant scopes and cryptographic idempotency digests are stored; customer names, phone numbers, raw messages, DTMF digits and media are not stored in the new inbox.

Build 257 adds:
- lib/release/build257-contact-inbox-core.mjs — protocol 1.1/1.0 read-only compatibility, deny-by-default capability negotiation, consent gate and role checks, and metadata-only Master handoff planning.
- lib/release/build257-contact-inbox-postgres.mjs + .d.mts — original private provider event selection, tenant-scoped staff queue, immutable action trail, current canonical SMS/MMS consent evaluation, role-respecting readback and audit.
- database/migrations/0236_build257_consent_inbox_protocol11.sql — three append-only public-schema tables with FORCE RLS, restrictive **role-isolation** policies, source-bound inbound event verification, and a hold-only Comms Master escalation queue.
- database/verify/0236_build257_consent_inbox_protocol11.sql — migration guards, role isolation, source idempotency and restricted grants checks, run in CI's disposable PostgreSQL instance.
- tests/build257-consent-inbox-protocol11.test.mjs — legacy peer compatibility, unavailability isolation, no PII or direct sender claims, STOP/consent withdrawal negative tests, role denial and replay digest scope.

## Protocol 1.1 compatibility (Build 408)
Source specification: https://github.com/RosevearCreations/ai-data-platform/blob/main/docs/BUILD_408_FINE_GRAINED_AUTHORIZATION_CONSENT_INDEPENDENT_SYNC.md

- Local protocol 1.1 is **additive** and continues to read **1.0** basic source health/capabilities when the peer explicitly advertises them. The new `campground.contact.handoff.read` capability requires peer 1.1, with no write side effect.
- A missing or incompatible Master holds **only the dependent cross-app feature**. Independent iCamp local operations continue; a Vercel limit on iCamp/YW/AI Data Platform need not block separate four-app updates.
- Unknown capabilities, breaking schema changes and remote writes fail closed. Breaking changes require a new major protocol and explicit authenticated peer handoff, never implicit fallback.
- No direct peer database sync, no raw secret synchronization, no shared mutable app state and no seven-app lockstep release.
- Merely negotiating 1.0 or 1.1 does **not** prove original Ed25519 signer custody, a genuine bidirectional session, consent, producer/recipient identity, tenant grant, durable remote ACK, or `CONNECTED`.
- Cross-app target is `rosevear-comms-hub` **metadata-only**, held `hold_undelivered`. Devil n Dove and Rosie Dazzlers retain direct Master identities but **no iCamp guest data** or unapproved brand routing. Local queue has no delivery worker, receiver ON switch or network sender.

## Consent and role protections
- The existing canonical STOP/START/HELP processor remains authoritative. This new inbox cannot store or send raw inbound keywords; marketing must have positive current consent and any provider suppression/disabled preference forbids normal outbound SMS/MMS.
- Consent is checked **when a staff member asks to review follow-up**, against canonical private messaging preference/consent tables. This reports **eligibility only, never actual provider dispatch**. Outbound delivery would need a fresh check in the existing provider adapter at send time. Telephone/IVR remains manual.
- Intake selects a genuine existing `communication_provider_events` record attached to an inbound `communication_dispatches` record and active phone endpoint from the same organization/campground. Unknown, cross-tenant, synthetic or unlinked events fail closed.
- The staff queue binds three roles: front_desk (communications.read), communications_reviewer (communications.manage), campground_owner (owner_admin). FORCE-RLS **restrictive** select policies enforce per-role read visibility, not only button access.
- Task `acknowledge` needs communications.read, `escalate` needs communications.manage, `resolve` needs current campground.owner_admin or campground.operations.manage plus communications.manage. Every action requires MFA AAL2, current assignment and organization/campground scopes.
- Immutable action and source event digest unique constraints prevent duplicate provider-event intake and repeated per-actor action. No staff action can rewrite an original and no handoff row can claim provider delivery.

## Release and operational gates
1. Source feature PR to `dev`: Prettier, lint, TypeScript, Node tests, browser and isolated PostgreSQL migration/verification, security scans and exact-SHA Vercel preview READY.
2. Merge `dev` only after verified green; prepare source-exact production transfer from reviewed files (existing `dev`/`main` history diverges, so never bulk merge unrelated changes).
3. Production PR to `main`: repeat all protected checks and exact-SHA preview, then merge, verify main production Vercel READY at the exact merge SHA and live `/api/version`, health and homepage HTTP readbacks; scan runtime errors.
4. **No extra deployments** for intermediate file commits; batch reviewed content into a single candidate commit on each branch to preserve Hobby build quota.

Distinct operational HOLDs include real production migration 0236 adoption, original provider account/webhook authority and actual inbound traffic, independently signed remote Master/brand connections, SMS/voice provider sending, remote ACK and owner acceptance. CI's disposable PostgreSQL migration does not prove live production DB adoption.

Themes: iCamp Standard/Meadow and Orbit selection remain unchanged; existing iCamp/YW Slave Application Shell classification remains explicit. Three Master instrument-theme parity is governed in their own repos, not an iCamp code change.

**Next queued:** Build 258 — Guest Booking and Site Map Improvements, Reservation Holds, Waitlist and Date Clarity.
