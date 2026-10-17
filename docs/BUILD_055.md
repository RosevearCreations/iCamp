# Build 055 — Visitor Registration & Site-Specific Limits

Status: **IMPLEMENTED ON FEATURE BRANCH — promotion verification in progress.**

## Purpose

Build 055 turns the visitor requirements already represented by the Build 033 capacity-rule engine and Build 040 pass catalogue into a formal campground visitor-registration authority. Every visitor is tied to an active host reservation/site, receives a bounded date/time validity window, is evaluated against the effective site-specific visitor maximum, and preserves immutable identity/contact, capacity, fee and visitor-rule evidence.

## Delivered

- campground-scoped visitor registration desk;
- active host reservation/site selection;
- formal one-person visitor registrations with stable visitor numbers;
- day registrations limited to 24 hours;
- week registrations limited to seven days;
- validity constrained to the host reservation window;
- Build 033 site-specific visitor-limit resolution using existing campground, accommodation-type, section, accommodation and campsite-size-band precedence;
- atomic per-site advisory locking and overlapping-registration counting to prevent concurrent visitor-limit overrun;
- explicit support for a configured maximum of zero visitors;
- explicit “no configured maximum” behavior without inventing a limit;
- configurable identity-verification method: none, host attestation or staff visual check;
- configurable contact requirement: none, phone, email, either or both;
- no government-ID number/image storage in Build 055;
- canonical day/week visitor fee selection from the Build 040 charge catalogue;
- free registration activation without fabricated payment;
- paid registration pending state until provider capture succeeds;
- existing Build 042 provider-neutral payment adapter and free mock provider reuse;
- trusted-server payment attempts plus idempotent private provider-event evidence;
- append-only registration lifecycle evidence for registration, payment activation and revocation;
- campground-scoped idempotency protection;
- immutable host, identity/contact-policy, validity, capacity, fee and visitor-rule snapshots;
- explicit revocation without destructive deletion or automatic captured-payment reversal;
- FORCE RLS, direct anon/authenticated denial and least-privilege cross-domain read policies;
- visitor registration authority added to the security and campground-manager role templates;
- global audit events for policy edits, registration, payment activation and revocation;
- contextual help, channel-parity hardening and cross-navigation from the road-vehicle desk.

## Site-specific visitor capacity authority

Build 055 does not create a second capacity-rule system.

The database function icamp_private.resolve_visitor_limit consumes the existing Build 033 capacity_limit_rules and applies the same precedence as the application rule engine:

1. campground;
2. accommodation type;
3. section;
4. individual accommodation.

Within the same scope, an eligible campsite size-band rule is more specific than the default rule. Only rules that set max_visitors participate.

When a visitor is registered, the service and database serialize the selected campground/site with a PostgreSQL advisory transaction lock. Existing open visitor registrations whose validity overlaps the requested window are counted before the new record is accepted. If the new visitor would exceed the effective maximum, the insert fails. The effective maximum and source rule are snapshotted onto the registration so later policy changes do not rewrite historical evidence.

If no Build 033 visitor maximum applies, Build 055 records that no maximum was configured rather than manufacturing a limit.

## Identity and privacy

Campgrounds can configure one of three bounded verification modes:
- no identity check;
- host attestation;
- staff visual identity check.

The registration records the configured method and, when required, the completion timestamp/operator. Build 055 deliberately does **not** store government-ID numbers or ID-document images.

Contact requirements are independently configurable as none, phone, email, either or both. The database preserves the requirement snapshot that applied at registration time.

## Canonical pricing and payment boundary

Build 055 reuses the Build 040 booking_charge_catalog.

Campground managers may select:
- an active fixed-price one-day pass charge;
- an active fixed-price seven-day pass charge.

At registration the visitor record snapshots the canonical charge ID, amount and currency. A database trigger verifies that the snapshot matches the active source charge and the correct day/week duration.

A zero fee activates immediately. A positive fee creates a pending_payment registration. Staff with visitor.register and payment.capture can use the existing Build 042 provider adapter. Successful capture atomically activates the registration.

Raw card/PAN, CVV/CVC and other payment credentials are never stored in the visitor-registration domain. Revoking a captured registration does not silently reverse payment.

## Access credential boundary

Build 055 registers the visitor and preserves the human-readable visitor rule only.

- **Build 056:** access credential abstraction.
- **Build 060:** enforceable access zones, schedules and rules.
- **Build 062:** wristband/QR/pass issuance and validation.
- **Build 063:** credential lifecycle at check-in/check-out.

Build 055 therefore does not fabricate a QR code, wristband number, PIN, key-card token or gate credential.

## Channel parity

- **Web/PWA:** full visitor policy, registration, capacity evidence, payment, history and revocation desk.
- **IVR/DTMF:** verified visitor/host facts use the same canonical visitor.register workflow, while protected identity review and payment use staff/provider handoff.
- **SMS/MMS:** verified guided facts use the same authority with secure-link handoff for protected review/payment. Government-ID details and raw payment credentials are never requested by SMS/MMS.

## Database

Primary migration: database/migrations/0070_visitor_registration_site_specific_limits.sql.

Advisor hardening: database/migrations/0071_build055_advisor_hardening.sql.

Verification:
- database/verify/0070_visitor_registration_site_specific_limits.sql;
- database/verify/0071_build055_advisor_hardening.sql.

Primary tables:
- public.campground_visitor_policies;
- public.visitor_registrations;
- public.visitor_registration_events;
- public.visitor_registration_payments;
- icamp_private.visitor_registration_payment_provider_events.

Hosted Supabase evidence:
- 20261017232511 / visitor_registration_site_specific_limits — applied and verification SQL passed;
- 20261017232536 / build055_advisor_hardening — applied and verification SQL passed;
- Security Advisor after hardening: zero findings;
- Performance Advisor initially identified one Build 055 composite host-accommodation foreign-key index gap; migration 0071 added visitor_registrations_scope_accommodation_fk_idx and removed that finding;
- post-hardening performance output contains only expected INFO-level unused-index observations for newly created or existing indexes, with no Build 055 unindexed-foreign-key finding.

## Cost / provider / asset impact

Build 055 introduces no new paid service, Vercel project, Cloudflare resource, communications provider, production secret or required image asset.

It reuses:
- Build 033 capacity/visitor-limit rules;
- Build 040 canonical pass catalogue;
- Build 042 provider-neutral payment adapter and built-in free mock provider;
- Build 035 reservation/accommodation authority.

## Promotion

Promotion evidence will be filled in only after the exact feature, dev, main and synchronized closeout SHAs pass their applicable gates.

## Next build

After Build 055 is fully GREEN:

**Build 056 — Access Credential Abstraction**
