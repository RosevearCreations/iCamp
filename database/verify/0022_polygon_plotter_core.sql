-- Build 020 polygon persistence verification.
\set ON_ERROR_STOP on
begin;

insert into public.organizations (name, slug)
values ('Build 020 Verify Org', 'build020-verify-org')
returning id as b20_org_id \gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (:'b20_org_id', 'Build 020 Verify Camp', 'build020-verify-camp', 'America/Toronto')
returning id as b20_camp_id \gset

insert into icamp_private.media_assets (
  organization_id, campground_id, classification, media_kind, storage_provider,
  bucket_key, object_key, original_filename, content_type, byte_size,
  checksum_sha256, validation_state, lifecycle_state
)
values (
  :'b20_org_id', :'b20_camp_id', 'internal', 'image', 'supabase',
  'icamp-internal-media', :'b20_org_id' || '/' || :'b20_camp_id' || '/build020.png',
  'build020.png', 'image/png', 4096, repeat('c', 64), 'validated', 'active'
)
returning id as b20_media_id \gset

insert into icamp_private.campground_map_image_versions (
  organization_id, campground_id, media_asset_id, version_number, label,
  source_width, source_height, source_content_type, source_byte_size,
  source_checksum_sha256, is_active
)
values (
  :'b20_org_id', :'b20_camp_id', :'b20_media_id', 1, 'Build 020 source',
  2000, 1000, 'image/png', 4096, repeat('c', 64), true
)
returning id as b20_map_version_id \gset

insert into icamp_private.campground_map_layers (
  organization_id,
  campground_id,
  layer_key,
  display_name,
  icon_key,
  sort_order,
  visibility_permission_key
)
values (
  :'b20_org_id',
  :'b20_camp_id',
  'management',
  'Management',
  'layers',
  60,
  'campground.configuration'
)
returning id as b20_layer_id \gset

insert into icamp_private.campground_map_polygons (
  organization_id, campground_id, map_image_version_id, label, geometry,
  layer_id, map_label
)
values (
  :'b20_org_id', :'b20_camp_id', :'b20_map_version_id', 'Pool deck',
  '{"schemaVersion":1,"closed":true,"vertices":[
    {"schemaVersion":1,"image":{"x":100,"y":100},"normalized":{"x":0.05,"y":0.1}},
    {"schemaVersion":1,"image":{"x":500,"y":100},"normalized":{"x":0.25,"y":0.1}},
    {"schemaVersion":1,"image":{"x":500,"y":400},"normalized":{"x":0.25,"y":0.4}},
    {"schemaVersion":1,"image":{"x":100,"y":400},"normalized":{"x":0.05,"y":0.4}}
  ]}'::jsonb,
  :'b20_layer_id',
  'Pool deck'
)
returning id as b20_polygon_id \gset

update icamp_private.campground_map_polygons
set label = 'Pool deck verified'
where id = :'b20_polygon_id';

select set_config('icamp.test.b20_polygon_id', :'b20_polygon_id', true);
select set_config('icamp.test.b20_org_id', :'b20_org_id', true);
select set_config('icamp.test.b20_camp_id', :'b20_camp_id', true);
select set_config('icamp.test.b20_map_version_id', :'b20_map_version_id', true);
select set_config('icamp.test.b20_layer_id', :'b20_layer_id', true);

do $build020_verify$
declare
  row_data record;
begin
  select label, jsonb_array_length(geometry -> 'vertices') as vertex_count, row_version
  into row_data
  from icamp_private.campground_map_polygons
  where id = current_setting('icamp.test.b20_polygon_id')::uuid;

  if row_data.label <> 'Pool deck verified' then
    raise exception 'Polygon update was not persisted';
  end if;
  if row_data.vertex_count <> 4 then
    raise exception 'Expected four polygon vertices';
  end if;
  if row_data.row_version < 2 then
    raise exception 'Expected polygon row-version increment';
  end if;
end
$build020_verify$;

savepoint invalid_polygon;
do $build020_invalid$
begin
  begin
    insert into icamp_private.campground_map_polygons (
      organization_id, campground_id, map_image_version_id, label, geometry,
      layer_id, map_label
    )
    values (
      current_setting('icamp.test.b20_org_id')::uuid,
      current_setting('icamp.test.b20_camp_id')::uuid,
      current_setting('icamp.test.b20_map_version_id')::uuid,
      'Invalid',
      '{"schemaVersion":1,"closed":true,"vertices":[]}'::jsonb,
      current_setting('icamp.test.b20_layer_id')::uuid,
      'Invalid'
    );
    raise exception 'Expected geometry constraint';
  exception
    when check_violation then null;
  end;
end
$build020_invalid$;
rollback to savepoint invalid_polygon;

rollback;
