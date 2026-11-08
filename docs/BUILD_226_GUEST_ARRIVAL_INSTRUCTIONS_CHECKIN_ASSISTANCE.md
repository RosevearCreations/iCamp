# iCamp Build 226 — Guest arrival instructions, check-in readiness and on-site assistance

## Guest-facing behavior

- `/guest/hub` and `/guest/arrival-planner` provide a shared responsive arrival-essentials panel without requiring guests to read a lengthy operational timeline.
- The panel shows **only source-recorded** arrival date, configured campground-local check-in time, issued confirmation number and campground-supplied guidance. Missing instructions explicitly tell the guest to ask the office.
- Saved guest arrival details and front-desk review are checked against the **current reservation and plan row versions**; stale or unavailable evidence is never presented as approval.
- Pending reservations, overdue arrival without check-in, missing source check-in/checkout receipts, financial holds and staff follow-up are identified for office review.
- Reservation-scoped shortcuts lead to the existing secure arrival planner, campground map, published rules, issued documents and private assistance cases. Mobile links remain keyboard-accessible.
- New assistance requests require actual checked-in state in the existing assistance handler; the guide explains this boundary and does not portray the service as emergency dispatch.

## Security boundary

- Both pages use their existing authenticated **guest-only** and **guest-owned reservation** queries, not client-supplied source facts.
- The panel is strictly **read-only**. It does not record check-in, grant gate access, settle payments, send messages, disclose staff-only notes, or alter reservation state.
- A front-desk arrival-plan review is explicitly **not** permission for early entry, campground check-in, or credentials.
- No new schema, external provider, customer communications, device actions or private receiver is introduced.

## Verification and promotion

Run `node --test tests/build226-guest-arrival-guide.test.mjs` and `npm run verify` (format, lint, TypeScript, complete tests and production build). Use protected `dev` and `main` PRs with existing required GitHub checks; verify the exact production deployment SHA and live health before declaring GREEN.
