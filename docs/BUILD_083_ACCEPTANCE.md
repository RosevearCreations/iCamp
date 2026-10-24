# iCamp Build 083 — Warning, Suspension & Reinstatement Workflow

## Operator workflow

1. In **Campgrounds → Warnings, suspensions & reinstatement**, select an assigned campground and an account-linked confirmed/checked-in reservation.
2. Select either **Issue warning** (immediate immutable record) or **Request access suspension** (pending management review). Specify campground-wide, feature, named facility or named access zone scope, and an evidence-based guest-visible reason. Cite an existing published-rule version when relevant.
3. A **different** campground manager or owner reviews a pending request, enters a decision rationale and approves or denies. The same actor cannot issue and approve the same request, even if holding both roles.
4. An authorized manager can subsequently **reinstate** an active administrative suspension with an explanation. Terminal cases remain in the audit trail; a new event requires a new case.
5. Guests with the affected active account-linked reservation see only **approved active restrictions** and the original guest-facing reason in **My Stay**. Internal decision notes and staff audit data remain in the management workspace.

## Verification and controls

- Forced row-level security and explicit privileges on both tables. No direct `anon` or `authenticated` Data API table access.
- SQL trigger validates cross-property reservation, facility, access-zone and published-rule evidence, plus staff authority and independent management review.
- Immutable transition events are inserted by an internal private trigger; application callers cannot directly forge an event.
- Optimistic `row_version` check rejects stale simultaneous decisions. Case retry UUID avoids duplicate warning or suspension creation on form resubmission.
- Database verification: `database/verify/0113_warning_suspension_reinstatement.sql`.
- Unit/contract verification: `tests/safety-enforcement.test.mjs`.

## Boundaries

Administrative approval **does not** revoke gate credentials, change access schedules, cancel a booking, restrict payment, close a pool, issue a trespass order, dispatch emergency services or prove legal grounds for physical exclusion. Those remain separately authorized campground workflows. This is a record of staff decisions only, requiring an on-site communication and access-control process as appropriate.

The hosted iCamp database currently has no campground or reservation records, so an owner must first provision a test campground and genuine staff/guest role assignments before full real-data acceptance. Synthetic cases were not inserted into production.
