# iCamp Build 222 — Camper Task Navigation & Safe Booking Search Recovery

## Product outcome

Resume campground-product improvements after the Comms Hub integration chapter:

- Put **Find a campsite or cottage**, **My stay**, and the staff sign-in path at the front of the home screen.
- Make the global quick links camper-first, and put advanced administration/system links in an optional, keyboard-operable disclosure. Existing server-side authorization remains authoritative; navigation visibility is not an access grant.
- Validate public booking date and filter query parameters **before requesting an accommodation availability snapshot**. Reject nonexistent calendar dates, reverse/zero-night stays, invalid categorical filters, and malformed/out-of-range numbers with an accessible recovery form.
- Fail closed: on invalid input, do not show guessed availability, create a hold or reservation, or expose internal exception details. A new date search resets invalid advanced filters.

## Verification

- `node --test tests/build222-camper-navigation-and-search.test.mjs`
- `npm run verify` (format, ESLint, TypeScript, tests, production build)
- Protected `dev` and `main` GitHub PR gates, plus matching Vercel production deployment and live version/health smoke checks.

## Authentication and channel boundaries

- Staff workspace permissions remain checked by `requireAnyCampgroundPermission`; My Stay still calls `requireSignedIn`.
- Web/PWA provides the search and recovery form. Telephone/SMS have no newly enabled outbound messaging; callers may continue to use staff-assisted enquiry for unavailable or ambiguous inventory. Private Comms and device actions are untouched.
- No database migration, credential, billing, message, private receiver, or gate control change.

## Release acceptance

Release is GREEN only after exact-commit protected checks and the production deployment are verified. This document does not attest that any live campground has published inventory or that a private Comms TEST was performed.
