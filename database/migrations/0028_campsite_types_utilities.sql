-- iCamp Build 025
-- Campsite Types & Utility/Service Model.

alter table public.campsites
  add column campsite_type text not null default 'mixed'
    check (campsite_type in ('tent', 'rv', 'mixed')),
  add column service_level text not null default 'unserviced'
    check (service_level in ('unserviced', 'partial', 'serviced')),
  add column stay_profile text not null default 'transient'
    check (stay_profile in ('transient', 'seasonal', 'yearly', 'walk_up')),
  add column is_waterfront boolean not null default false,
  add column electrical_amperage integer not null default 0
    check (electrical_amperage in (0, 15, 20, 30, 50)),
  add column water_service text not null default 'none'
    check (water_service in ('none', 'shared', 'site')),
  add column wastewater_service text not null default 'none'
    check (wastewater_service in ('none', 'sewer', 'septic')),
  add column wifi_service text not null default 'none'
    check (wifi_service in ('none', 'shared', 'site')),
  add column site_length_meters numeric(6,2)
    check (site_length_meters is null or site_length_meters > 0),
  add column site_width_meters numeric(6,2)
    check (site_width_meters is null or site_width_meters > 0),
  add column max_rv_length_meters numeric(6,2)
    check (max_rv_length_meters is null or max_rv_length_meters > 0),
  add column max_rv_width_meters numeric(6,2)
    check (max_rv_width_meters is null or max_rv_width_meters > 0),
  add column max_rv_height_meters numeric(6,2)
    check (max_rv_height_meters is null or max_rv_height_meters > 0),
  add column surface_type text not null default 'natural'
    check (surface_type in ('natural', 'grass', 'gravel', 'paved', 'concrete', 'mixed')),
  add column pull_through boolean not null default false,
  add column shade_level text not null default 'none'
    check (shade_level in ('none', 'partial', 'full')),
  add column has_fire_ring boolean not null default false,
  add column has_picnic_table boolean not null default false,
  add column updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  add column updated_at timestamptz not null default statement_timestamp(),
  add column row_version bigint not null default 1
    check (row_version >= 1);

create trigger campsites_touch_row
before update on public.campsites
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.bump_campsite_availability_revision()
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

create trigger campsites_bump_availability_revision
after update of
  campsite_type,
  service_level,
  stay_profile,
  is_waterfront,
  electrical_amperage,
  water_service,
  wastewater_service,
  wifi_service,
  site_length_meters,
  site_width_meters,
  max_rv_length_meters,
  max_rv_width_meters,
  max_rv_height_meters,
  surface_type,
  pull_through,
  shade_level,
  has_fire_ring,
  has_picnic_table
on public.campsites
for each row execute function icamp_private.bump_campsite_availability_revision();

create index campsites_classification_idx
  on public.campsites (
    organization_id,
    campground_id,
    campsite_type,
    service_level,
    stay_profile
  );

create index campsites_updated_by_idx
  on public.campsites (updated_by_user_id)
  where updated_by_user_id is not null;

comment on column public.campsites.campsite_type is
  'Primary physical fit: tent, RV or mixed. Build 034 later resolves reservation compatibility.';
comment on column public.campsites.service_level is
  'Administrative service summary; individual utility fields remain authoritative.';
comment on column public.campsites.stay_profile is
  'Normal operating profile: transient, seasonal, yearly or walk-up. Build 047 later owns long-term assignments.';
comment on column public.campsites.electrical_amperage is
  'Maximum advertised electrical service in amperes; zero means no electrical service.';
comment on column public.campsites.wastewater_service is
  'Site wastewater connection: none, sewer or septic.';
comment on column public.campsites.max_rv_length_meters is
  'Physical RV length limit only. Booking compatibility remains owned by Build 034.';
comment on table public.campsites is
  'Campsite subtype with Build 025 type, utility/service, dimensional and physical-characteristic detail.';
