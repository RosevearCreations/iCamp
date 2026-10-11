-- Build 023 canonical map object binding verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 023 Verify Org', 'build023-verify-org')
returning id as b23_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b23_org_id',
  'Build 023 Verify Camp',
  'build023-verify-camp',
  'America/Toronto'
)
returning id as b23_camp_id
\gset

insert into icamp_private.media_assets (
  organization_id,
  campground_id,
  classification,
  media_kind,
  storage_provider,
  bucket_key,
  object_key,
  original_filename,
  content_type,
  byte_size,
  checksum_sha256,
  validation_state,
  lifecycle_state
)
values (
  :'b23_org_id',
  :'b23_camp_id',
  'internal',
  'image',
  'supabase',
  'icamp-internal-media',
  :'b23_org_id' || '/' || :'b23_camp_id' || '/build023.png',
  'build023.png',
  'image/png',
  4096,
  repeat('c', 64),
  'validated',
  'active'
)
returning id as b23_media_id
\gset

insert into icamp_private.campground_map_image_versions (
  organization_id,
  campground_id,
  media_asset_id,
  version_number,
  label,
  source_width,
  source_height,
  source_content_type,
  source_byte_size,
  source_checksum_sha256,
  is_active
)
values (
  :'b23_org_id',
  :'b23_camp_id',
  :'b23_media_id',
  1,
  'Build 023 verification map',
  2000,
  1000,
  'image/png',
  4096,
  repeat('c', 64),
  true
)
returning id as b23_version_id
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
  (:'b23_org_id', :'b23_camp_id', 'booking', 'Booking', 'calendar', 10, 'reservation.read'),
  (:'b23_org_id', :'b23_camp_id', 'amenities', 'Amenities', 'star', 50, 'accommodation.read')
returning id
\gset

select id as b23_booking_layer_id
from icamp_private.campground_map_layers
where campground_id = :'b23_camp_id'
  and layer_key = 'booking'
\gset

select id as b23_amenities_layer_id
from icamp_private.campground_map_layers
where campground_id = :'b23_camp_id'
  and layer_key = 'amenities'
\gset

insert into icamp_private.campground_map_polygons (
  organization_id,
  campground_id,
  map_image_version_id,
  label,
  geometry,
  layer_id,
  map_label
)
values (
  :'b23_org_id',
  :'b23_camp_id',
  :'b23_version_id',
  'Site A1 polygon',
  '{"schemaVersion":1,"closed":true,"vertices":[
    {"schemaVersion":1,"image":{"x":100,"y":100},"normalized":{"x":0.05,"y":0.1}},
    {"schemaVersion":1,"image":{"x":300,"y":100},"normalized":{"x":0.15,"y":0.1}},
    {"schemaVersion":1,"image":{"x":300,"y":250},"normalized":{"x":0.15,"y":0.25}},
    {"schemaVersion":1,"image":{"x":100,"y":250},"normalized":{"x":0.05,"y":0.25}}
  ]}'::jsonb,
  :'b23_booking_layer_id',
  'Site A1'
)
returning id as b23_polygon_id
\gset

insert into icamp_private.campground_map_objects (
  organization_id,
  campground_id,
  object_kind,
  object_code,
  display_name
)
values (
  :'b23_org_id',
  :'b23_camp_id',
  'site',
  'A-01',
  'Site A1'
)
returning id as b23_site_object_id
\gset

insert into icamp_private.campground_map_objects (
  organization_id,
  campground_id,
  object_kind,
  object_code,
  display_name
)
values (
  :'b23_org_id',
  :'b23_camp_id',
  'pool',
  'POOL-01',
  'Main Pool'
)
returning id as b23_pool_object_id
\gset

insert into icamp_private.campground_map_object_bindings (
  organization_id,
  campground_id,
  map_object_id,
  map_image_version_id,
  layer_id,
  geometry_kind,
  polygon_id
)
values (
  :'b23_org_id',
  :'b23_camp_id',
  :'b23_site_object_id',
  :'b23_version_id',
  :'b23_booking_layer_id',
  'polygon',
  :'b23_polygon_id'
);

insert into icamp_private.campground_map_object_bindings (
  organization_id,
  campground_id,
  map_object_id,
  map_image_version_id,
  layer_id,
  geometry_kind,
  point_geometry
)
values (
  :'b23_org_id',
  :'b23_camp_id',
  :'b23_pool_object_id',
  :'b23_version_id',
  :'b23_amenities_layer_id',
  'point',
  '{"schemaVersion":1,"image":{"x":900,"y":450},"normalized":{"x":0.45,"y":0.45}}'::jsonb
);

savepoint duplicate_object_binding;
do $build023_duplicate_object$
begin
  begin
    insert into icamp_private.campground_map_object_bindings (
      organization_id,
      campground_id,
      map_object_id,
      map_image_version_id,
      layer_id,
      geometry_kind,
      point_geometry
    )
    values (
      current_setting('icamp.test.b23_org_id')::uuid,
      current_setting('icamp.test.b23_camp_id')::uuid,
      current_setting('icamp.test.b23_site_object_id')::uuid,
      current_setting('icamp.test.b23_version_id')::uuid,
      current_setting('icamp.test.b23_booking_layer_id')::uuid,
      'point',
      '{"schemaVersion":1,"image":{"x":500,"y":500},"normalized":{"x":0.25,"y":0.5}}'::jsonb
    );
    raise exception 'Expected duplicate map object binding rejection';
  exception
    when unique_violation then
      null;
  end;
end
$build023_duplicate_object$;
rollback to savepoint duplicate_object_binding;

savepoint orphan_binding;
do $build023_orphan$
begin
  begin
    insert into icamp_private.campground_map_object_bindings (
      organization_id,
      campground_id,
      map_object_id,
      map_image_version_id,
      layer_id,
      geometry_kind,
      point_geometry
    )
    values (
      current_setting('icamp.test.b23_org_id')::uuid,
      current_setting('icamp.test.b23_camp_id')::uuid,
      gen_random_uuid(),
      current_setting('icamp.test.b23_version_id')::uuid,
      current_setting('icamp.test.b23_booking_layer_id')::uuid,
      'point',
      '{"schemaVersion":1,"image":{"x":500,"y":500},"normalized":{"x":0.25,"y":0.5}}'::jsonb
    );
    raise exception 'Expected orphan map object binding rejection';
  exception
    when foreign_key_violation then
      null;
  end;
end
$build023_orphan$;
rollback to savepoint orphan_binding;

do $build023_verify$
declare
  object_count integer;
  binding_count integer;
begin
  select count(*)
  into object_count
  from icamp_private.campground_map_objects
  where campground_id = current_setting('icamp.test.b23_camp_id')::uuid;

  select count(*)
  into binding_count
  from icamp_private.campground_map_object_bindings
  where campground_id = current_setting('icamp.test.b23_camp_id')::uuid;

  if object_count <> 2 then
    raise exception 'Expected two canonical map objects, found %', object_count;
  end if;

  if binding_count <> 2 then
    raise exception 'Expected polygon and point bindings, found %', binding_count;
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'anon'
  ) and has_table_privilege(
    'anon',
    'icamp_private.campground_map_objects',
    'select'
  ) then
    raise exception 'anon must not directly read private map objects';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'authenticated'
  ) and has_table_privilege(
    'authenticated',
    'icamp_private.campground_map_object_bindings',
    'select'
  ) then
    raise exception 'authenticated must not directly read private map bindings';
  end if;
end
$build023_verify$;

rollback;
