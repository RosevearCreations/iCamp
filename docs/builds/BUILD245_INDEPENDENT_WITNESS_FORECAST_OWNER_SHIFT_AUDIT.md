# iCamp Build 245 — Independent Field Witness, Forecast Accuracy & Owner Shift Audit

Status: Source implementation candidate. **A successful code deployment does not prove live database adoption, original device acceptance, a Master connection, or owner signoff.**

## Scope

- Add campground-private append-only human witness events linked to the **latest** source closure, worker mobile report and supervisor device review. The actor must have current supervisor permissions and be different from the reporting worker and reviewing/closing supervisor. A witness is `observed_unverified` or `recheck_required`; no UI or API upgrades this to cryptographically verified device acceptance.
- Persist a current server-derived eight-hour supervisor workload forecast checkpoint (not client-supplied numbers). Review historical accuracy *only after its window closes* against later recorded escalation and handoff-request events. An escalation that is also a device blocker is counted once; partial and truncated sources remain `PARTIAL_HOLD`.
- Add a distinct active campground Owner/Administrator audit decision for a latest human witness or completed forecast checkpoint. Decisions are append-only; they do not release jobs, charge payments, notify guests, approve staffing, switch a Master connection to CONNECTED, or grant authority to Comms.
- Keep campground tenant isolation enforced by PostgreSQL RLS and source cross references. Owner exports contain aggregates and checkpoint deviations without worker names, private notes or guest personal information.
- Preserve `source_id=icamp`, `source_role=platform_shell` and the dynamically bound deployed source revision in the public manifest.

## Verification

`npm run verify`; isolated migration application plus `database/verify/0229_build245_field_witness_forecast_owner_audit.sql`; database rerun/idempotency, browser tests, CodeQL and secret scan. After merging to production, check Vercel READY, `/api/version`, `/api/health/ready`, the deployed public manifest, shell convergence and protected owner endpoint denial without credentials.

## Explicit HOLD gates

Independent original-device cryptographic attestation, Ed25519 source signer custody/enrollment, fresh signed HEALTHY source receipt, durable replay, Master CONNECTED transition, live original-field acceptance and explicit owner production acceptance are **not** created by this build. Retain them on HOLD until independent evidence and owner authority exist.
