# iCamp 241 — Supervisor Saved Views, Case Ownership & Mobile Field Acceptance Evidence

## Delivered product scope

1. The campground supervisor exception screen has personal, campground-bound saved priority-filter shortcuts. Names are validated and limited to eight per supervisor/campground. Saving/removing a shortcut is audited; no automatic assignment or messaging occurs.
2. Authorized campground supervisors can explicitly claim or release an exception case. Each ownership change appends an immutable source event containing an actor, reason, prior event ID, and timestamp. DB checks reject lost-update, stale predecessor, cross-campground requests and releasing another supervisor's claim. Claiming a case **does not** assign the underlying job or close the SLA exception.
3. Assigned workers can send a small self-reported field-device observation from their private mobile inbox. Phone/tablet/desktop, usable/blocked, 5–300 character note and source dispatch are recorded immutably. Database triggers require the user's currently active, version-matching assignment. No guest data or private device identifier is requested.
4. Supervisors see the newest worker observation in the priority case alongside source-linked ownership and SLA review. The label stays **independent acceptance HOLD**, even when a worker says the screen was usable.
5. New migration/verify: `database/migrations/0225_build241_fulfillment_saved_views_ownership_mobile.sql` and matching verify script. The three tables enforce RLS, separate worker/supervisor policies, scoped foreign keys and append-only histories. Production migration installation requires separately verified database access. The UI displays a specific HOLD notice if the new source tables are not yet available.

## Acceptance

- Test two different campground scopes, a worker with `reservation.modify` but no `staff.manage`, a supervisor with both permissions, and a staff user whose assignment changed.
- Verify that two simultaneous supervisor claims referencing the same previous event cannot both win. The loser must refresh.
- Verify a worker's mobile report is rejected when the dispatch is superseded, wrong-worker, wrong-campground or no longer in an active scheduled/in-progress job state.
- Verify 320px mobile layout, keyboard-accessible expand/collapse, minimum touch targets, usable/blocked report errors and supervisor priority links.
- Confirm missing database migration returns HOLD rather than fabricating saved views, owners or accepted evidence.
- Real-world independent device acceptance is a **separate reviewer act** outside worker self-report and cannot be inferred from CI GREEN.

## Master Shell convergence

See [`MASTER363_ICAMP_SOURCE_CONVERGENCE_HANDOFF.md`](../master-shell/MASTER363_ICAMP_SOURCE_CONVERGENCE_HANDOFF.md). The Vercel deployment-time public manifest revision is source-matched to the exact Git commit; **signer enrollment and a valid signed health receipt remain HOLD until an independently authenticated owner/custodian completes the private-key and public-pin ceremony**. iCamp remains a platform-shell source with no tenant-level Master Shell operations.

## Next proposed build

**iCamp 242 — Supervisor Case Ownership Follow-Up Continuity, Field Device Review Decisions & Source Evidence Export.** Build source-bound supervisor reconciliation and independently reviewed field-case exports after real database adoption, without granting automatic owner acceptance.
