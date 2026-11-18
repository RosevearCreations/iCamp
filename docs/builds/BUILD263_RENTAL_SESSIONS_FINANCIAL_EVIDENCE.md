# iCamp Build 263 — Source-Backed Rental Scheduling, Theme Refinements & Independent Financial Evidence

## Delivery
- Introduces migration 0239 with immutable, FORCE-RLS staff-proposed rental
  sessions. Each session belongs to a real tenant-owned original rental offer,
  source asset and active campground. Staff-only rental.manage permission,
  database original-user context, audited creation/cancellation, tenant-scoped
  foreign keys, 15-minute time steps, one-day duration, 1–30 planning capacity
  and same-asset overlap prevention. This is **not** a guest booking, animal
  handover, ticket, paid allocation, equipment checkout or staff dispatch.
- New /workspaces/management/campgrounds/rental-sessions263 provides an
  auditable guided-session calendar for horse riding, paddling instruction,
  kite clinics and other staff-led activities. The original rental manager
  gains a source inventory coverage summary and session calendar link.
  Unapplied production migration 0239 is shown as HOLD, not silently guessed.
- The four new Build 262 Canadian region themes receive high-contrast
  keyboard focus, mobile selector sizing and reduced-motion refinements.
  Standard / Meadow and Orbit Command remain unchanged.

## Financial evidence
- New /workspaces/management/command/finance-assurance263 checks two
  independently enrolled Ed25519 public keys over the exact provider,
  statement ID/digest, current deployment SHA, currency, cents, external
  reference and expiry. Required protected production configuration:
  ICAMP_FINANCIAL263_ENVELOPE_JSON,
  ICAMP_FINANCIAL263_STATEMENT_ID,
  ICAMP_FINANCIAL263_STATEMENT_DIGEST_SHA256,
  ICAMP_FINANCIAL263_ISSUER_PUBLIC_KEY_PEM,
  ICAMP_FINANCIAL263_REVIEWER_PUBLIC_KEY_PEM,
  ICAMP_FINANCIAL263_ISSUER_ENROLLED,
  ICAMP_FINANCIAL263_REVIEWER_ENROLLED.
- Original keys and institutional identities MUST be authenticated outside
  iCamp before configuration. Self-signed examples are never production
  bank proof. Exact source commit changes invalidate the signed packet.
  The current external payment/refund adapters are still NOT installed.
- The evidence board **always reports live settlement HOLD** until an
  independently authenticated bank/provider API confirms the real clearing
  record and a separate owner-controlled activation exists. No live
  capture/refund, journal posting, bank read, HST remittance or auto-close.
- No fake independent production witness, payment credentials, legal
  certification or bank settlement confirmation has been created.

## Release and source of truth
- Protected CI code checks and a clean migration 0239 test DB are build
  verification only, not proof production applied migration 0239.
- The attached external Word report is created from an audit of the exact
  protected source revision and distinguishes implemented source, held
  integrations and physical original-provider operation.
- dev source-exact promotion, protected main merge, post-merge CI and
  Vercel production readiness are required before code release GREEN.
