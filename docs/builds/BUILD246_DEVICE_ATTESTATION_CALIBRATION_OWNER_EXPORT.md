# iCamp 246 — original-device inspection, calibration follow-up, owner evidence export

Build 246 extends Build 245 source records while keeping `icamp` as a **single platform shell**, with campground-specific source data confined to the owning tenant.

## Capabilities

- Review the current worker mobile report after a distinct human witness and supervisor closure. Record a non-secret source reference, human-inspected SHA-256 digest and append-only inspection decision (`inspected_unverified` or `recheck_required`). The reviewer must be different from the worker, closure reviewer and human witness. Changes to the underlying report, closure or witness fail closed. **A typed digest or witnessed report is not cryptographic device attestation.**
- Compare immutable eight-hour forecast checkpoints to actual source review and handoff-request events after the window completes. The source database recomputes the observed count; it rejects fabricated browser totals and stale event chain links. Results are retrospective diagnostics, not new contractual SLAs.
- Allow supervisors to record `investigate`, `mitigation_recorded` or `recheck_required` with append-only source events. The UI displays a variance band, with truncated sources on HOLD.
- Expose a separate private `/api/management/fulfillment-supervisor/acceptance-evidence?campground=<uuid>` endpoint for **active campground Owner/Administrator only**. Returns source IDs, digest, non-PII statuses, measured variance, owner audit decisions, revision, evidence coverage and explicit HOLD states. No worker names, guest records, free text or signing keys.

## Test and promotion requirements

Run formatter/lint, typecheck, unit regression suite, production build, Chromium end-to-end, isolated PostgreSQL migration 0230 + verify + repeat-migration/idempotency, CodeQL, secrets. Promote feature PR → `dev` → distinct exact-file `main` PR. Confirm Vercel READY and the live `/api/version`, `/api/health/ready`, manifest and convergence exact SHA; owner-only export must return 401 without a session. Do not claim migration 0230 is installed on the live database merely because isolated CI passed.

## External acceptance boundaries

- Original-device signature authenticity: **HOLD**
- Independently managed Ed25519 source signer, public pin, source-signed HEALTHY receipt: **HOLD**
- Protected durable replay and AI Data Platform owner-connected admission: **HOLD**
- Real field acceptance and formal production owner acceptance: **HOLD**

No synthetic key, signer or receipt may be created as a substitute for original evidence. A GREEN software deployment does not change any of these external trust states.
