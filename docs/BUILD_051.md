# Build 051 — My Stay Guest Portal

Status: **IMPLEMENTED — promotion status is determined by exact GitHub and hosted-database gates.**

## Purpose

Build 051 gives an authenticated guest one stay-centric portal over iCamp's existing canonical reservation, accommodation, payment, document, check-in and checkout records. It adds only the campground-controlled presentation/configuration needed for guest rules, Wi-Fi guidance, assistance instructions and safe handoff links.

## Delivered

- authenticated guest route at `/guest/stay`;
- account navigation from `/auth/account` into My Stay;
- guest-owned reservation list with current/upcoming/pending/completed phase handling;
- reservation, party, campsite/cottage and stay-operation summary;
- published campground-map handoff using the existing Build 037 public booking map;
- current check-in/check-out times plus accepted booking/check-in rule acknowledgements;
- campground-published guest rules summary;
- campsite Wi-Fi service plus authenticated campground Wi-Fi network/access guidance;
- current payment obligation, captured amount, outstanding amount and balance date;
- Build 043 confirmation/invoice/receipt links and receipt summary;
- campground-configured store, equipment-rental, event, local-interest and assistance handoff links;
- campground-manager configuration surface at `/workspaces/management/campgrounds/guest-experience`;
- safe URL normalization that permits only internal iCamp paths or HTTP(S);
- forced RLS for guest-facing settings with direct `anon`/`authenticated` table access denied;
- guest settings read limited to a guest account with a canonical confirmed or checked-in reservation at the campground;
- audited `campground.configuration` management updates.

## Domain boundaries

Build 051 is an aggregation/presentation layer, not a second source of truth.

- **Builds 078–079** remain canonical camper-assistance request/triage authority.
- **Build 082** remains canonical versioned campground/facility-rule authority.
- **Builds 097–106** remain canonical events, local-interest and destination-promotion authority.
- **Builds 112–116** remain canonical equipment-rental authority.
- **Build 121** remains canonical online campground-store authority.
- **Build 063** remains canonical access-credential lifecycle authority.

Until those domains arrive, a campground may publish a safe internal or HTTP(S) handoff link. A handoff link never counts as a canonical order, rental, registration, assistance request, event registration or rule record.

## Privacy and Wi-Fi safety

Wi-Fi access guidance is exposed through the authenticated My Stay path only to guests with a confirmed or checked-in reservation at that campground. Direct API-role table access remains denied. Management is explicitly warned not to store router administration credentials, alarm codes, infrastructure secrets, raw payment-card data or other non-guest secrets in the guest guidance fields.

## Channel parity

- **Web/PWA:** full My Stay experience.
- **IVR/DTMF:** verified guests may hear concise stay dates, accommodation code, balance and office guidance from the same canonical records; map/content review uses secure web or staff-assisted fallback.
- **SMS/MMS:** verified guests may receive concise stay status and secure-link handoff; Wi-Fi details, financial information and private documents are not echoed before verification.

## Database

Migration: `database/migrations/0064_my_stay_guest_portal.sql`.

Verification: `database/verify/0064_my_stay_guest_portal.sql`.

New table:
- `public.campground_my_stay_settings`.

All reservation, accommodation, payment, receipt, check-in/check-out and map information continues to come from the existing canonical tables.

## Cost / provider impact

No new paid service, Vercel project, Cloudflare resource, communications provider or external API is introduced by Build 051.

## Images / production variables

Build 051 adds no new mandatory image asset. It reuses the published campground map and existing accommodation information. It adds no new required production secret/environment variable.

## Next build

**Build 052 — Stay Extension & Accommodation Move**
