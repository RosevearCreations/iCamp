# iCamp Build 223 — Guided Guest Booking Journey, Fit Clarity & Checkout Progress

## Outcome

- Add an accessible four-stage journey indicator to the published booking map, accommodation detail, authenticated checkout and pending/confirmed reservation views.
- Make previous steps navigable only when a safe source-backed route exists; later steps are labels, **not clickable shortcuts** around a hold, sign-in or final verification.
- Summarize campground-published campsite/cottage suitability facts near the accommodation heading. Missing/unknown facts are visibly **not published**, never silently treated as suitable; accessibility details are advertised, not independently certified.
- Add accessible in-page shortcuts to the five long checkout form sections. These do not auto-complete fields or imply the reservation is confirmed.

## Security and channel boundary

- The guest account check, temporary hold ownership, server-priced quote, capacity, compatibility, rules acknowledgment and final server revalidation are unchanged.
- No payment, booking, external SMS/voice, Comms Hub, gate, device, or provider activation is added.
- Web/PWA users have semantic navigation and native focusable links. For IVR/DTMF or SMS, staff-assisted or secure visual handoff remains the safe fallback for long policy/fit fields.

## Verification

- `node --test tests/build223-guided-booking-fit-and-checkout.test.mjs`
- `npm run verify` including existing permissions, booking checkout and privacy coverage.
- Protected GitHub `dev`/`main` checks; Vercel exact production deployment SHA, health, auth redirect and runtime-error smoke verification.

Release GREEN means the software is deployed and verified, **not** that a real guest booking or payment was created.
