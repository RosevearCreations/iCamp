# Build 171 — Scenario Recovery Checksum Exception Review, Escalation Handoff Snapshot Continuity & Standard Theme Independent Owner Acceptance Request Summary

## Delivered functionality

1. **Recovery integrity exception preflight:** The authorized historical-scenario page keeps recovery scoped to the current signed-in user/campground and requires a preview before replacing saved preferences. A supplied independently trusted SHA-256 digest must match before the restore control enables; malformed or mismatched digests cannot be bypassed with the unverified checkbox. A backup without a trusted digest now requires an explicit, separate acknowledgement of *unverified* local recovery. Selecting another backup clears prior digest/exception state. Staff may copy a metadata-only integrity exception for manual review; the bounded, browser-only history records an exception action with the calculated digest, never backup contents, names or booking figures. Matching bytes do not establish source authenticity.

2. **Session-scoped escalation snapshot continuity:** The campground-authorized read-only escalation board now retains up to 16 source observation receipts in the browser tab's `sessionStorage`, keyed to both signed-in user and campground and expiring after four hours. It validates identifiers/statuses/timestamps and discards tampered, stale, duplicate or wrong-scope state. Reopening or refreshing the authorized page within the same tab can compare earlier operator-observed source timestamps/statuses to the current original source readback. The worklist continues to prioritize missing active records or changed source statuses for human triage, without inventing closures. Clearing observations removes the tab's scoped snapshot. No case writes, signatures, delivery receipts or outbound messages occur.

3. **Standard Theme independent owner review request draft:** The existing 11-screen, three-device and four-accessibility-interaction worksheet now provides a specific manual independent-review request draft. Copying the draft is disabled until all local walkthrough checks pass, including corrections and urgent retests. The request names each manual observation, preparation time, remaining blockers and the required separate independent decision. A read-only preview remains available before completion, explicitly marked **BLOCKED / DRAFT / NOT APPROVAL**. No authentic owner consent, WCAG certification or server-side reviewer approval is created.

## Safety / channel / privacy boundaries

- All existing route gates remain: forecast requires assigned staff plus `reports.read`, `reservation.read` and `accommodation.read`; escalation requires campground-scoped `reports.read` and relevant assistance-case permissions; owner worksheet requires `reports.read` in an authorized campground. Original data reads use existing server-side permissions and PostgreSQL RLS. This build creates no tables or new privileged actions.
- Browser preference history and current-tab snapshots are local operator metadata, not immutable audit evidence. Guest case details, reservation numbers, export contents and personal owner information are not written to those snapshots. Shared-device users should clear them and end the tab session after use.
- Web/PWA staff-only review; no fake IVR/DTMF or SMS parity for visual checks. Copying creates a local manual handoff only. **Billing / Omnichannel remain HELD / DISCONNECTED**; no external calls, SMS, gateway GETs, charges, live dispatch or gate actions.

## Acceptance tests / release gates

1. On `/workspaces/management/command/forecast`, import a valid same-scope JSON preference backup. Try wrong checksum, malformed checksum and blank checksum. Both wrong/malformed must block restore; blank requires explicit acknowledgement; a matching trusted digest enables restore. Changing files must reset acknowledgement and digest. Verify exception activity contains only permitted metadata.
2. On `/workspaces/management/command/escalations`, record source readbacks, refresh in the same tab, and confirm earlier timestamps survive and changed/missing records are prioritized against the fresh authorized source. Check scoped isolation by user/campground, expiry, clearing, invalid-state rejection and no case or outbound changes.
3. On `/settings/themes/acceptance`, leave a screen unchecked, a device correction without a passing retest and an urgent accessibility follow-up: the independent request must remain blocked. Complete all real device/manual checks, then copy the draft. Verify that it is not a sign-off or notification.
4. Run formatting, lint, TypeScript, test suite, Next.js build, required PR CI, READY `dev` preview, production promotion PR checks, exact-SHA `main` deployment and public/protected smoke tests. Report production GREEN only after all applicable gates confirm it.

## Queue

The approved extension covers Builds **171–200** in `BUILD_QUEUE.md` and `BUILD_171_200_FUTURE_QUEUE.md`.

**Next: Build 172 — Independent Owner Review Intake, Accessibility Evidence & Decision Ledger (Billing / Omnichannel HELD).**
