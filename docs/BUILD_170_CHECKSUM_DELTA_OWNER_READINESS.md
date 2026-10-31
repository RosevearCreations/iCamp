# Build 170 — Scenario Export Checksum Verification & Recovery Activity Review, Escalation Delta Evidence Handoff & Standard Theme Owner Acceptance Closure Readiness

## Delivered

1. **Scenario export checksum verification and local history review:** Staff with existing campground authorization may select a local CSV/JSON export (2 MB maximum) and provide a SHA-256 digest or conventional `.sha256` companion line. Verification hashes the original bytes with browser Web Crypto, validates a companion filename and displays match/mismatch explicitly. Nothing is uploaded. The bounded per-user/per-campground browser-only history now records metadata-only verification outcomes alongside exports and recoveries. Operators can filter the visible 12-entry history and copy an opt-in metadata handoff without exporting booking rows, filenames or backup contents. A checksum match means byte equality **only**, not who created or signed the file; mutable browser history is not a server audit record.

2. **Escalation source-pinned delta handoff:** The existing authorized read-only escalation board can explicitly copy a focused source-delta handoff (changed or missing-from-active records) or all local rechecks. Each entry shows the current authorized snapshot UTC, earlier operator-observed source time/status, current evidence status, priority, owner and a scoped triage link. Missing active records never become fabricated closure, acknowledgment, independent receipt or delivery evidence. Copying sends nothing, and no case write is performed.

3. **Standard Theme owner acceptance closure readiness:** The browser-local Standard Theme owner walkthrough now computes blockers for all 11 review screens, 3 devices and 4 manual accessibility interactions. Device corrections need a passing retest; unresolved or urgent accessibility follow-ups remain open. The checklist shows eligibility **to request separate independent owner review**, not automatic acceptance. Owners can expand remaining blockers and copy a manual readiness handoff. Explicit version 2 browser-draft saving now also retains the checked-screen keys; previous v1/v2 drafts still load, with old drafts lacking screen checks defaulting to not reviewed. Physical-device testing and any independent owner/WCAG sign-off are external manual decisions.

## Safety and verification boundaries

- Forecast page retains `requireStaff`, `reports.read`, `reservation.read` and `accommodation.read` checks; current comparisons remain source-linked historical-rate sensitivity, not forecasts of future demand. A verified downloaded file is **not** automatically trusted for recovery: the existing scoped JSON recovery, preview and explicit restore confirmation stay in place.
- The checksum tool only reads chosen local files in the browser and hashes bytes without sending contents to any service. Only timestamps, action type, saved-view count and actual SHA-256 can be retained locally. History remains bounded, mutable and deletable.
- Escalation handoffs remain session-only operator observations from current original source readback; no third-party delivery or closure is claimed.
- Owner closure readiness is a checklist of local self-reported observations. It does not record approval, implement inaccessible workarounds, or change production authorizations.
- **Billing / Omnichannel remain HELD / DISCONNECTED**, with no charges, external messages, gateway GETs or case changes added.

## Manual acceptance and promotion

1. Export JSON and CSV with companion SHA-256 files, verify exact bytes, test wrong checksum and mismatched filename, then filter/copy the local history and clear it. Check private scope recovery and no reservation details in browser history.
2. Capture escalation source rechecks, refresh, compare same/changed/missing-active observations, copy focused and full source-pinned handoffs. Review triage paths; do not infer acknowledgment/closure.
3. Manually inspect all 11 Standard Theme screens, 3 devices and 4 accessibility interactions; test corrections, urgent retest follow-up and expandable readiness blockers. Confirm a complete local walkthrough invites a separate owner sign-off request only.
4. Gate feature PR CI and READY preview before merge to `dev`, gate promotion PR checks and READY `dev` preview before `main`, then check exact-SHA production deployment, alias, public/protected smoke and runtime errors before marking GREEN.

## Next queued

**Build 171 — Scenario Recovery Checksum Exception Review, Escalation Handoff Snapshot Continuity & Standard Theme Independent Owner Acceptance Request Summary (Billing / Omnichannel HELD).**
