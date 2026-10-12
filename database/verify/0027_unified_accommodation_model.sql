-- Build 024 unified accommodation model verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 024 Verify Org', 'build024-verify-org')
returning id as b24_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b24_org_id',
  'Build 024 Verify Camp',
  'build024-verify-camp',
  'America/Toronto'
)
returning id as b24_camp_id
\gset

insert into public.campground_sections (
  organization_id,
  campground_id,
  name,
  code,
  sort_order
)
values (
  :'b24_org_id',
  :'b24_camp_id',
  'Accommodation Loop',
  'ACCOM',
  10
)
returning id as b24_section_id
\gset

insert into public.campground_subsections (
  organization_id,
  campground_id,
  section_id,
  name,
  code,
  sort_order
)
values (
  :'b24_org_id',
  :'b24_camp_id',
  :'b24_section_id',
  'North',
  'NORTH',
  10
)
returning id as b24_subsection_id
\gset

select set_config('icamp.test.b24_camp_id', :'b24_camp_id', true);

insert into icamp_private.campground_map_objects (
  organization_id,
  campground_id,
  object_kind,
  object_code,
  display_name,
  section_id
)
values
  (:'b24_org_id', :'b24_camp_id', 'site', 'SITE-01', 'Site 01', :'b24_section_id')
returning id as b24_site_map_id
\gset

insert into icamp_private.campground_map_objects (
  organization_id,
  campground_id,
  object_kind,
  object_code,
  display_name,
  section_id
)
values
  (:'b24_org_id', :'b24_camp_id', 'cottage', 'COTT-01', 'Cottage 01', :'b24_section_id')
returning id as b24_cottage_map_id
\gset

insert into icamp_private.campground_map_objects (
  organization_id,
  campground_id,
  object_kind,
  object_code,
  display_name,
  section_id
)
values
  (:'b24_org_id', :'b24_camp_id', 'permanent_unit', 'PERM-01', 'Permanent 01', :'b24_section_id')
returning id as b24_permanent_map_id
\gset

insert into public.accommodations (
  organization_id,
  campground_id,
  section_id,
  subsection_id,
  map_object_id,
  accommodation_kind,
  code,
  display_name
)
values (
  :'b24_org_id',
  :'b24_camp_id',
  :'b24_section_id',
  :'b24_subsection_id',
  :'b24_site_map_id',
  'campsite',
  'SITE-01',
  'Site 01'
)
returning id as b24_site_id
\gset

insert into public.campsites (
  accommodation_id,
  organization_id,
  campground_id
)
values (
  :'b24_site_id',
  :'b24_org_id',
  :'b24_camp_id'
);

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
  :'b24_org_id',
  :'b24_camp_id',
  :'b24_section_id',
  :'b24_cottage_map_id',
  'rental_cottage',
  'COTT-01',
  'Cottage 01'
)
returning id as b24_cottage_id
\gset

insert into public.rental_cottages (
  accommodation_id,
  organization_id,
  campground_id
)
values (
  :'b24_cottage_id',
  :'b24_org_id',
  :'b24_camp_id'
);

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
  :'b24_org_id',
  :'b24_camp_id',
  :'b24_section_id',
  :'b24_permanent_map_id',
  'permanent_unit',
  'PERM-01',
  'Permanent 01'
)
returning id as b24_permanent_id
\gset

insert into public.permanent_units (
  accommodation_id,
  organization_id,
  campground_id
)
values (
  :'b24_permanent_id',
  :'b24_org_id',
  :'b24_camp_id'
);

set constraints all immediate;

do $build024_verify$
declare
  parent_count integer;
  campsite_count integer;
  cottage_count integer;
  permanent_count integer;
begin
  select count(*) into parent_count
  from public.accommodations
  where campground_id = current_setting('icamp.test.b24_camp_id', true)::uuid;

  select count(*) into campsite_count
  from public.campsites
  where campground_id = current_setting('icamp.test.b24_camp_id', true)::uuid;

  select count(*) into cottage_count
  from public.rental_cottages
  where campground_id = current_setting('icamp.test.b24_camp_id', true)::uuid;

  select count(*) into permanent_count
  from public.permanent_units
  where campground_id = current_setting('icamp.test.b24_camp_id', true)::uuid;

  if parent_count <> 3 or campsite_count <> 1 or cottage_count <> 1 or permanent_count <> 1 then
    raise exception 'Unified accommodation/subtype counts are invalid';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'anon'
  ) and has_table_privilege('anon', 'public.accommodations', 'select') then
    raise exception 'anon must not directly read accommodations';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'authenticated'
  ) and has_table_privilege(
    'authenticated',
    'public.accommodations',
    'select'
  ) then
    raise exception 'authenticated must not directly read accommodations';
  end if;
end
$build024_verify$;

rollback;
