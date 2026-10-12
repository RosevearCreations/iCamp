-- iCamp Build 026
-- Rental Cottage Model.

alter table public.rental_cottages
  add column cottage_style text not null default 'rustic'
    check (cottage_style in ('rustic', 'serviced')),
  add column bedroom_count smallint not null default 0
    check (bedroom_count between 0 and 20),
  add column bed_count smallint not null default 1
    check (bed_count between 1 and 40),
  add column max_occupancy smallint not null default 2
    check (max_occupancy between 1 and 80),
  add column kitchen_type text not null default 'none'
    check (kitchen_type in ('none', 'kitchenette', 'full')),
  add column washroom_type text not null default 'none'
    check (washroom_type in ('none', 'shared', 'private')),
  add column shower_type text not null default 'none'
    check (shower_type in ('none', 'shared', 'private')),
  add column heating_type text not null default 'none'
    check (heating_type in ('none', 'electric', 'propane', 'wood', 'heat_pump', 'other')),
  add column cooling_type text not null default 'none'
    check (cooling_type in ('none', 'fan', 'window_ac', 'central_ac', 'heat_pump', 'other')),
  add column has_refrigerator boolean not null default false,
  add column has_cooktop boolean not null default false,
  add column has_oven boolean not null default false,
  add column has_microwave boolean not null default false,
  add column step_free_access boolean not null default false,
  add column accessible_washroom boolean not null default false,
  add column view_type text not null default 'none'
    check (view_type in ('none', 'woodland', 'waterfront', 'lake', 'river', 'ocean', 'mountain', 'garden', 'other')),
  add column updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  add column updated_at timestamptz not null default statement_timestamp(),
  add column row_version bigint not null default 1
    check (row_version >= 1);

create trigger rental_cottages_touch_row
before update on public.rental_cottages
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.bump_cottage_availability_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.accommodations
  set availability_revision = availability_revision + 1,
      updated_by_user_id = coalesce(new.updated_by_user_id, updated_by_user_id)
  where id = new.accommodation_id
    and organization_id = new.organization_id
    and campground_id = new.campground_id;

  return null;
end;
$$;

create trigger rental_cottages_bump_availability_revision
after update of
  cottage_style,
  bedroom_count,
  bed_count,
  max_occupancy,
  kitchen_type,
  washroom_type,
  shower_type,
  heating_type,
  cooling_type,
  has_refrigerator,
  has_cooktop,
  has_oven,
  has_microwave,
  step_free_access,
  accessible_washroom,
  view_type
on public.rental_cottages
for each row execute function icamp_private.bump_cottage_availability_revision();

create index rental_cottages_classification_idx
  on public.rental_cottages (
    organization_id,
    campground_id,
    cottage_style,
    max_occupancy,
    kitchen_type,
    washroom_type
  );

create index rental_cottages_updated_by_idx
  on public.rental_cottages (updated_by_user_id)
  where updated_by_user_id is not null;

comment on column public.rental_cottages.cottage_style is
  'Rental cottage service profile: rustic or serviced.';
comment on column public.rental_cottages.max_occupancy is
  'Physical advertised sleeping occupancy. Build 033 later owns configurable capacity rules and Build 034 compatibility.';
comment on column public.rental_cottages.kitchen_type is
  'Kitchen provision: none, kitchenette or full kitchen.';
comment on column public.rental_cottages.washroom_type is
  'Washroom provision: none, shared facility or private in-cottage.';
comment on column public.rental_cottages.shower_type is
  'Shower provision: none, shared facility or private in-cottage.';
comment on column public.rental_cottages.step_free_access is
  'Physical step-free access fact consumed by later compatibility and public-description workflows.';
comment on table public.rental_cottages is
  'Rental cottage subtype with Build 026 occupancy, facilities, appliances, accessibility and view detail.';
