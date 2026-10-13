-- Build 030 accommodation and asset status engine verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 030 Verify Org', 'build030-verify-org')
returning id as b30_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b30_org_id',
  'Build 030 Verify Camp',
  'build030-verify-camp',
  'America/Toronto'
)
returning id as b30_camp_id
\gset

insert into public.campground_sections (
  organization_id,
  campground_id,
  name,
  code,
  sort_order
)
values (
  :'b30_org_id',
  :'b30_camp_id',
  'Status Loop',
  'STATUS',
  10
)
returning id as b30_section_id
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
  :'b30_org_id',
  :'b30_camp_id',
  'site',
  'STATUS-SITE',
  'Status Site',
  :'b30_section_id'
)
returning id as b30_map_id
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
  :'b30_org_id',
  :'b30_camp_id',
  :'b30_section_id',
  :'b30_map_id',
  'campsite',
  'STATUS-SITE',
  'Status Site'
)
returning id as b30_accommodation_id
\gset

insert into public.campsites (
  accommodation_id,
  organization_id,
  campground_id
)
values (
  :'b30_accommodation_id',
  :'b30_org_id',
  :'b30_camp_id'
);

insert into icamp_private.campground_map_objects (
  organization_id,
  campground_id,
  object_kind,
  object_code,
  display_name,
  section_id
)
values (
  :'b30_org_id',
  :'b30_camp_id',
  'pool',
  'STATUS-POOL',
  'Status Pool',
  :'b30_section_id'
)
returning id as b30_asset_map_id
\gset

insert into public.operational_assets (
  organization_id,
  campground_id,
  section_id,
  map_object_id,
  asset_class,
  code,
  display_name,
  operating_state
)
values (
  :'b30_org_id',
  :'b30_camp_id',
  :'b30_section_id',
  :'b30_asset_map_id',
  'facility',
  'STATUS-POOL',
  'Status Pool',
  'operational'
)
returning id as b30_asset_id
\gset

insert into public.operational_facilities (
  asset_id,
  organization_id,
  campground_id,
  facility_type,
  guest_visibility
)
values (
  :'b30_asset_id',
  :'b30_org_id',
  :'b30_camp_id',
  'pool',
  'internal'
);

set constraints all immediate;

update public.accommodations
set status_state = 'held'
where id = :'b30_accommodation_id';

update public.operational_assets
set operating_state = 'limited'
where id = :'b30_asset_id';

select set_config('icamp.test.b30_accommodation_id', :'b30_accommodation_id', true);
select set_config('icamp.test.b30_asset_id', :'b30_asset_id', true);

do $build030_verify$
declare
  accommodation_revision bigint;
  availability_revision bigint;
  asset_revision bigint;
  accommodation_history_count integer;
  asset_history_count integer;
  rejected_accommodation boolean := false;
  rejected_asset boolean := false;
begin
  select status_revision, availability_revision
  into accommodation_revision, availability_revision
  from public.accommodations
  where id = current_setting('icamp.test.b30_accommodation_id', true)::uuid;

  if accommodation_revision <> 2 or availability_revision <> 2 then
    raise exception 'Accommodation status transition did not advance both revisions';
  end if;

  select count(*)
  into accommodation_history_count
  from public.accommodation_status_history
  where accommodation_id = current_setting('icamp.test.b30_accommodation_id', true)::uuid;

  if accommodation_history_count <> 2 then
    raise exception 'Accommodation status history did not record baseline plus transition';
  end if;

  select status_revision
  into asset_revision
  from public.operational_assets
  where id = current_setting('icamp.test.b30_asset_id', true)::uuid;

  if asset_revision <> 2 then
    raise exception 'Operational asset status transition did not advance status revision';
  end if;

  select count(*)
  into asset_history_count
  from public.operational_asset_status_history
  where asset_id = current_setting('icamp.test.b30_asset_id', true)::uuid;

  if asset_history_count <> 2 then
    raise exception 'Operational asset status history did not record baseline plus transition';
  end if;

  begin
    update public.accommodations
    set status_state = 'departing'
    where id = current_setting('icamp.test.b30_accommodation_id', true)::uuid;
  exception
    when raise_exception then
      rejected_accommodation := true;
  end;

  if not rejected_accommodation then
    raise exception 'Build 030 accepted an invalid accommodation transition';
  end if;

  begin
    update public.operational_assets
    set operating_state = 'unknown'
    where id = current_setting('icamp.test.b30_asset_id', true)::uuid;
  exception
    when raise_exception then
      rejected_asset := true;
  end;

  if not rejected_asset then
    raise exception 'Build 030 accepted an invalid operational asset transition';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'anon'
  ) and (
    has_table_privilege('anon', 'public.accommodation_status_history', 'select')
    or has_table_privilege('anon', 'public.operational_asset_status_history', 'select')
  ) then
    raise exception 'anon must not directly read Build 030 status history';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'authenticated'
  ) and (
    has_table_privilege('authenticated', 'public.accommodation_status_history', 'select')
    or has_table_privilege('authenticated', 'public.operational_asset_status_history', 'select')
  ) then
    raise exception 'authenticated must not directly read Build 030 status history';
  end if;
end
$build030_verify$;

rollback;
