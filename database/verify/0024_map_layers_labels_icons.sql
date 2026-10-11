-- Build 022 map layers, labels and icons verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 022 Verify Org', 'build022-verify-org')
returning id as b22_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b22_org_id',
  'Build 022 Verify Camp',
  'build022-verify-camp',
  'America/Toronto'
)
returning id as b22_camp_id
\gset

insert into icamp_private.campground_map_layers (
  organization_id,
  campground_id,
  layer_key,
  display_name,
  icon_key,
  sort_order,
  visibility_permission_key
)
values
  (:'b22_org_id', :'b22_camp_id', 'booking', 'Booking', 'calendar', 10, 'reservation.read'),
  (:'b22_org_id', :'b22_camp_id', 'maintenance', 'Maintenance', 'tools', 20, 'maintenance.read'),
  (:'b22_org_id', :'b22_camp_id', 'security', 'Security', 'shield', 30, 'access.events.read'),
  (:'b22_org_id', :'b22_camp_id', 'utilities', 'Utilities', 'bolt', 40, 'campground.map'),
  (:'b22_org_id', :'b22_camp_id', 'amenities', 'Amenities', 'star', 50, 'accommodation.read'),
  (:'b22_org_id', :'b22_camp_id', 'management', 'Management', 'layers', 60, 'campground.configuration');

select set_config('icamp.test.b22_camp_id', :'b22_camp_id', true);

do $build022_verify$
declare
  layer_count integer;
  distinct_order_count integer;
begin
  select count(*), count(distinct sort_order)
  into layer_count, distinct_order_count
  from icamp_private.campground_map_layers
  where campground_id = current_setting('icamp.test.b22_camp_id')::uuid;

  if layer_count <> 6 then
    raise exception 'Expected six Build 022 layer families, found %', layer_count;
  end if;

  if distinct_order_count <> 6 then
    raise exception 'Expected independently ordered Build 022 layers';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'icamp_private'
      and table_name = 'campground_map_polygons'
      and column_name = 'layer_id'
      and is_nullable = 'NO'
  ) then
    raise exception 'Expected required polygon layer binding column';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'icamp_private'
      and table_name = 'campground_map_polygons'
      and column_name = 'map_label'
      and is_nullable = 'NO'
  ) then
    raise exception 'Expected required polygon map label';
  end if;

  if has_table_privilege(
    'anon',
    'icamp_private.campground_map_layers',
    'select'
  ) then
    raise exception 'anon must not directly read private map layers';
  end if;

  if has_table_privilege(
    'authenticated',
    'icamp_private.campground_map_layers',
    'select'
  ) then
    raise exception 'authenticated must not directly read private map layers';
  end if;
end
$build022_verify$;

rollback;
