# Build 169 — Scenario Comparison Export Integrity & Recovery History, Escalation Source Recheck Delta Prioritization & Standard Theme Owner Accessibility Acceptance Follow-Up

## Delivered

1. **Export integrity and recovery history:** The authorized forecast screen now calculates SHA-256 over the exact text bytes for each explicitly downloaded comparison CSV or scoped saved-preference JSON. A sibling `.sha256` file enables an independent comparison of the downloaded bytes. A restored JSON backup previews its hash; an optional trusted expected hash must match before the confirm button enables. Checksums are **not digital signatures or provenance guarantees**. A bounded browser-local history (up to 12 entries per user/campground) stores only export/recovery action, timestamp, saved-view count and SHA-256—not CSV rows, saved preferences or reservation data. Operators can clear this history; it is not a durable audit record.

2. **Escalation recheck delta priorities:** The authorized, read-only escalation board now compares session-only operator receipts to the latest source readback and sorts those needing follow-up. A disappearance from the active source is highest-priority triage, not closure proof. Changed evidence status is shown next, prioritizing regressions over improvement; newer unchanged snapshots are offered for explicit recapture and same-snapshot observations require refresh. Manual triage links and copyable handoffs retain source timestamps and all evidence caveats. No case mutation or external message is triggered.

3. **Owner accessibility acceptance follow-up:** The Standard Theme owner view adds a per-check priority, manual follow-up disposition and bounded next-action notes for keyboard/focus, 200% zoom/reflow, contrast/larger text and reduced-motion/touch reviews. A ranked local handoff queue and explicit copy action summarize outstanding owner review. The browser-only v2 draft format remains backward-readable from v1 and v2; optional v2 follow-up fields preserve old drafts. Owner-reported retests do not signify formal acceptance, independently tested accessibility compliance or permission to activate integrations.

## Authorization and safety

- Forecast source remains one campground-authorized read behind `requireStaff` and the existing `reports.read`, `reservation.read`, `accommodation.read` checks. Source estimates are historical-rate sensitivity only, not forecasts of demand. Export bytes are calculated only when users request a download; nothing is sent to an external collector.
- Browser history is scoped to the signed-in user and campground, can be deleted, and is vulnerable to local alteration or storage loss. An optional pasted digest is only useful when acquired from a trusted, independent channel.
- Escalation evidence is current source data plus voluntary local observations, not signatures, notification delivery, acknowledgment receipts or closure confirmation. Source disappearance requires manual triage.
- Owner accessibility notes are self-reported; physical-device inspection and any independent sign-off are separate.
- **Billing and Omnichannel remain HELD / DISCONNECTED.** No live charges, SMS, calls or gateway actions were enabled.

## Manual acceptance and promotion gates

1. From an authorized campground forecast screen, save a view; export comparison CSV and scoped JSON backup and verify corresponding `.sha256` files against the exact local bytes. Restore a JSON backup with a matching independently checked digest, then test mismatch refusal and wrong-scope rejection. Clear local history while retaining saved views.
2. On the escalation board, capture a gap, refresh, and compare changed/unchanged source evidence. Verify prioritized source deltas and triage links. Ensure a missing active record never appears as closed or independently verified.
3. On the Standard Theme owner page, record device/accessibility issues, next actions, priorities and follow-up states. Copy the manual handoff; save/reload a browser draft and confirm older drafts still load. Perform real keyboard, zoom, contrast, motion and device inspections; do not treat the local status as formal acceptance.
4. Run formatting, lint, typecheck, unit/browser gates and production build; require passing feature/dev/main CI and READY Vercel deployments. Verify the exact `main` commit, production alias, public and protected route responses and runtime errors before declaring production GREEN.

## Next queued

**Build 170 — Scenario Export Checksum Verification & Recovery Activity Review, Escalation Delta Evidence Handoff & Standard Theme Owner Acceptance Closure Readiness (Billing / Omnichannel HELD).**
