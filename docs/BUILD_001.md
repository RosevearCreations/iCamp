# Build 001 — Responsive PWA & Omnichannel Application Shell

## Status
**GREEN on `dev` — ready for production promotion.**

## Objective
Create the active iCamp application shell without prematurely implementing campground business modules.

The shell establishes the surfaces and contracts that every later build will use:
- Web/PWA;
- mobile/tablet/desktop layouts;
- IVR/DTMF;
- SMS/MMS;
- email/push notification surfaces;
- role-specific application workspaces.

## Delivered

### Responsive application shell
A shared `AppShell` now provides:
- branded iCamp header;
- build/status indicator;
- accessible skip link;
- workspace navigation;
- responsive main content area;
- product footer;
- phone/tablet/desktop layout behavior.

Breakpoints are explicitly tested at the shell level:
- tablet/smaller desktop transition at 60rem;
- phone transition at 46rem;
- reduced-motion support.

### Data-driven workspaces
The shell is not hard-coded as ten separate navigation systems.

`lib/workspaces.ts` defines:
1. Public & Visitor.
2. Guest & My Stay.
3. Front Desk & Reservations.
4. Maintenance & Housekeeping.
5. Security & Access.
6. Store & POS.
7. Staff.
8. Foreman & Supervisor.
9. Management & Administration.
10. Finance & Accounting.

The same definitions generate:
- home-page workspace cards;
- shell navigation;
- workspace routes;
- audience descriptions;
- channel-capability declarations.

This makes future workspace additions/reorganization substantially safer.

### Workspace routing
`/workspaces/[workspace]` is implemented using the Next.js App Router and statically generates the known workspace shells.

Unknown workspaces fail safely through the application not-found experience.

### Omnichannel capability contract
`lib/channels.ts` establishes reusable support levels:
- full;
- guided;
- secure-link handoff;
- staff transfer;
- not applicable.

Each workspace explicitly declares support for:
- Web/PWA;
- phone/IVR/DTMF;
- SMS/MMS.

Finance defaults more conservatively to staff-transfer/secure-link behavior for non-web channels because sensitive financial actions should not casually move into voice/SMS workflows.

### Progressive Web App baseline
Build 001 adds:
- Next.js manifest generation;
- standalone display mode;
- theme/background metadata;
- scalable application icons;
- service-worker registration;
- a navigation-only offline fallback cache.

The service worker intentionally does **not** return cached HTML when JavaScript/assets fail. Offline fallback is limited to page navigation so the shell does not hide broken application assets behind invalid responses.

### Deployment portability
Next.js now produces `standalone` output.

This keeps future options open for:
- free development hosting;
- serverless deployment;
- container hosting;
- virtual machines;
- self-hosting;
- larger managed infrastructure.

No Build 001 feature depends on a proprietary hosting API.

### Free-first and live-evolution architecture
The architecture source of truth now explicitly requires:
- free software/free tiers during design and testing where practical;
- no free-tier lock-in;
- standard PostgreSQL-compatible data architecture;
- provider adapters;
- feature flags;
- modular domain boundaries;
- backward-compatible migrations where practical;
- documented scale-up/exit paths for managed providers.

iCamp is treated as a live application that will continue changing over time.

### Accessibility baseline
Build 001 includes:
- semantic page/header/nav/main/footer structure;
- keyboard navigation;
- skip-to-main-content link;
- visible focus states;
- touch-sized navigation;
- text-responsive layouts;
- reduced-motion handling;
- non-visual channel contract for future telephone/text workflows.

## Channel support matrix

| Surface | Web/PWA | IVR/DTMF | SMS/MMS | Notes |
| --- | --- | --- | --- | --- |
| Public/Visitor | Full shell | Guided contract | Guided contract | Domain workflows arrive later |
| Guest/My Stay | Full shell | Guided contract | Guided contract | Domain workflows arrive later |
| Front Desk | Full shell | Guided contract | Guided contract | Privileged actions require authentication later |
| Maintenance | Full shell | Guided contract | Guided contract | Suitable field actions will receive phone/text equivalents |
| Security | Full shell | Guided contract | Guided contract | High-risk commands require stronger authentication |
| Store/POS | Full shell | Guided contract | Guided contract | Payments remain provider-controlled |
| Staff | Full shell | Guided contract | Guided contract | Authentication required |
| Foreman | Full shell | Guided contract | Guided contract | Authentication required |
| Management | Full shell | Guided contract | Guided contract | Privileged actions require stronger authentication |
| Finance | Full shell | Staff transfer | Secure-link handoff | Sensitive financial work remains protected |

## Security decisions
- No feature-specific privileged operations are implemented yet.
- No real provider credentials are required.
- No secrets are added to client bundles.
- Caller ID is not treated as authentication.
- Future channel actions must route through the same server-side authorization/business-service layer.
- Secret scanning passes.
- Production dependency audit passes.
- CodeQL remains eligibility-aware and is skipped for this private repository until private code scanning is available.

## CI/tooling modernization
During Build 001 the repository's GitHub Actions were updated to current Node 24-compatible major versions:
- `actions/checkout@v7`;
- `actions/setup-node@v7`;
- `actions/upload-artifact@v6`;
- `github/codeql-action@v4`.

Gitleaks remains on the current v3 action established in the pre-implementation baseline.

## Automated verification
The repository test suite now verifies:
- required source-of-truth documents;
- exact active Build sequence 001–156;
- separation of the unnumbered pre-implementation baseline;
- omnichannel source-of-truth requirements;
- all ten workspace definitions;
- Web/IVR/SMS capability contract;
- PWA manifest and service worker;
- standalone deployment output;
- free-first/scale-migration architecture;
- responsive phone/tablet breakpoints;
- reduced-motion support;
- skip-link accessibility.

## Dev gate result
Latest Build 001 `dev` verification passed:
- formatting;
- ESLint;
- strict TypeScript;
- repository/unit tests;
- Next.js production build;
- production dependency audit;
- full dependency-audit capture;
- Gitleaks secret scan.

## Manual action
**None.**

Build 001 deliberately does not require:
- hosting account setup;
- database account setup;
- telephone/SMS number purchase;
- payment-provider setup;
- DNS changes;
- production secrets.

Those are introduced only when a later build genuinely needs them.
