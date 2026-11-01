# iCamp Build 178 — Unified My Stay Mobile Hub & Status Timeline

## Release scope

- Authenticated, guest-only `/guest/hub` with mobile-first reservation summary, campground-local arrival/departure dates, at-a-glance status, and deep links to existing My Stay, arrival planning, assistance, booking review, receipts, map, profile and booking drafts.
- Only guest-owned reservations can be selected: the source list is `listMyStays(userId)` and detail/arrival/assistance/review/rules queries all carry the authenticated guest user ID and selected owned reservation ID. Unknown or cross-owner query parameters never drive a direct unrestricted lookup.
- Source-backed chronology for confirmation presence (without invented issue timestamp), booking rules acknowledgement, arrival-plan submission, current/stale staff review, change/cancellation review requests, guest-visible assistance updates, receipt issuance, recorded check-in/out, and separately tagged scheduled arrival/departure.
- Per-request fresh server render with `force-dynamic`, current reservation row version, UTC timestamp, native GET refresh, version-pinned arrival review freshness and explicit partial-source failure/empty states.
- Guest convenience summary of booked visitor count, recorded credential handoff and submitted assistance cases. **These are not verified visitor passes or physical gate authorization.** Published campground rule versions are labeled guidance, not a new live notices feed.
- Read-only aggregation reuses existing source tables and services; **no migration** and **no third-party call**. Fallback to authenticated office lookup when verification is unavailable; Preview without `DATABASE_URL` reports the unavailable state safely.

## Security and boundaries

- New page is guest-authenticated and noindexed; no raw records or guest identifiers appear in public response for unauthenticated production access. All links preserve reservation selection only where the destination accepts it.
- Failure of an arrival/assistance/review/guidance source does **not** become a false zero, approval, dismissal or completion. Guest-visible case events only, no staff-only notes.
- Scheduled dates are never represented as actual check-in/out. Staff arrival review is informational, not access approval. Pending reservation never silently becomes confirmed.
- Reservation review requests remain requests: no refunds, extra charges or booking mutation. **Billing / Omnichannel HELD**, including outbound SMS/voice/email, automation, live dispatch and gate/access action.
- Large-text, keyboard-focusable links and buttons, chronological semantic list, responsive single-column layout, readable source labels and reduced-motion behavior.

## Acceptance gates

1. Unit coverage: chronological provenance, withheld timestamps, scheduled/recorded distinction, stale arrival and decision versions, guest-visible case updates and partial assistance state.
2. Static security coverage: active guest session, owner-scoped selected reservation, user-ID-scoped source reads, no side-effecting transaction calls.
3. `npm run verify` and `npm run parity:verify` locally; GitHub CI/CodeQL/Secret Scan, Vercel preview and matching commit readback on `dev`.
4. Merge tested `dev` PR into `main`, verify production READY and `/api/version` SHA, health and authenticated route behavior, then check Vercel runtime logs. Only then mark GREEN.

## Next planned build

**Build 179 — In-App Assistance Conversation & Case Progress**: authenticated guest/staff follow-up comments, case progress and evidence under existing media/RLS rules; urgent labels without guaranteed response promises; outbound channels remain HELD.
