-- Build 025 campsite type and utility/service verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 025 Verify Org', 'build025-verify-org')
returning id as b25_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b25_org_id',
  'Build 025 Verify Camp',
  'build025-verify-camp',
  'America/Toronto'
)
returning id as b25_camp_id
\gset

insert into public.campground_sections (
  organization_id,
  campground_id,
  name,
  code,
  sort_order
)
values (
  :'b25_org_id',
  :'b25_camp_id',
  'Serviced Loop',
  'SERV',
  10
)
returning id as b25_section_id
\gset

insert into icamp_private.campground_map_objects (
  organization_id,
  campground_id,
  object_kind,
  object_code,
  display_name,
  section_id
)
values (
  :'b25_org_id',
  :'b25_camp_id',
  'site',
  'RV-50',
  'RV Site 50',
  :'b25_section_id'
)
returning id as b25_map_id
\gset

insert into public.accommodations (
  organization_id,
  campground_id,
  section_id,
  map_object_id,
  accommodation_kind,
  code,
  display_name
)
values (
  :'b25_org_id',
  :'b25_camp_id',
  :'b25_section_id',
  :'b25_map_id',
  'campsite',
  'RV-50',
  'RV Site 50'
)
returning id as b25_accommodation_id
\gset

insert into public.campsites (
  accommodation_id,
  organization_id,
  campground_id,
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
)
values (
  :'b25_accommodation_id',
  :'b25_org_id',
  :'b25_camp_id',
  'rv',
  'serviced',
  'seasonal',
  true,
  50,
  'site',
  'sewer',
  'shared',
  18.25,
  7.50,
  13.70,
  3.50,
  4.25,
  'gravel',
  true,
  'partial',
  true,
  true
);

set constraints all immediate;

select set_config(
  'icamp.test.b25_accommodation_id',
  :'b25_accommodation_id',
  true
);

do $build025_verify$
declare
  detail record;
  before_revision bigint;
  after_revision bigint;
  rejected_invalid_amperage boolean := false;
begin
  select
    campsite_type,
    service_level,
    stay_profile,
    is_waterfront,
    electrical_amperage,
    water_service,
    wastewater_service,
    wifi_service,
    site_length_meters,
    max_rv_length_meters,
    surface_type,
    pull_through,
    shade_level,
    has_fire_ring,
    has_picnic_table
  into detail
  from public.campsites
  where accommodation_id = current_setting('icamp.test.b25_accommodation_id', true)::uuid;

  if detail.campsite_type <> 'rv'
     or detail.service_level <> 'serviced'
     or detail.stay_profile <> 'seasonal'
     or detail.electrical_amperage <> 50
     or detail.water_service <> 'site'
     or detail.wastewater_service <> 'sewer'
     or detail.wifi_service <> 'shared'
     or detail.site_length_meters <> 18.25
     or detail.max_rv_length_meters <> 13.70
     or detail.surface_type <> 'gravel'
     or not detail.pull_through
     or detail.shade_level <> 'partial'
     or not detail.has_fire_ring
     or not detail.has_picnic_table then
    raise exception 'Build 025 campsite detail did not persist correctly';
  end if;

  select availability_revision into before_revision
  from public.accommodations
  where id = current_setting('icamp.test.b25_accommodation_id', true)::uuid;

  update public.campsites
  set electrical_amperage = 30
  where accommodation_id = current_setting('icamp.test.b25_accommodation_id', true)::uuid;

  select availability_revision into after_revision
  from public.accommodations
  where id = current_setting('icamp.test.b25_accommodation_id', true)::uuid;

  if after_revision <> before_revision + 1 then
    raise exception 'Campsite compatibility change did not advance availability revision';
  end if;

  begin
    update public.campsites
    set electrical_amperage = 25
    where accommodation_id = current_setting('icamp.test.b25_accommodation_id', true)::uuid;
  exception
    when check_violation then
      rejected_invalid_amperage := true;
  end;

  if not rejected_invalid_amperage then
    raise exception 'Invalid electrical amperage was accepted';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'anon'
  ) and has_table_privilege('anon', 'public.campsites', 'select') then
    raise exception 'anon must not directly read campsite detail';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'authenticated'
  ) and has_table_privilege('authenticated', 'public.campsites', 'select') then
    raise exception 'authenticated must not directly read campsite detail';
  end if;
end
$build025_verify$;

rollback;
