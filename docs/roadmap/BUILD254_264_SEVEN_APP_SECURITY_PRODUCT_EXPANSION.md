# iCamp Builds 254–264 — Ten-build cross-application security and product expansion

**Prepared 2026-11-14.** This is an owner-directed proposed release sequence,
not an assertion that work is complete. Build 254 implements foundational code.
**Queued after 254: ten meaningful Builds 255–264.** Additional work may still
be necessary; there is no valid total-to-finished percentage without measured
baselines and signed acceptance.

## Release standard across all seven apps

1. **ai-data-platform** (top-tier Master): versioned schema/contract, validation
   source, platform-level assurance scorecard, signed evidence custody
2. **rosevear-ai-hub** (Master): original-host physical OFF state, owner-gated
   on-prem/local execution, independent security/audit readbacks
3. **rosevear-comms-hub** (Master): signed messaging/intake authority,
   consent/retention, brand-safe communication, separation of production/TEST
4. **iCamp** (governed campground external shell): tenant booking, payment,
   staff, guest, equipment and campground independent approvals
5. **YW** (governed external shell): job, routing, equipment, worker and
   seasonality integration via separately authenticated contracts
6. **devilndove** (direct Master app): product/order/media workflows; brand-safe
   and tenant-safe notifications; no iCamp guest data
7. **rosiedazzlers** (direct Master app): detailing booking, deposits, media,
   staff/vehicle workflows with separate authorization

The ordering above follows the owner. Actual Master tiers remain rooted in
ai-data-platform; iCamp/YW are external shells; the two brand applications are
direct Master applications, **not additional shell tenants**.

### Unified six-tier security (enforced per application, never by shared UI label)

- **T0 Public discovery** — read-only, no private credentials or inference of CONNECTED
- **T1 Source integrity** — exact repo/commit SHA, canonical source digest, schema versions
- **T2 Cryptographic custody** — independently pinned Ed25519 origins and signature freshness
- **T3 Tenant/role/device scope** — MFA, least privilege, tenant separation and device policies
- **T4 Independent reviewer/owner authority** — signed source-only evidence, different operator,
  append-only decisions, no self-approval, revocation/escalation and explicit holds
- **T5 Real production communication** — scoped connection grant, bidirectional handshake,
  live transport/receiver observed, privacy and consent boundaries, independently audited owner consent

A PASS at T0–T4 never authorizes T5. Original source HEALTHY, actual production
database migration adoption, Master CONNECTED and formal owner acceptance are
**distinct, fail-closed** gates. Use stable IDs and signed receipts, not copied
private keys or implied authorization from repository links.

## Ten queued builds: 255–264

| Build | Scope | Product tracks advanced | Required cross-app handoff and measurable gates |
| --- | --- | --- | --- |
| **255** | **Seven-app schema/identity contract registry, pin rotation and role/permission matrix** | architecture, integration, auth, secrets, configuration, operations | typed contract for seven IDs and 6 tiers; current keys/pin expiry audited; no app can claim a higher tier without proof; zero plaintext secrets in CI |
| **256** | **Durable signed-event receipt renewal, replay/expiry escalation and revocation propagation** | security, notifications, compliance, incident response | unique nonces per tenant/issuer, deterministic outbox, clock-skew and stale challenge tests, all three Master sources independently verified; old/revoked sources fail closed |
| **257** | **Consent-aware inbox, telephone/SMS/IVR handoff, role-isolated contact tasks** | customer service, marketing, CRM, mobile, accessibility | campground-only consent and suppression tests, staff handoff proof, idempotent message receipts, no cross-brand tenant PII, fallback to manual workflow |
| **258** | **Guest booking and site-map improvements, reservation holds, waitlist and date clarity** | storefront, guest UX, reservations, map, PWA/mobile | concurrent hold conflict tests, guest and front desk parity, readable Meadow desktop/tablet/phone, zero oversold sites in concurrency harness |
| **259** | **Payment, deposit, invoice, refund and accounting reconciliation controls** | finance, taxation, banking, analytics, payments | payment-provider webhook signature verification, refund/void two-person boundary, settlement/reconciliation exceptions, no unauthorized charge/release |
| **260** | **Staff scheduling, work order prep and offline mobile continuity** | HR/payroll, workers, routing, devices, safety | staff/contractor role isolation, offline draft conflict resolution, audit continuity, no payroll or work mutation without approvals |
| **261** | **Inventory, tools/equipment maintenance, suppliers and POS integration** | inventory, materials, supplies, maintenance, store, costing | inventory reservations and reversals atomic, device/photo capture audit, separate permissions, no cross-tenant stock movement |
| **262** | **Seasonal campground operations and safety compliance lifecycle** | site infrastructure, water/septic, winterization, security gates, events | winter-close and spring-open signed checklists, safety exceptions escalated, guest/device gate grants separately authorized |
| **263** | **Guest self-service, photo/site experience, notifications and accessibility audit** | mobile UX, product/media, guest records, content, privacy | cross-device Meadow/Orbit evidence (desktop/tablet/phone), meaningful A11y checks, explicit media privacy grants, signed message receipts |
| **264** | **Cross-app command-centre end-to-end acceptance and measurable business-completion review** | monitoring, reporting, cross-company communication, reliability, security, all modules | seven-app contract topology verified, each Master original source separately signed; cross-tenant data leak tests; incident runbooks; audited owner-gated release; backlog re-estimated using real baselines |

### Target +10 percentage points without inventing progress

At the start of Build 255, obtain an independently reproducible baseline **for
each area**: security, IT/hosting, connection contracts, guest booking/map,
staff and payroll, inventory/supplies/tools, payments/accounting/tax, CRM,
marketing, product/media/store, safety/seasonal, mobile/accessibility,
observability/maintenance. Assign a weighted acceptance checklist with
numerators and denominators, tests, signed reviewer and target. The objective
is **at least +10 percentage points for each area from the baseline by Build
264**, not a universal +10% claim today. If the weighted evaluation does not
meet target, keep that area open; do not claim application completion.

Every numbered build requires GREEN dev and main protected checks, exact
source SHA Vercel READY and live alias readback; a code release is distinct
from user-visible operational permissions or original production-source proof.

### Priorities and non-goals

Start with identity, real signing, revocation and replay controls, then
user-facing guest/staff/payment flows with genuine data, then cross-app
handshake. No synthetic external attestations, no forced CONNECTED,
no automatic receiver ON, no unverified production database migrations, no
unapproved Cloudflare/Supabase/Vercel billing change, no copied guest PII
between separate companies. Preserve **Standard / Meadow** and original hero
photograph as platform theme; Orbit remains a selectable alternative.
