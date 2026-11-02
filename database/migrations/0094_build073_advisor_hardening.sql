-- iCamp Build 073 advisor hardening.
-- Adds covering indexes for the composite foreign keys reported by the
-- hosted Supabase performance advisor after 0093 was applied.

create index campsite_departure_cleanup_programs_scope_accommodation_fk_idx
  on public.campsite_departure_cleanup_programs(
    organization_id,
    campground_id,
    accommodation_id
  );

create index campsite_departure_cleanup_tasks_scope_checkout_fk_idx
  on public.campsite_departure_cleanup_tasks(
    organization_id,
    campground_id,
    reservation_check_out_id
  );

create index campsite_departure_cleanup_tasks_scope_occurrence_fk_idx
  on public.campsite_departure_cleanup_tasks(
    organization_id,
    campground_id,
    inspection_occurrence_id
  )
  where inspection_occurrence_id is not null;
