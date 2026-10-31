# Build 172 — Independent Owner Review Intake, Accessibility Evidence & Decision Ledger

## Delivered implementation

1. **Scoped independent review intake preflight.** `/settings/themes/acceptance` uses the signed-in staff ID and only the campgrounds for which that staff user actually has `reports.read`. The Build 171 11-screen, three-device and four-accessibility-check walkthrough is reused. A separate intended reviewer UUID, a 40-character release SHA and an evidence-ticket reference are required before a versioned manual intake packet can be prepared. The reviewer cannot equal the preparer, including case variants. Unresolved accessibility findings, planned follow-ups and device corrections without a passing retest block the packet. The packet preserves bounded, manually observed source-version, correction, outcome and next-step information, with time in UTC. It is marked `BROWSER_DRAFT_ONLY` and `pending_independent_review_not_submitted`, not a signed receipt.

2. **Accessibility evidence and recheck.** The manual keyboard/focus, 200% reflow, high-contrast/larger-text and reduced-motion/touch observations are included in the draft alongside corrections, priorities and follow-up notes. A new source SHA or corrective work must be rechecked on actual devices. This interface is not an automated WCAG conformance test or external owner acceptance service.

3. **Read-only historic decision readback.** Operators may inspect a bounded 16 KB / 20-entry chronological JSON history in browser memory. Exact campground/preparer scope, distinct reviewer IDs, source SHAs, timestamps, de-duplication, state enums and field bounds are validated. A row from another campground or preparer is rejected. History explicitly labels all `pending`, `rejected`, `recheck` and `approved` entries as **UNVERIFIED_IMPORTED_HISTORY**, including an "approved" *claim*. A changed source version is flagged for recheck. Import creates no verified decision, does not persist or alter any row and can be cleared.

4. **Protected read-only integration contract.** `GET /api/standard-theme/owner-review-contract` requires a current staff session with at least one `reports.read` permission and returns private no-store capability flags with `submissionEnabled=false` and `authoritativeDecisionLedgerEnabled=false`. There is no POST endpoint, migration or new privileged role. This satisfies the approved 171–200 queue's fallback requirement while no authorized independent owner decision service, append-only custody and RLS policy have been provisioned. **Actual durable review intake, independent decision and owner acceptance remain NOT IMPLEMENTED / HELD.** The new UI is explicitly a preparatory evidence handoff and readback, not a substitute.

## Data, rights, channels, and controls

- Source reads retain current authenticated staff/campground permissions and PostgreSQL RLS. Only existing authorization metadata is read; no guest-specific evidence, financial information or connection details are serialized into the intake packet by default. Manual note fields should not contain guest or confidential data. The preparer must handle manually copied/exported packets through an approved private process; browser clipboard cannot certify custody or identity.
- The readback parser is syntactic and tenant-scope validation **only**. It cannot validate the claimed reviewer's actual account status, signature, source receipt origin, device identity, chronological business history or review authority. All imported "approved" labels must be treated as historical, untrusted claims.
- Staff Web/PWA only, with keyboard/visible focus, phone/tablet reflow, controlled inputs, status announcements and high-contrast support. Actual physical-device, screen-reader and owner testing must be performed manually before acceptance.
- **Billing / Omnichannel remain HELD / DISCONNECTED**: no charges, outbound SMS/calls, gateway requests, dispatch, gate actions or formal owner approval are enabled.

## Verification / production requirements

1. Test preparer=self-reviewer rejection, invalid/missing release SHA and campground, incomplete manual check, device correction without retest, urgent accessibility follow-up, bounded and versioned packet, no submission.
2. Test imported decision ordering, duplicate/invalid IDs, unrecognized decisions, cross-campground and cross-preparer rejection, same-actor rejection, source-change recheck, browser-only history and never authoritative approval.
3. Verify denied guest/unauthorized access to the GET capability contract and no POST endpoint. Validate real desktop/phone/tablet, focus/zoom/contrast/reduced-motion manually, then run repository verify and exact-commit `dev`/`main` release gates.
4. Promote production only after Vercel acknowledges the exact `main` commit, the public routes and protected auth redirects work, and runtime errors have been inspected. The earlier Build 171 quota blocker must also be resolved or explicitly called out. **No code, CI or browser preview alone qualifies as Production GREEN.**

## Next

**Build 173 — Accessible Campsite/Cottage Discovery, Availability Filters & Side-by-Side Comparison (Billing / Omnichannel HELD).** This is planned only until Build 172's production release is verified GREEN.
