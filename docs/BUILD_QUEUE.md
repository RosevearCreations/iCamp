# iCamp Active Build Queue

Current program: **iCamp2027**

## Pre-Implementation Engineering Baseline
The repository, CI and security engineering foundation is complete and already promoted. It is intentionally **unnumbered** so it does not conflict with the restarted product roadmap.

See `docs/PRE_IMPLEMENTATION_BASELINE.md`.

## Active roadmap
The active roadmap contains **156 builds** and covers the full iCamp2027 source of truth, including Web/PWA, IVR/DTMF and SMS/MMS channel parity.

## Completed active builds
- **Build 001 — Responsive PWA & Omnichannel Application Shell: GREEN on `dev`, pending/under production promotion.**

## Next active build
**Build 002 — Environment, Configuration & Health Framework**

Status: **QUEUED — NOT STARTED**

## Operating rule
- Work primarily on `dev`.
- Promote to `main` only after applicable gates are GREEN.
- Every feature must declare Web/PWA, IVR/DTMF and SMS support or a documented safe/visual fallback.
- Prefer free software/free development tiers where practical without creating provider lock-in.
- Keep migration paths to larger managed or self-hosted infrastructure.
- If manual input is unavoidable, provide exact step-by-step instructions.
- Otherwise proceed autonomously using connected tools.
- Provide a detailed completion summary after each build.
