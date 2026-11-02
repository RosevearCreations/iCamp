# Build 157 — Production Smoke Testing, Tenant Billing Readiness & Omnichannel Connection Verification

Build 157 introduces an anonymous, read-only production smoke runner for the public iCamp status, version, launch readiness and Comms Hub connection pages. The runner requires an exact approved HTTPS iCamp host and a 40-character expected immutable `main` SHA. It uses GET only, sends no credentials, rejects redirects, checks public responses and fails when the deployed SHA differs. Reports are sanitized and never contain response bodies or auth headers.

Run after Production is READY:

```bash
node --use-env-proxy scripts/build157-production-smoke.mjs https://i-camp-pi.vercel.app <actual-main-commit-sha>
```

## Readiness and connection boundary

- Billing readiness: the release gate documents tenant subscription provider setup, signed subscriber terms, cancellation/refund paths, isolated nonproduction tests and finance reconciliation. **No live tenant billing verification or activation** is claimed by this build.
- Omnichannel: the smoke verifies only that the public Comms Hub connection page renders. Signed private connectivity, role custody, trusted proof B, and a bounded authenticated GET test remain **DISCONNECTED / HOLD**. No SMS, calls, dispatch or physical gate commands are attempted.
- Successful Vercel deployment and anonymous smoke do **not** authorize public onboarding or commercial operations. Independent pilot, privacy, billing, backup and support evidence is still required.

The smoke suite deliberately does not call `/api/integration/v1/health` or `/api/integration/v1/capabilities`, because authenticated TEST-only access has not yet been authorized. It also does not access database records or admin routes.

## Baseline observation

On 30 October 2026 at 10:34 a.m. Eastern, the five public GET checks passed against the prior Build 156 production commit `f1a57c72c7125a7518f3d44eba76884b8f29e479`. This is a dated baseline, **not** proof that Build 157 has deployed. Re-run after Build 157 reaches Vercel READY with its new exact `main` SHA.

Use Node 24's `--use-env-proxy` when an approved HTTPS proxy is configured; otherwise the runner may report `NETWORK_FAILURE` even when the endpoint is reachable. The reporter intentionally avoids storing response bodies or network error details.
