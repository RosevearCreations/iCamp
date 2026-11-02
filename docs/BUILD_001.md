# Build 001 — Responsive PWA & Omnichannel Application Shell

## Status
**FULLY PROMOTED — `main` verification GREEN.**

## Objective
Create the active iCamp application shell without prematurely implementing campground business modules.

The shell establishes the surfaces and contracts that every later build will use:
- Web/PWA;
- mobile/tablet/desktop layouts;
- IVR/DTMF;
- SMS/MMS;
- email/push notification surfaces;
- role-specific application workspaces.

## Delivered workspaces
The shell now exposes data-driven routes for:
- Public & Visitor;
- Guest & My Stay;
- Front Desk & Reservations;
- Maintenance & Housekeeping;
- Security & Access;
- Store & POS;
- Staff;
- Foreman & Supervisor;
- Management & Administration;
- Finance & Accounting.

All workspace definitions live in a shared registry rather than being embedded independently in navigation components.

## Responsive application shell
Delivered:
- persistent desktop workspace navigation;
- tablet adaptation;
- horizontally scrollable mobile workspace navigation;
- responsive cards/panels;
- touch-sized navigation targets;
- skip-to-content accessibility link;
- visible keyboard focus;
- reduced-motion support;
- semantic navigation, main content and headings;
- custom not-found shell.

Responsive breakpoints are explicitly tested at the repository level and the production Next.js build renders every registered workspace route.

## PWA baseline
Delivered:
- application manifest;
- standalone display mode;
- theme/background metadata;
- scalable application icons;
- service-worker registration;
- navigation-safe offline fallback shell;
- portable Next.js standalone production output.

The service worker deliberately limits fallback behavior to navigation requests so failed JavaScript, CSS or other assets are not incorrectly replaced with HTML.

## Omnichannel contract
A reusable channel-capability model now defines:
- Web/PWA;
- IVR/DTMF;
- SMS/MMS;
- secure-link fallback;
- staff-transfer fallback;
- not-applicable status for inherently graphical/unsafe operations.

Every workspace carries an explicit channel-support declaration.

Build 001 does **not** pretend unfinished telephone/SMS business workflows exist. It establishes the contract that later domain builds must satisfy through the same canonical backend.

## Flexibility and live-application architecture
The source of truth now explicitly treats iCamp as a continuously evolving application.

Architecture requirements include:
- modular bounded capabilities;
- data-driven workspace/channel configuration;
- feature flags for staged changes;
- provider adapters;
- versioned configuration;
- portable internal identifiers;
- backward-compatible schema evolution where practical;
- migrations with recovery paths;
- no campground-specific assumptions embedded into core infrastructure.

A new `docs/BUILD_OPERATING_MODEL.md` records the autonomous development, manual-intervention, free-first and verbose build-summary rules.

## Free-first and scale-ready development
Build 001 requires no paid software or service.

The application remains portable through:
- standard TypeScript/React/Next.js;
- standalone server output;
- provider-neutral external-service boundaries;
- planned PostgreSQL portability;
- sandbox/mock integration strategy for future telephony, payments and access hardware.

Free development tiers may be used later, but core campground business logic must not depend on remaining on those tiers.

## Security
Build 001 introduces no real guest, staff, payment or campground data.

Security properties:
- no provider secrets required;
- no business authorization bypasses introduced;
- telephone/SMS actions remain contracts only;
- caller ID is not treated as identity;
- sensitive finance workspace defaults to secure-link/staff-transfer for non-web channels;
- existing secure headers remain enabled;
- secret scan passes;
- production dependency audit passes;
- CodeQL configuration remains eligibility-aware because the private repository does not currently have the paid GitHub Code Security entitlement.

## Important files/modules
- `components/app-shell.tsx`
- `components/channel-support.tsx`
- `components/service-worker-registration.tsx`
- `lib/workspaces.ts`
- `lib/channels.ts`
- `app/workspaces/[workspace]/page.tsx`
- `app/manifest.ts`
- `app/not-found.tsx`
- `public/sw.js`
- `public/icons/icon.svg`
- `public/icons/maskable.svg`
- `docs/BUILD_OPERATING_MODEL.md`

## Verification evidence
Current `dev` verification passed:
- formatter canonicalization;
- ESLint with zero warnings;
- strict TypeScript typecheck;
- repository/application invariant tests;
- production Next.js build;
- production dependency audit at high/critical threshold;
- full dependency audit artifact capture;
- Gitleaks secret scan.

Repository invariants now also verify:
- exactly Builds 001–156 remain in the active roadmap;
- all source-of-truth documents remain linked;
- all 10 workspaces remain registered;
- Web/IVR/SMS capability types remain present;
- PWA/standalone deployment baselines remain present;
- responsive/accessibility shell rules remain present;
- free-first/provider-adapter/scale-migration principles remain documented;
- autonomous build operating rules remain documented.

## Promotion and release verification
The Build 001 application changes were promoted through the protected dev-to-main workflow and verified on the production/release branch.

Application promotion verification commit: `feb14d3b1c966f51d34d414f164534083500bd6d`.

Production/release verification passed:
- formatter;
- lint;
- strict TypeScript;
- automated tests;
- production Next.js build;
- production dependency audit;
- full dependency audit capture;
- Gitleaks secret scan.

CodeQL remains configured but is skipped because the repository is private and the current GitHub account does not have the private-repository Code Security entitlement.

## Deployment
No external production hosting provider is configured in Build 001 by design.

The repository production/release branch is `main`. Build 001 promotion therefore verifies the release branch and GitHub security/CI gates. A hosted dev/production environment will be introduced only when the roadmap calls for environment/deployment configuration, avoiding premature provider lock-in.

## Manual action
**None.**

No account, payment method, telephone number, database, domain or secret is required for Build 001.

## Next build after promotion
**Build 002 — Environment, Configuration & Health Framework.**
