# Build 036 — Atomic Temporary Reservation Holds

Status: **FULLY PROMOTED — `main` GREEN.**

## Scope
Build 036 owns temporary booking inventory hold creation, configurable duration, countdown, atomic conflict prevention, expiry/release and idempotency. It extends the protected `reservation_holds` source introduced by Build 035 without creating a parallel availability model.

## Delivered
- campground-configurable temporary hold duration, bounded to 2-60 minutes with a 15-minute default;
- campground-scoped hold request keys as the idempotency boundary;
- advisory-lock serialization for both idempotency keys and accommodation inventory;
- idempotent retry behavior that returns the original live hold instead of extending it;
- stable rejection of reused keys with divergent inventory/date requests;
- lazy expiry reconciliation plus immediate server-authoritative expiry semantics through `expires_at`;
- explicit idempotent release;
- RLS-protected hold insert/update policies limited to `reservation.create`;
- direct `anon` and `authenticated` mutations remain denied;
- Management → Campgrounds → Live availability → Temporary holds workbench;
- live one-second Web/PWA countdown with refresh at expiry;
- pending-state buttons for create/release/configuration actions to reduce duplicate submissions.

## Channel contract
- **Web/PWA:** full create/countdown/expiry/release workbench.
- **IVR/DTMF:** future booking menus call the same atomic server command; remaining hold time may be spoken.
- **SMS/MMS:** future booking flows call the same atomic command and return server expiry time through secure booking continuation.
- All channels share the same hold key, inventory lock and expiry authority.

## Verification
- repository tests cover duration/key validation, dual advisory-lock contract, expiry/release ownership, idempotency mapping and countdown behavior;
- PostgreSQL migration verification requires the duration setting, atomic create/release/expiry functions, trusted-role mutation privileges/policies and direct-role denial;
- feature PR #140 head `bbc0655bbfbe4c2c7a1f0743b7f0fe57eb8372e3`: CI `38485807093`, CodeQL `38485807107`, Secret Scan `38485807046` — all GREEN;
- feature merged to `dev` as `f0435cbad068dd55954663974e81c4d6b395ffb7`;
- independent `dev` validation: CI `38486142646`, CodeQL `38486142691`, Secret Scan `38486142643` — all GREEN, including Verify, Browser E2E and Database migrations;
- hosted Supabase migration `20261013234525` (`atomic_temporary_reservation_holds`) is live;
- hosted verifier confirms duration setting, atomic create/release/expiry functions, trusted `icamp_app` mutation privileges/policies and direct-role denial;
- Supabase Security Advisor: zero findings;
- Supabase Performance Advisor: no Build-036-specific regression; only existing unused-index INFO notices remain;
- production PR #141 candidate head `2349615d178a460dd582eb23b5b2d8b8963e6258`: CI `38486554315`, CodeQL `38486554264`, Secret Scan `38486554416` — all GREEN;
- production feature merge: `d7235e9fb3be7280278413a161399fd2a8a035b2`;
- independent `main` verification: CI `38486773964`, CodeQL `38486773898`, Secret Scan `38486773926` — all GREEN, including Verify, Browser E2E and Database migrations.

## Promotion
- feature PR: #140
- production PR: #141
- `main`: **Production GREEN**

## Next queued build
**Build 037 — Public Interactive Booking Map**
