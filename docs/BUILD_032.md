# Build 032 — Booking Calendar & Date Rules

## Status

**IMPLEMENTED — promotion in progress.**

## Canonical roadmap scope

Build 032 owns:

- campground-local check-in and check-out times;
- minimum and maximum booking lead windows;
- campground minimum and maximum stay lengths;
- configurable weekend-day classification;
- named holiday and season calendars.

## Delivered design

### Campground booking policy

public.campground_booking_rules stores one optional persisted rule set per campground. Until a campground saves an explicit rule set, the application presents conservative defaults:

- check-in: 15:00;
- check-out: 11:00;
- booking lead window: 0–365 days;
- stay length: 1–30 nights;
- weekend nights: Saturday and Sunday.

The row uses optimistic row_version concurrency and records the most recent actor. Configuration writes require campground.configuration.

### Holiday and season calendar

public.booking_calendar_periods stores named date ranges that later builds can consume consistently.

Each row records:

- holiday or season kind;
- stable lowercase code and display name;
- inclusive start/end dates;
- optional minimum/maximum stay overrides;
- operations notes;
- actor, timestamps and row version.

Calendar rows are append-preserved. Existing period identity, dates and rule content cannot be silently rewritten. A manager archives a mistaken/outdated period and creates a replacement. Active season rows cannot overlap another active season; PostgreSQL serializes same-campground season creation with a transaction advisory lock. Holidays may overlap seasons.

### Date-rule evaluator

lib/booking-rules/core.mjs provides a provider-independent evaluator that calculates:

- stay nights;
- booking lead days;
- effective campground/period stay bounds;
- weekend-night count;
- overlapping holiday names;
- overlapping season names;
- pass/fail issues.

This evaluator deliberately does not inspect reservations or calculate prices.

### Visible management interface

Management → Campgrounds → **Booking calendar & date rules** provides:

- campground selection;
- current policy summary;
- check-in/out, lead-window and stay-limit editor;
- configurable weekend-day checkboxes;
- holiday/season creation and archival;
- visible row revisions and active/archive state;
- a proposed-stay preview that evaluates the current rules before later availability/pricing builds consume them.

The Campground Administration page links directly to the Build 032 workbench.

## Security and data integrity

Both new public-schema tables:

- enable and FORCE PostgreSQL RLS;
- deny direct public, anon and authenticated access;
- grant only SELECT/INSERT/UPDATE to the trusted icamp_app role;
- intentionally grant no DELETE privilege;
- permit rule/period reads to appropriate reservation/configuration users;
- require campground.configuration for writes;
- bind writes to icamp.user_id actor context;
- include foreign-key/query indexes to avoid known advisor issues.

Rule saves and calendar create/archive operations append audit evidence.

This design also accounts for the 2026 Supabase Data API default change: the app uses its direct PostgreSQL application role and does not rely on automatic browser/API table exposure.

## Build boundaries

Build 032 does **not** own:

- reservation/hold/closure conflict resolution — **Build 035**;
- atomic temporary reservation holds — **Build 036**;
- public booking map selection — **Build 037**;
- dynamic weekend/holiday/season pricing — **Build 039**;
- checkout/payment workflows — later Phase 3 builds.

## Channel support

- **Web/PWA:** full authenticated manager configuration and rule-preview support.
- **IVR/DTMF:** safe fallback only; later reservation workflows may read/evaluate these server-side rules, but structural rule editing remains a Web/PWA management task.
- **SMS/MMS:** safe staff-assisted/link fallback only; rule editing is not accepted from free-form messaging.
- No public guest booking surface is introduced by this build.

## Infrastructure

Build 032 adds no new paid service, hosting project, worker, storage bucket, mapping provider or external runtime dependency.

## Verification target

Promotion requires:

- repository/unit tests for policy validation and date evaluation;
- database migration/verification gates;
- application Verify and Browser E2E;
- JavaScript/TypeScript analysis and CodeQL;
- Gitleaks/Secret Scan;
- hosted Supabase migration verification and advisors;
- fresh dev and main GREEN promotion evidence.
