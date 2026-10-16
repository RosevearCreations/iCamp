-- iCamp Build 049 advisor hardening
-- Cover composite foreign-key paths reported by hosted Supabase Performance Advisor.

create index reservation_check_ins_scope_reservation_fk_idx
  on public.reservation_check_ins(
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_check_ins_scope_guest_profile_fk_idx
  on public.reservation_check_ins(
    organization_id,
    campground_id,
    guest_profile_id
  )
  where guest_profile_id is not null;
