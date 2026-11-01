# Build 175 — Booking Draft Save-and-Resume & Safe Cross-Device Recovery

## Customer journey

1. A guest chooses a published campsite/cottage, dates and up to three optional add-ons on the public accommodation detail page. They explicitly tick a consent checkbox to save only these selections.
2. The save server action requires an authenticated **guest** account, validates the request, re-reads the live accommodation and eligible extras, and persists an account-owned draft through `icamp_app` RLS. There is no generated bearer recovery link or outbound email/SMS.
3. The same guest signs in on another device and opens **My booking drafts** from their account page or the booking detail page. Drafts can be resumed or deleted immediately.
4. Opening a draft fetches its owner-only record, then **re-runs current availability, price, selected fees and policy logic**. A change in current subtotal, currency or inventory revision is explicitly shown, as is unavailable inventory or invalid optional extras. The live quote component is the same as Build 174; prior numbers are never a current promise.
5. A guest must separately choose to visit the current accommodation detail and deliberately start Build 041 checkout. Draft saves, lists, deletes and resumes never call the hold, reservation, payment, billing or messaging services.

## Privacy, concurrency and expiration

- New migration `0186_build175_guest_booking_drafts.sql` stores seven-day, consented selections and a minimal historical rate/availability fingerprint (not PII, payment details, hold IDs or booking secrets). It binds campground and accommodation with tenant-composite FKs; account deletion cascades to drafts.
- RLS is **enabled and forced** with explicit guest-account ID checks for SELECT/INSERT/UPDATE/DELETE under the trusted server-only `icamp_app` principal. Direct Supabase `anon` / `authenticated` grants are revoked. Server actions independently check the active guest session. Staff and other guests cannot query drafts.
- Repeated saves of identical selections and source fingerprint reuse the same row without shifting expiry or row version. Intentional changes refresh consent timestamp and seven-day expiry. The unique guest/campground/accommodation/date key prevents duplicate drafts from double submissions.
- Expired drafts are immediately invisible to the account list and recovery route. Expired rows are physically removed when that account next saves, lists or opens drafts. A later global background retention sweep may be added as a separate separately reviewed housekeeping task; no retention daemon or cron has been falsely claimed.
- Server-side route URLs contain only the draft UUID and still require a valid guest session. No bearer token is granted; recovery links cannot bypass sign-in, and the live accommodation link carries no saved currency or total.
- There is no client-side persistent storage or auto-save; the guest must consent explicitly. Browser and device differences do not change server ownership. An absent database is reported as unavailable instead of a false saved-state claim.

## Acceptance gates

- `tests/build175-booking-drafts.test.mjs`: bounded input and consent contracts, live rate/inventory change and extra invalidation, recovery URL sensitivity, migration RLS and tenancy checks, action isolation from reservation/payment channels, idempotent SQL shape.
- `database/verify/0186_build175_guest_booking_drafts.sql`: forced RLS, ownership conditions on four CRUD policies, revoked direct Data API access, FK tenancy binding. GitHub CI's PostgreSQL 17 migration workflow is the first executable database gate; there is no configured local `DATABASE_URL` to run a real draft lifecycle here.
- Local format/lint/types/tests/build, GitHub checks, Vercel preview, merge and exact-commit production verification must all pass before the **code promotion** is GREEN. Live draft use additionally requires the real production `DATABASE_URL` and applied production migration; a healthy web deployment alone does **not** certify cross-device storage operational.

## Channel contract

| Channel | Status |
| --- | --- |
| Web/PWA | Explicit guest consent, seven-day account-owned save and deletion, device-independent list/resume, current source recheck. |
| Staff-assisted | Existing live/print quote can be read and a guest directed to their own sign-in; no impersonation or staff draft access. |
| IVR/DTMF/SMS/MMS | **HELD / DISCONNECTED**; no automatic one-time link delivery. |
| Billing/payment | **HELD / DISCONNECTED**; draft is never a hold, reservation or charge. |

## Next build

**Build 176 — Reservation Change/Cancellation Preview & Guest Decision Controls (Billing / Omnichannel HELD).** Provide authenticated guests an understandable, source-backed preview of eligible modification/cancellation choices and financial implications, preserving explicit consent and prohibiting automatic refunds/fees without owner/provider authorization.
