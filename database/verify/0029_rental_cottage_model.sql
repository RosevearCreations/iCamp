-- Build 026 rental cottage model verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 026 Verify Org', 'build026-verify-org')
returning id as b26_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b26_org_id',
  'Build 026 Verify Camp',
  'build026-verify-camp',
  'America/Toronto'
)
returning id as b26_camp_id
\gset

insert into public.campground_sections (
  organization_id,
  campground_id,
  name,
  code,
  sort_order
)
values (
  :'b26_org_id',
  :'b26_camp_id',
  'Cottage Row',
  'COTT',
  10
)
returning id as b26_section_id
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
  :'b26_org_id',
  :'b26_camp_id',
  'cottage',
  'COTT-26',
  'Lake Cottage 26',
  :'b26_section_id'
)
returning id as b26_map_id
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
  :'b26_org_id',
  :'b26_camp_id',
  :'b26_section_id',
  :'b26_map_id',
  'rental_cottage',
  'COTT-26',
  'Lake Cottage 26'
)
returning id as b26_accommodation_id
\gset

insert into public.rental_cottages (
  accommodation_id,
  organization_id,
  campground_id,
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
)
values (
  :'b26_accommodation_id',
  :'b26_org_id',
  :'b26_camp_id',
  'serviced',
  2,
  3,
  6,
  'full',
  'private',
  'private',
  'heat_pump',
  'heat_pump',
  true,
  true,
  true,
  true,
  true,
  true,
  'lake'
);

set constraints all immediate;

select set_config(
  'icamp.test.b26_accommodation_id',
  :'b26_accommodation_id',
  true
);

do $build026_verify$
declare
  detail record;
  before_revision bigint;
  after_revision bigint;
  rejected_invalid_occupancy boolean := false;
begin
  select
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
  into detail
  from public.rental_cottages
  where accommodation_id = current_setting('icamp.test.b26_accommodation_id', true)::uuid;

  if detail.cottage_style <> 'serviced'
     or detail.bedroom_count <> 2
     or detail.bed_count <> 3
     or detail.max_occupancy <> 6
     or detail.kitchen_type <> 'full'
     or detail.washroom_type <> 'private'
     or detail.shower_type <> 'private'
     or detail.heating_type <> 'heat_pump'
     or detail.cooling_type <> 'heat_pump'
     or not detail.has_refrigerator
     or not detail.has_cooktop
     or not detail.has_oven
     or not detail.has_microwave
     or not detail.step_free_access
     or not detail.accessible_washroom
     or detail.view_type <> 'lake' then
    raise exception 'Build 026 cottage detail did not persist correctly';
  end if;

  select availability_revision into before_revision
  from public.accommodations
  where id = current_setting('icamp.test.b26_accommodation_id', true)::uuid;

  update public.rental_cottages
  set max_occupancy = 5
  where accommodation_id = current_setting('icamp.test.b26_accommodation_id', true)::uuid;

  select availability_revision into after_revision
  from public.accommodations
  where id = current_setting('icamp.test.b26_accommodation_id', true)::uuid;

  if after_revision <> before_revision + 1 then
    raise exception 'Cottage compatibility change did not advance availability revision';
  end if;

  begin
    update public.rental_cottages
    set max_occupancy = 0
    where accommodation_id = current_setting('icamp.test.b26_accommodation_id', true)::uuid;
  exception
    when check_violation then
      rejected_invalid_occupancy := true;
  end;

  if not rejected_invalid_occupancy then
    raise exception 'Invalid cottage occupancy was accepted';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'anon'
  ) and has_table_privilege('anon', 'public.rental_cottages', 'select') then
    raise exception 'anon must not directly read rental cottage detail';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'authenticated'
  ) and has_table_privilege('authenticated', 'public.rental_cottages', 'select') then
    raise exception 'authenticated must not directly read rental cottage detail';
  end if;
end
$build026_verify$;

rollback;
