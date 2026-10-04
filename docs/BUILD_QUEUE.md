# iCamp Active Build Queue

Current program: **iCamp2027**

## Pre-Implementation Engineering Baseline
The repository, CI and security engineering foundation is complete and already promoted. It is now intentionally **unnumbered** so it does not conflict with the restarted product roadmap.

See `docs/PRE_IMPLEMENTATION_BASELINE.md`.

## Roadmap reset
The active roadmap has been rebuilt from the complete design, including:
- campsites and rental cottages;
- 10-image accommodation galleries;
- zoom-stable overhead map plotting;
- pools/washrooms/water parks/sports facilities as maintainable assets;
- seasonal/yearly winterization and winter-readiness;
- permanent-unit ownership/sales/financing;
- visitors, road vehicles, golf carts/e-bikes and passes;
- key-card/keypad/gate security with audited overrides;
- events and local destination promotion;
- garbage pickup/stickers;
- waterfront/boats/docks;
- store/POS/rentals/finance;
- telephone voice/IVR/DTMF numeric-keypad access;
- SMS/MMS interaction and channel-parity requirements.

The active roadmap contains **156 builds**.

## Next active build
**Build 001 — Responsive PWA & Omnichannel Application Shell**

Status: **QUEUED — NOT STARTED**

Build 002 from the previous roadmap is cancelled/superseded by this reset.

## Operating rule
- Work primarily on `dev`.
- Promote to `main` only after applicable gates are GREEN.
- Every feature must declare Web/PWA, IVR/DTMF and SMS support or a documented safe/visual fallback.
- If manual input is unavoidable, provide exact step-by-step instructions.
- Otherwise proceed autonomously using connected tools.
