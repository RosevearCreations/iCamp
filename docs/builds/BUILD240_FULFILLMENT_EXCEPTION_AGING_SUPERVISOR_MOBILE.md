# iCamp 240 — Fulfillment Exception Aging, Supervisor Priority Views & Accessible Mobile Recovery Guidance

## Delivery

- Campground supervisor-only priority view at `/workspaces/management/campgrounds/fulfillment-priority`. Both `reservation.modify` and `staff.manage` must be granted **in the selected campground**. Unauthorized campground IDs fail closed.
- Reads existing Build 238 dispatches, immutable worker acknowledgements, and Build 239 supervisor reviews through the same RLS-scoped source queries. No new tables, approvals, external messages, guest changes, or automatic escalation.
- Open, overdue/recheck, worker-support, reviewed/resolved, historic, and all-visible filters. The page uses server-side request validation and capped, predictable 20-case pagination.
- Explicit aging starts at a recorded worker support receipt or missed acknowledgement/completion deadline. The earliest timestamp wins when multiple signals exist. Resolved reviews freeze elapsed time at their recorded decision. A contradictory live overdue signal remains **RECHECK** even if the last review says resolved.
- Priority bands are **display-only**: under 1 hour, 1–4 hours, 4–24 hours, and 24+ hours. They do not assert a contractual SLA threshold, escalation route, worker availability, or incident acceptance.
- Superseded dispatches remain historical. Their supersession timestamp is absent from the current source records; historical age remains unknown rather than made up.
- The worker's private mobile inbox now shows specific, accessible instructions for overdue response, late evidence, support requests, missed completion targets, superseded records, and unavailable evidence. None of these hints sends a message or changes a reservation.
- The main fulfillment page links authorized supervisors to the priority view; each priority case links back to its source job and existing audited supervisor follow-up form.

## Evidence boundaries and acceptance

1. Tests cover classification, priority order, measured/frozen aging, contradictory closure, historical uncertainty, query bounds, and worker recovery messages.
2. Review that a user with `reservation.modify` **without** `staff.manage` can see their own worker inbox but cannot load a supervisor review. Verify cross-campground IDs redirect unauthorized.
3. Verify 320px mobile viewport, touch targets, logical heading order, keyboard filter navigation and live source refresh; the page is a server-rendered request snapshot, not a background monitor.
4. Check a real pending acknowledgement, an overdue acknowledgement, a support request, an accepted-late record, a completed-late record, an explicitly resolved review and a superseded dispatch.
5. Both source queries cap visible evidence at 750 records and dispatches to the latest three per job. The UI declares truncated data when reported. Even without truncation the counts are **visible-source counts**, not complete historical population totals.
6. Do not mark the connected production database or the worker's actual mobile acceptance GREEN until an authorized operator has independently verified migration 0223/0224 installation and those live cases. Code/CI GREEN is separate from real operational evidence.

## Master Shell and Comms boundaries

iCamp remains the authoritative campground product shell, with each tenant isolated. AI Data Platform monitors source health and readiness; Rosevear Comms Hub coordinates explicitly authorized communications. Neither system receives worker private notes, campground work mutations, or a fabricated CONNECTED status from this screen.

## Next proposed build

**iCamp 241 — Fulfillment Supervisor Saved Views, Case Ownership & Mobile Field Acceptance Evidence.** Add explicit per-campground view preferences and independently witnessed worker-device acceptance evidence, retaining fail-closed source identity and permissions.
