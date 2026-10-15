# Build 048 — Guest Profiles & Saved Stay Information

Status: **IN DEVELOPMENT — NOT PRODUCTION GREEN**.

## Goal
Add optional guest-owned, campground-appropriate saved information without making an account mandatory for walk-up, staff-created, or guest checkout reservations.

## Required work and acceptance gates
1. Optional guest profile creation and update, bound to authenticated owner identity; never auto-create or merge guest accounts from email alone.
2. Contact information with separately saved consent/preferences; avoid storing sensitive data unnecessarily.
3. Multiple saved RV, towing/road vehicle and pet profiles with explicit owner scoping, field validation and safe deletion or archival.
4. Guest-visible stay history derived from existing canonical reservations; receipts from Build 043 reservation documents and captured-payment evidence, without copying authoritative financial data.
5. Privacy controls to view, correct, remove saved optional information and export it; never allow profile deletion to delete canonical reservation, payment, accounting or legally retained records.
6. Database tenant/owner authorization, FORCE RLS, direct anon/authenticated access tests, idempotent migration and rollback/forward-repair plan.
7. Server-only CRUD with authorization, input validation, audit evidence, anti-enumeration and no cross-guest history leakage.
8. Web/PWA account and saved-stay experience; IVR/DTMF and SMS/MMS use verified status/secure-link fallback, never disclose private profiles to an unverified caller.
9. Automated repository/database contract tests, UI/browser tests, CodeQL and secret scanning.
10. Apply and verify hosted database migration; independently confirm GREEN checks on feature, dev and production main exact commits before closeout.

## Hard boundaries
- Guest profile is optional. No guest profile implies no restriction to existing canonical booking flows.
- Reservation/pricing/payment/receipt/history sources of truth remain in their existing tables.
- No newly purchased services, hosts or providers.
- No production promotion on docs-only acceptance planning.
