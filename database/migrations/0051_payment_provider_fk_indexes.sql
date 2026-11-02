-- iCamp Build 042 advisor hardening.
-- Cover composite foreign keys reported by the hosted Supabase Performance Advisor.

create index reservation_payment_schedules_scope_fk_idx
  on public.reservation_payment_schedules (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_payments_reservation_scope_fk_idx
  on public.reservation_payments (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_payments_schedule_scope_fk_idx
  on public.reservation_payments (
    organization_id,
    campground_id,
    payment_schedule_id
  );
