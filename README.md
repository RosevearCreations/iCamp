# iCamp

**Program:** iCamp2027

iCamp is a complete campground operations platform covering live campsite/cottage booking, a virtually realistic overhead map, maintenance, physical access/security, front desk, guest services, telephone/IVR/DTMF/SMS interaction, events/local-interest promotion, POS/store delivery, rentals, waterfront operations, staffing, vendors, finance, reporting and management.

## Branches

- `main` — production/release
- `dev` — integration/staging

## Source of truth

- [Master Vision](docs/MASTER_VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Build Roadmap](docs/BUILD_ROADMAP.md)
- [Requirements Coverage Matrix](docs/REQUIREMENTS_COVERAGE.md)
- [Omnichannel Voice / DTMF / SMS](docs/OMNICHANNEL.md)
- [Security Standard](docs/SECURITY.md)
- [Web, Mobile, SEO & Discovery](docs/SEO_WEB_DISCOVERY.md)
- [Active Build Queue](docs/BUILD_QUEUE.md)
- [Pre-Implementation Engineering Baseline](docs/PRE_IMPLEMENTATION_BASELINE.md)
- [Build Operating Model](docs/BUILD_OPERATING_MODEL.md)
- [I.T. & Analysis](docs/IT_ANALYSIS.md)
- [Database](database/README.md)
- [Contextual Help](docs/HELP_SYSTEM.md)
- [Admin Freshness & Refresh](docs/ADMIN_FRESHNESS.md)
- [Authentication & Secure Sessions](docs/AUTHENTICATION.md)
- [Authorization & Row-Level Security](docs/AUTHORIZATION.md)
- [Audit Trail & Privileged Actions](docs/AUDIT_AND_PRIVILEGED_ACTIONS.md)
- [Background Jobs, Scheduler & Queues](docs/BACKGROUND_JOBS.md)
- [Secure Media & Document Storage](docs/MEDIA_STORAGE.md)
- [Omnichannel Communications Foundation](docs/COMMUNICATIONS.md)
- [Voice & IVR Gateway](docs/VOICE_IVR.md)
- [Numeric Keypad / DTMF Engine](docs/DTMF.md)

The completed repository/CI foundation is now an **unnumbered pre-implementation baseline**.

The original restarted roadmap covers **Builds 001–156**. Development continued through Build 170, and the [next 30-build extension (171–200)](docs/BUILD_171_200_FUTURE_QUEUE.md) now records planned improvements to guest experience, staff workflows, management and launch readiness. Planned builds are not delivery or provider-activation claims. The original roadmap begins with:

The extension's early implementation checkpoints include [Build 171 recovery/escalation/owner-request](docs/BUILD_171_RECOVERY_SNAPSHOT_OWNER_REQUEST.md) and [Build 172 independent owner review intake/evidence readback](docs/BUILD_172_INDEPENDENT_OWNER_INTAKE_LEDGER.md). Build 172 does not activate a server-side decision ledger or owner acceptance: its submission contract remains disabled until independent authorization, original evidence and immutable tenant-scoped storage exist. Billing and Omnichannel remain HELD.

[Build 173 public campsite/cottage discovery](docs/BUILD_173_DISCOVERY_COMPARISON_ACCEPTANCE.md) adds campground-maintained accessibility, fit, amenities and photo filters, a synchronized text/map view, and browser-local three-way comparison with live hold/source rechecks. No payment, provider call or independently certified accessibility claim is introduced.

[Build 174 transparent pricing preview](docs/BUILD_174_TRANSPARENT_QUOTE_ACCEPTANCE.md) adds canonical nightly allocation, itemized mandatory and optional charges, source-configured deposit/refund terms, a ten-minute expiry and printable current summary. No tax-inclusive grand total is claimed until real tax rules exist; Billing and Omnichannel remain HELD.

**Build 001 — Responsive PWA & Omnichannel Application Shell**
