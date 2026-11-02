# Build 189 — Offline Field Work Queue, Conflict Resolution & Sync Audit

Status: implementation ready for CI, hosted migration and dev/main promotion. **GREEN must be established by actual checks and live readback**, not this document.

## Field scope

- Existing Build 076 assigned maintenance orders and in-progress inspections remain the only offline snapshot. Build 189 adds device-local priority/status/text filters and IndexedDB v2 autosaved note/checklist drafts; queued photos use the existing private, signature-validated media route with a 12 MiB image limit (PDF evidence retains its 25 MiB limit).
- Different online staff sign-ins cannot open an existing device-local cache without explicit clearing. Cached evidence is **not encrypted**; shared devices must be cleared after use. The unauthenticated offline fallback can still expose data to anyone with local device access, so the field device must be protected by OS authentication. No sensitive media is placed in the service-worker shell cache.
- Duplicate unsent answers for the same checklist item are not silently removed. They require explicit local discard. Connectivity loss leaves drafts and queued evidence local, never treated as work completed or an inspection signed off.
- Server uses assignment checks, current work-order/inspection/result versions, campground authorization, RLS and an advisory operation lock. Stale or reassigned edits return `409` and remain on device. A staff member can refresh and compare the cached/server versions and answers, then explicitly re-queue a new operation with a 20–500-character review reason; the server verifies a matching first-conflict record before accepting that replay and checks current versions again.
- Append-only `maintenance_offline_sync_conflicts` has per-actor/campground/operation uniqueness, forced RLS and no staff update/delete grants; receipt rows link to reviewed conflicts. The read-only `/api/maintenance/offline/audit` returns at most 50 applied receipts and 50 first conflicts, only for the current actor and campground. Retry receipts remain idempotent; original Build 076 fingerprints remain backward compatible.
- No status completion/cancellation, inspection sign-off/submission, actual messaging, billing, physical gates or external dispatch occurs from offline sync. **Billing, Omnichannel and physical integrations remain HELD.**

## Verification gates

1. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, browser E2E.
2. PostgreSQL 17: apply migration `0200_build189_offline_sync_conflicts.sql`, run every `database/verify` contract including `0200`, and `npm run build189:verify` rollback-only proof of cross-tenant RLS, immutable conflict evidence, deduplication and scoped reviewed replay.
3. Apply hosted migration to the iCamp Supabase project; execute verify SQL and check security/performance advisors for new regressions.
4. Feature PR into `dev` with CI/security scans and READY preview; dev→main PR with all gates; promote main, fast-forward dev to exact SHA, verify both branches plus Vercel production READY, `/api/version` SHA, `/api/health/ready` and runtime errors.

## Channel parity, safety and next queue

Staff Web/PWA (including cached shell) is supported; IVR/SMS are not needed for this offline field tool. Server-side staff flows remain authoritative for final decisions. Next queued Build 190: Shift Scheduling, Training/Qualification & Handoff Readiness.
