# Build 179 — In-App Assistance Conversation & Case Progress

## Product change

- Guests can read current case status, staff assignment presence, urgency, management escalation and guest-visible updates, with an ordered, source-backed timeline, from `/guest/assistance` for their own reservation (including after checkout).
- Authenticated guests can reply to their own **open** assistance cases. Each reply carries a validated idempotency UUID, is appended immutably with the actual actor and timestamp, and is written to the audit log. A repeated form submission does not duplicate it. Closed cases reject replies.
- Authorized staff can read guest replies in the existing assistance workboard, see internal operational events separately, and post an explicit **in-app only** guest reply. Existing triage, assignment, escalation and closure controls remain staff-permission-scoped and audited. Urgent escalation labels do not promise a response deadline.
- Guest-uploaded image/PDF evidence continues through Build 077's MIME/signature checks, private media bucket, checksum and five-per-request cap. Uploading after closure is blocked at the transaction boundary, not merely by a disabled form. Guests can open only media linked to their own request through a short-lived signed URL; staff need `media.read` permission.
- Missing storage credentials produce an unavailable response, not public file access. No new attachment provider or broad media grant has been introduced.

## Database boundaries

- Additive migration `0189_build179_assistance_in_app_guest_reply.sql` expands the existing `camper_assistance_case_events` enum-like check with `guest_reply`, preserves the append-only trigger, adds a guarded guest INSERT policy and ownership/state trigger, and a unique per-case idempotency index.
- Public case-event RLS remains **enabled and forced**, without direct `anon`/`authenticated` grants. A guest INSERT must belong to their case, with matching organization/campground, an open state and in-app-only metadata. Existing staff INSERT policy remains unchanged.
- Guest status-timeline readback uses both explicitly guest-visible messages and redacted state-transition labels from the same owner's case. Internal triage/escalation notes, actor identities and metadata are never projected to guest output. No new cases are created without a checked-in stay; existing cases can be followed after checkout.
- Outbound SMS, email, voice, external dispatch, payment changes and gate actions remain **HELD / DISCONNECTED**.

## Acceptance gates

1. Core tests prove input normalization, conversation ordering/visibility labels, urgency/assignment/closed states, role scoping, and fail-closed evidence access.
2. Database verification asserts forced RLS, allowed guest reply policy, ownership trigger, idempotency index and no direct untrusted-client INSERT permissions.
3. `npm run verify` and `npm run parity:verify`; Supabase migration application/readback and advisors; GitHub CI, CodeQL and Secret Scan; Vercel preview exact SHA.
4. After PR merge, verify `main` production deployment READY, exact SHA from `/api/version`, system health, guest login gate and absence of production errors before declaring GREEN.

## Next build

**Build 180 — Accessible Map/List Wayfinding, Amenities & Directions.** Add accessible campground-supplied amenity and site navigation with a matched nonvisual list and clearly marked unavailable routes/times, without inventing directions or physical safety access.
