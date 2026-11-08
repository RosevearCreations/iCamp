# iCamp Build 225 — Mobile My Stay overview, timeline & guest shortcuts

## Guest-facing improvement

- Both `/guest/hub` and `/guest/stay` lead with the same compact, responsive
  four-milestone reservation summary: reservation, arrival, on-site stay and
  departure. This complements the existing chronological source-event feed.
- The progress model uses the campground's **local calendar date** for
  scheduled arrival/departure and requires actual recorded check-in/checkout
  timestamps before describing those milestones as recorded.
- A reservation marked checked in or completed but missing its corresponding
  receipt is flagged for staff verification instead of silently treated as
  proof. Overdue scheduled milestones with no receipt also flag a review.
- A small, state-aware group of guest action shortcuts appears above the long
  lists: plan arrival, review change/cancellation, request assistance, open
  issued confirmation documents, or open the alternate My Stay view. Completed
  stays surface feedback instead of active arrival actions.
- Small-screen layouts collapse from a four-step grid to single-column cards
  with readable labels and keyboard-visible focus indicators.

## Security and release boundary

- The same existing signed-in guest session and guest-owned reservation reads
  supply both pages. The new pure progress model never fetches cross-tenant
  records or accepts a client-supplied status.
- Shortcuts are navigation only. They cannot themselves check in guests,
  provide gate access, issue refunds, send messages, or alter reservations.
- Unissued confirmations are not shown as available documents. Unknown
  milestones are explicitly labelled unknown or requiring office review.
- No database migration, provider activation, private receiver change or
  customer communication is part of Build 225.

## Verification

Run `node --test tests/build225-mobile-my-stay-progress.test.mjs` and the
project's complete `npm run verify` (format, lint, TypeScript, all tests and
production build). Protected `dev` and `main` checks and Vercel's deployed
commit must be verified before declaring production GREEN.
