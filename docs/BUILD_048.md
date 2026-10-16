# Build 048 — Guest Profiles & Saved Stay Information

Status: **FULLY PROMOTED — `main` GREEN.**

## Purpose

Build 048 introduces one canonical campground-scoped guest profile that may exist with or without an iCamp login. It keeps reusable stay details separate from immutable reservation/payment/document evidence and establishes the guest identity surface required by Front Desk Check-In in Build 049.

## Delivered

- optional guest-account linkage without making authentication a prerequisite for staff-created guest profiles;
- contact details, preferred contact channel and guest-controlled saved-stay/privacy settings;
- reusable RV profiles with size, electrical-service and slide-out facts;
- reusable vehicle descriptions without plate/jurisdiction data, preserving Build 053 as the formal road-vehicle registration authority;
- reusable pet profiles without medical records;
- append-only guest profile/privacy/saved-item evidence;
- optimistic row-version updates and campground-scoped RLS;
- `guest.read` / `guest.manage` authorization using the existing Build 005 permission model;
- direct `anon` / `authenticated` table access denied; application access remains through `icamp_app`;
- optional linkage from existing reservations and Build 047 seasonal/yearly assignments to the canonical guest profile;
- stay history read from canonical reservations rather than copied;
- receipt history read from immutable Build 043 receipt evidence rather than copied;
- Build 014 remains the source of truth for SMS/marketing consent and STOP/START/HELP;
- guest self-service Web/PWA page at `/guest/profile`;
- Front Desk/management guest desk at `/workspaces/management/campgrounds/guests`.

## Channel parity

- **Web/PWA:** full profile, privacy, reusable stay detail and history experience.
- **IVR/DTMF:** verified guest/staff concise lookup and guided updates; complex edits use verified staff assistance or secure web handoff.
- **SMS/MMS:** verified concise status and secure-link handoff; sensitive profile data is not echoed before verification.
- Raw payment-card details, passwords, medical records and formal road-vehicle registration data are excluded.

## Database

Primary migration: `database/migrations/0059_guest_profiles_saved_stay.sql`.

Advisor hardening: `database/migrations/0060_build048_advisor_hardening.sql`.

Verification: `database/verify/0059_guest_profiles_saved_stay.sql` and `database/verify/0060_build048_advisor_hardening.sql`.

Primary tables:
- `public.guest_profiles`;
- `public.guest_rv_profiles`;
- `public.guest_vehicle_profiles`;
- `public.guest_pet_profiles`;
- `public.guest_profile_events`.

Build 048 also adds optional `guest_profile_id` references to `public.reservations` and `public.seasonal_assignments`.

## Safety and privacy boundaries

The profile is a convenience record, not a replacement for authentication, communications consent, reservation snapshots, payment records, receipts, or vehicle-registration evidence. Guests may disable reusable stay-detail retention and ordinary future-stay staff lookup. Authorization is still checked server-side regardless of those preferences.

## Cost / provider impact

No new paid service, Vercel project, Cloudflare resource, communications provider or external API is required for Build 048.

## Final promotion evidence

- Feature PR #187 — GREEN.
- Advisor-hardening PR #188 — GREEN.
- Production PR #189 — GREEN.
- Hosted migrations `20261015174554 / guest_profiles_saved_stay` and `20261015222110 / build048_advisor_hardening`.
- Supabase Security Advisor: zero findings.
- Final production SHA: `1c9f6aefe746807c9edc00ff39ed81d451d3f0ec`.
- Exact production CI, CodeQL and Secret Scan: GREEN.
- `dev` and `main`: identical.


## Hosted advisor hardening

After the initial hosted Build 048 migration, Supabase Security Advisor reported zero findings. Performance Advisor identified duplicate permissive SELECT work from the saved-item `FOR ALL` policies and uncovered FK paths that lacked leading covering indexes. Migration 0060 replaces those broad policies with precise INSERT/UPDATE policies, adds immutable saved-item identity guards, and covers the Build 048 foreign-key paths before production promotion.
