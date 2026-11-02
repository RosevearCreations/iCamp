# Build 184 — Guest Feedback, Service Recovery & Moderated Reviews

## Customer experience

- `/guest/feedback` permits active guests to give **one rating for each actual completed reservation** at an active campground, with a 180-day campground-local submission/revision window following departure. Guests may save private feedback without requesting publication. Staff cannot create guest feedback or alter guest-authored ratings.
- Separate public title/summary and **private incident details** keep sensitive service facts out of public review cards. Guests can optionally link a pre-existing assistance case **only from the same reservation and guest**. The separate canonical assistance case and its state remain unchanged.
- Public visibility requires both the guest's affirmative `publicRequested` consent **and** a separate `approved` staff moderation decision. `/reviews` returns a narrow, anonymous public projection: rating, category, title, summary, campground and date. It never exposes guest identity, reservation IDs, case IDs, private notes, appeals or staff recovery evidence. Empty results make no unsupported rating claims.
- Guests may withdraw public consent **at any time**, including after the 180-day editing window; withdrawal immediately removes public eligibility and resets moderation. Rating/content revisions reset approval as well. Declined review authors can submit a private moderation appeal. A private event history preserves the guest's submission, revisions, withdrawals, staff decisions and appeals.
- The guest sees a private follow-up timeline, provisional target dates, fixed respectful in-app progress text and a separate link to their original assistance case. Follow-up statuses **do not promise remediation**, compensation or assistance-case closure. An office/staff-assisted fallback remains available.

## Internal operations and safeguards

- `/workspaces/management/campgrounds/feedback` requires the existing `guest.manage` permission and stays campground-scoped. Its queue displays actual guest-submitted reviews, consent state, pending appeals, linked case *status readback*, and a follow-up workload count. Staff can approve/decline only eligible guest-requested reviews or pending appeals; `declined` requires a meaningful reason.
- Staff can record `reviewing`, `action_planned`, `resolved`, or `not_actionable` feedback follow-up with a provisional local-date target of at most 60 days. Guest-visible messages come from fixed respectful templates; staff's optional operational note remains private. Every moderation and recovery milestone appends to immutable private event tables, and every write produces a scoped audit without storing incident text in audit snapshots.
- New tables live under `icamp_private`, with composite organization/campground reservation and case foreign keys, forced RLS, deny policies for `icamp_app`, no direct `anon`/`authenticated` privileges, ownership/stay/completion triggers, one-feedback-per-stay uniqueness, optimistic row versions and indexed review/FK lookup paths.
- No compensation authorization, invoice adjustment, refund, token, provider payment, email/SMS/voice send, external publishing API, automatic guest contact or change to the separate canonical camper-assistance workflow is created. **Billing / Omnichannel remain HELD / DISCONNECTED.** Reviews are published solely to this iCamp Web/PWA page after explicit consent and staff decision.

## Release gates

1. Apply `database/migrations/0195_build184_verified_guest_feedback_recovery.sql` and execute `database/verify/0195_build184_verified_guest_feedback_recovery.sql`; check Supabase security and performance advisors.
2. Pass `tests/build184-guest-feedback.test.mjs`, full `npm run verify`, and `npm run parity:verify`.
3. Push exact tested tree to `dev`, require GitHub CI/CodeQL/Secret Scan and matching READY Vercel Preview. No new branch.
4. Merge `dev→main` without force; verify Vercel Production READY and exact merged SHA, `/api/version`, `/api/health/ready`, `/status`, `/reviews`, guest/staff protected routes, zero recent runtime errors, and equal dev/main source trees.

## Next build

**Build 185 — Front Desk Unified Arrival/Departure & Exception Workboard (Billing / Omnichannel HELD).** Combine authoritative arrivals/departures, reservation/hold exceptions, pre-registration, visitor constraints, and maintenance/housekeeping blockers into a keyboard-friendly, permission-aware desk queue without automatic availability release, payment capture or messages.
