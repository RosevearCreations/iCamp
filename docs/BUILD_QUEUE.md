# iCamp Active Build Queue

Current program: **iCamp2027**

## Pre-Implementation Engineering Baseline
The repository, CI and security engineering foundation is complete and already promoted. It is intentionally **unnumbered** so it does not conflict with the restarted product roadmap.

See `docs/PRE_IMPLEMENTATION_BASELINE.md`.

## Active roadmap
The active roadmap contains **156 builds** and incorporates the complete iCamp vision, including Web/PWA, IVR/DTMF and SMS/MMS channel-parity requirements.

## Completed active builds

### Build 001 — Responsive PWA & Omnichannel Application Shell
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- responsive phone/tablet/desktop shell;
- PWA baseline;
- ten role-specific workspace shells;
- data-driven workspace registry;
- Web/IVR/SMS channel-capability contract;
- free-first/scale-ready architecture;
- autonomous build operating model;
- portable standalone application output.

## Next active build
**Build 002 — Environment, Configuration & Health Framework**

Status: **QUEUED — NOT STARTED**

## Operating rule
- Work primarily on `dev`.
- Promote to `main` only after applicable gates are GREEN.
- Every feature must declare Web/PWA, IVR/DTMF and SMS support or a documented safe/visual fallback.
- Prefer free/open-source software and free development tiers while preserving scale/migration paths.
- Treat iCamp as a live application whose requirements can evolve through versioned, modular changes.
- If manual input is unavoidable, provide exact step-by-step instructions.
- Otherwise proceed autonomously using connected tools.
- After every completed build, provide the detailed summary defined in `docs/BUILD_OPERATING_MODEL.md`.
