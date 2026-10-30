# Build 159 — Tenant Subscription Adapter Foundation, Versioned Subscriber Consent Receipts & Independent Omnichannel Evidence Reconciliation (HELD)

## Delivered

- The new **Standard** theme (v1, Meadow & Evergreen) uses shared presentation tokens, a locally hosted, generated meadow-and-lakeside photographic banner, dark evergreen operational surfaces, responsive navigation, compact status cards and accessible colour/focus contrast. The same theme applies to camper-facing, Management, I.T., statistics and status pages without forking their business/domain markup. Operational status meanings are separate immutable tokens, suitable for future alternate theme sets.
- `/launch/subscriptions` shows the tenant subscription contract, explicit versioned consent design, and sanitized independent evidence reconciliation worksheet. It is an intentionally public-safe view with no customer, secret, signer or private proof content.
- `lib/tenant-subscription/foundation.mjs` provides a strict provider-identifier allowlist, disabled adapter operation contract and explicit recurring subscription, invoice, charge dispute/refund and fraud event expectations. No Stripe SDK, credential, checkout, webhook handler or live subscription action is created by this foundation.
- Consent document versions are validated and deterministically digested to illustrate how immutable versions could be bound to acceptance. These **unsigned preview records are not signed, legally binding, authenticated, stored, or actual consent receipts**. Real receipts require a reviewed document-version registry, authenticated actor, explicit acceptance, verified time and append-only tenant-isolated persistence.
- Migration `0184_build159_subscription_consent_foundation.sql` provides a private, unseeded document-version registry and append-only, tenant-owned consent receipt table. It requires published document versions on insert, prohibits editing or deleting acceptance events, enforces private RLS and exposes no application write policy; no live acceptance route exists yet.
- Nine nonsecret evidence states are reconciled locally. Owner-reported status, even `INDEPENDENTLY_REVIEWED`, never substitutes for original private signer/witness/reviewer evidence, signed source proof B, independent tenant isolation or explicit TEST-only authorization. Exports are allowlisted and cannot authorize any operation.

## Verification boundary

- Application deployment GREEN means code and public smoke checks passed, not that subscriber charges or cross-app connectivity are live.
- Tenant recurring billing, Checkout, portal, webhooks, renewals, cancellations, disputes, refunds, and invoices remain **DISABLED / NOT IMPLEMENTED** until a provider is authorized and independently reviewed sandbox scenarios pass.
- Subscriber legal wording and accepted versions remain **UNAPPROVED / NOT COLLECTED**; a lawyer/operator must approve agreements, renewal and cancellation notices, privacy and tax treatment. Stripe Tax (or another provider tax service) still requires relevant registrations before actual collection.
- Six-app Comms Hub stays **DISCONNECTED / HOLD**. No authenticated gateway GETs, SMS, calls, dispatch, gate operations, production charges, or external notifications were performed.

## Next work

1. Confirm the SaaS billing provider and choose separate provider sandboxes; establish restricted environment credentials, webhook signature validation, idempotency and per-tenant billing data boundaries. Implement the reviewed adapter and tested lifecycle before enabling actions.
2. Approve and publish Canadian subscriber terms and privacy versions, then implement authenticated, append-only consent persistence and renewal/cancellation disclosure receipts.
3. Obtain independently verifiable six-app original source proofs and private authorization returns. Only after explicit owner TEST-only approval consider bounded nonproduction GET checks.

## Visual asset provenance

`public/themes/standard/meadow-hero.webp` was generated specifically for iCamp as an original photorealistic summer campground scene (Ontario-style lake, forest, fresh grass and cabin). No third-party image URLs or external runtime image dependencies are required.
