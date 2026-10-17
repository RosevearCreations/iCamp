# Build 053 — Road Vehicle Registration

Status: **FULLY PROMOTED — `main` GREEN.**

## Purpose

Build 053 creates the formal campground road-vehicle registration authority for cars, trucks, SUVs, vans, motorcycles, tow vehicles and other road vehicles. It records plate/jurisdiction, vehicle description, owner/driver, host accommodation, validity and status without duplicating the Build 048 saved-vehicle profile or prematurely implementing Build 054 paid/pass behavior.

## Delivered

- campground-scoped road vehicle registration desk;
- cars, trucks, SUVs, vans, motorcycles, tow vehicles and other road vehicles;
- formal uppercase plate number and jurisdiction evidence;
- vehicle description, registered owner and primary driver;
- required host accommodation and optional active reservation linkage;
- optional Build 048 saved guest-vehicle linkage without copying plate data back into the reusable profile;
- stay-linked validity constrained to the active reservation date window;
- active/revoked stored lifecycle with effective expiry after the campground-local valid-until date;
- append-only registration lifecycle evidence;
- explicit revocation instead of destructive deletion or history rewriting;
- campground-scoped idempotency protection;
- per-plate PostgreSQL advisory locking plus overlapping-active-registration rejection;
- vehicle.read / vehicle.register authorization using the existing Build 005 permission catalogue;
- FORCE RLS and direct anon / authenticated denial;
- global audit events for registration and revocation;
- contextual help plus reservation-console navigation into the vehicle desk.

## Canonical boundaries

- **Build 048** remains the source for reusable guest vehicle descriptions. Build 053 may link them, but formal plate/jurisdiction data remains in the registration domain.
- **Build 049** remains the immutable check-in snapshot. Arrival vehicle counts/descriptions do not substitute for formal registration.
- **Build 054** owns non-stay day/week vehicle passes, extra-vehicle fees and parking/access rules.
- **Build 056/063** own access credential issuance, extension, revocation and checkout lifecycle.

## Registration safety

A stay-linked registration must point at the reservation's current host accommodation and remain inside the reservation date range. Saved-vehicle linkage must remain inside the same campground and guest profile. The service serializes registration attempts by campground/jurisdiction/plate before checking for overlapping active validity windows, preventing two concurrent operators from creating conflicting live registrations.

Identity and validity facts are immutable after creation. A bad or replaced registration is revoked and re-registered so its evidence remains traceable.

## Channel parity

- **Web/PWA:** full vehicle desk, saved-vehicle linking, formal plate/jurisdiction entry, host accommodation, validity review and revocation.
- **IVR/DTMF:** the existing verified vehicle.register canonical workflow supports concise guided registration. Ambiguous or protected visual review uses staff assistance.
- **SMS/MMS:** verified guided registration uses the same canonical workflow with secure-link/staff handoff where a protected visual step is required. Plate data is not echoed before verification.

## Database

Primary migration: database/migrations/0067_road_vehicle_registration.sql.

Verification: database/verify/0067_road_vehicle_registration.sql.

Primary tables:
- public.road_vehicle_registrations;
- public.road_vehicle_registration_events.

The hosted iCamp Supabase migration has been applied and the Build 053 verification passed.

## Hosted advisor review

Supabase Security Advisor reports zero findings after the Build 053 migration. Performance Advisor reports only INFO-level unused-index notices for the newly created Build 053 indexes; no Build-053 unindexed-foreign-key or warning-level regression was identified.

## Cost / provider / asset impact

Build 053 introduces no new paid service, Vercel project, Cloudflare resource, communications provider, external API, production secret or required image asset.

## Promotion

- feature PR #200 merged to `dev`;
- production PR #201 merged to `main`;
- exact feature head `f23b3119ca1c259318fdc893b58815cc9ceb2b6f` passed CI #38997214216, CodeQL #38997214246 and Secret Scan #38997214181;
- exact `dev` merge SHA `9d23a9a704b72dec4a5fddade6534218d89ad379` passed CI #38997343478, CodeQL #38997343472 and Secret Scan #38997343521;
- production PR checks passed CI #38997477837, CodeQL #38997477871 and Secret Scan #38997477860;
- production feature `main` SHA `72f2b62bee6a92c0bb161a19b2e54e8bd9f7fd57` passed CI #38997620167, CodeQL #38997620126 and Secret Scan #38997620122;
- `dev` was fast-forwarded to that production feature SHA and independently passed CI #38997767994, CodeQL #38997767996 and Secret Scan #38997768039;
- Verify, Browser E2E, full database migration/lifecycle/idempotence verification, production build and dependency audit are GREEN.

## Next build

**Build 054 — Day/Week Vehicle Passes & Extra-Vehicle Fees**
