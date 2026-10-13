-- iCamp Build 035 advisor hardening
-- Cover Build 035 foreign keys reported by the hosted performance advisor.

create index reservations_accommodation_scope_fk_idx
  on public.reservations (organization_id, campground_id, accommodation_id);
create index reservations_created_by_fk_idx
  on public.reservations (created_by_user_id)
  where created_by_user_id is not null;
create index reservations_updated_by_fk_idx
  on public.reservations (updated_by_user_id)
  where updated_by_user_id is not null;

create index reservation_holds_accommodation_scope_fk_idx
  on public.reservation_holds (organization_id, campground_id, accommodation_id);
create index reservation_holds_created_by_fk_idx
  on public.reservation_holds (created_by_user_id)
  where created_by_user_id is not null;
create index reservation_holds_updated_by_fk_idx
  on public.reservation_holds (updated_by_user_id)
  where updated_by_user_id is not null;

create index seasonal_assignments_accommodation_scope_fk_idx
  on public.seasonal_assignments (organization_id, campground_id, accommodation_id);
create index seasonal_assignments_created_by_fk_idx
  on public.seasonal_assignments (created_by_user_id)
  where created_by_user_id is not null;
create index seasonal_assignments_updated_by_fk_idx
  on public.seasonal_assignments (updated_by_user_id)
  where updated_by_user_id is not null;

comment on index public.reservations_accommodation_scope_fk_idx is
  'Build 035 covering index for reservations accommodation scope foreign key.';
comment on index public.reservation_holds_accommodation_scope_fk_idx is
  'Build 035 covering index for reservation holds accommodation scope foreign key.';
comment on index public.seasonal_assignments_accommodation_scope_fk_idx is
  'Build 035 covering index for seasonal assignments accommodation scope foreign key.';
