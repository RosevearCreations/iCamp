# Build 199 — Tenant Subscription Sandbox Lifecycle & Legal Consent Gate

## Delivered (safe, default-off)

- The protected I.T. page `/workspaces/it-analysis/subscription-sandbox` offers four reproducible synthetic fixture scenarios: initial checkout/renewal, failed invoice/retry recovery, cancellation, and dispute/refund follow-up. Staff can compare states and export a source-hashed JSON readout from `/api/it/subscriptions/sandbox?scenario=normal` (or `recovery`, `cancellation`, `dispute`). Both routes require the new `subscription.sandbox.run` permission.
- An in-memory HMAC SHA-256 test signing key authenticates each synthetic event. The test verifier rejects altered bodies, stale timestamps (over five minutes), non-test-mode events and unsupported schemas. Existing replay enforces per-tenant scope, event allowlist, legal state transition order and duplicate-delivery idempotency. No provider calls, payments, database writes, live invoices, external messages or customer records are made.
- Signed fixture results and synthetic SHA-256 source digest are for **local CI evidence only**. These signatures are NOT official Stripe webhook signatures, provider receipts or independent issuer attestation. The ephemeral signing secret is generated per request, never logged or stored, and zeroed after use. It cannot authorize a live payment.
- Migration `0213` adds separate `subscription.sandbox.run` and `subscription.sandbox.review` elevated/high-risk permissions. Owner administrators receive both; I.T. administrators can run fixtures only; Finance can review only. A real reviewer must be a separate authenticated person, even if the owner has both permissions. Neither privilege implies `payment.capture`, `refund.issue`, legal publication or a production billing capability.
- Versioned, affirmative consent is demonstrated with an explicit authenticated **test actor** and independent reviewer, using the existing digest-bound preview. The resulting preview remains unsigned, unpersisted and **not a legal acceptance receipt**. Existing private `subscriber_document_versions` and append-only `subscriber_consent_receipts` storage foundations remain inaccessible to app writes pending reviewed legal source and authenticated subscriber workflow.
- Platform SaaS subscriptions remain distinct from **campground guest payments**. Billing, checkout, customer portal, webhook ingress and automatic tenant activation all remain **OFF / HELD** by design, even after a GREEN code deployment.

## Verification

Run `node --test tests/build199-subscription-sandbox.test.mjs`; the standard `npm run verify` also includes it. The test exercises all four scenarios, in-memory signature and clock validation, tampering, replay/deduplication, cross-tenant rejection, non-test rejection, consent version and actor separation, restricted GET-only API and missing legal/provider evidence. The protected UI has a query-driven, keyboard-accessible scenario selector, no state-changing operations and no public cache.

## What is still genuinely unverified

| Gate | Current original evidence | Result |
| --- | --- | --- |
| Official billing provider TEST checkout, renewal, failed invoice, cancellation, refund and dispute receipt IDs | Not attached | **HELD** |
| Issuer-signed TEST webhook examples and verified secret custody/rotation | Not attached; synthetic HMAC does not count | **HELD** |
| Published Canadian terms, privacy, cancellation, tax/fee wording, version hashes and independent legal approval | Not attached | **HELD** |
| Authenticated real subscriber's affirmative, durable, append-only consent receipt | No live write path | **HELD** |
| Owner-authorized production billing rollout and revenue/tax reconciliation | Not granted | **HELD** |

## Safe next steps (separately authorized)

1. Select a provider and configure **TEST-only** credentials through its approved secret manager, separate from production, with role-scoped access and rotation. Do not put keys into the repo or public database tables. Follow official provider API/payment method and webhook-signature guidance.
2. Test actual sandbox checkout, invoice renewal, retry, cancellation, refund and dispute using original provider event IDs/signatures; reconcile each idempotent event to the correct tenant without enabling live charges.
3. Independently review legal documents, tax registration and local counsel requirements; publish exact version and content digests; design an authenticated, append-only subscriber consent service with denial/revocation/version-change tests.
4. Record issuer-origin evidence, signer, reviewer, owner authorization, staging deployment SHA and rollback controls before any production activation request. Missing source or approval means **NO-GO** regardless of application deployment.

**Release distinction:** Build 199 can be production GREEN for the guarded sandbox/reporting code while the commercial SaaS billing feature remains HELD. No official billing integration or legal acceptance was asserted or performed.

**Next:** Build 200 — Full Guest/Staff Pilot Acceptance, Omnichannel Proof Review & Go-Live Decision.
