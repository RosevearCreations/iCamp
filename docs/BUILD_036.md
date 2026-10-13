# Build 036 — Atomic Temporary Reservation Holds

Status: **IMPLEMENTED — promotion in progress.**

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
- hosted Supabase migration/advisor and production evidence will be recorded during promotion.

## Next queued build
**Build 037 — Public Interactive Booking Map**
