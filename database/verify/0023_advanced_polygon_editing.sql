-- Build 021 advanced polygon editing verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 021 Verify Org', 'build021-verify-org')
returning id as b21_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b21_org_id',
  'Build 021 Verify Camp',
  'build021-verify-camp',
  'America/Toronto'
)
returning id as b21_camp_id
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
  :'b21_org_id',
  :'b21_camp_id',
  'internal',
  'image',
  'supabase',
  'icamp-internal-media',
  :'b21_org_id' || '/' || :'b21_camp_id' || '/build021.png',
  'build021.png',
  'image/png',
  4096,
  repeat('d', 64),
  'validated',
  'active'
)
returning id as b21_media_id
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
  :'b21_org_id',
  :'b21_camp_id',
  :'b21_media_id',
  1,
  'Build 021 source',
  2000,
  1000,
  'image/png',
  4096,
  repeat('d', 64),
  true
)
returning id as b21_map_version_id
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
values (
  :'b21_org_id',
  :'b21_camp_id',
  'management',
  'Management',
  'layers',
  60,
  'campground.configuration'
)
returning id as b21_layer_id
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
  :'b21_org_id',
  :'b21_camp_id',
  :'b21_map_version_id',
  'Original polygon',
  '{"schemaVersion":1,"closed":true,"vertices":[
    {"schemaVersion":1,"image":{"x":100,"y":100},"normalized":{"x":0.05,"y":0.1}},
    {"schemaVersion":1,"image":{"x":500,"y":100},"normalized":{"x":0.25,"y":0.1}},
    {"schemaVersion":1,"image":{"x":500,"y":400},"normalized":{"x":0.25,"y":0.4}},
    {"schemaVersion":1,"image":{"x":100,"y":400},"normalized":{"x":0.05,"y":0.4}}
  ]}'::jsonb,
  :'b21_layer_id',
  'Original polygon'
)
returning id as b21_polygon_id
\gset

update icamp_private.campground_map_polygons
set is_locked = true,
    is_hidden = true,
    archived_at = statement_timestamp()
where id = :'b21_polygon_id';

insert into icamp_private.campground_map_polygons (
  organization_id,
  campground_id,
  map_image_version_id,
  label,
  geometry,
  layer_id,
  map_label,
  map_icon_key,
  map_label_visible,
  duplicated_from_polygon_id
)
select
  organization_id,
  campground_id,
  map_image_version_id,
  'Original polygon copy',
  geometry,
  layer_id,
  map_label,
  map_icon_key,
  map_label_visible,
  id
from icamp_private.campground_map_polygons
where id = :'b21_polygon_id'
returning id as b21_copy_id
\gset

select set_config('icamp.test.b21_polygon_id', :'b21_polygon_id', true);
select set_config('icamp.test.b21_copy_id', :'b21_copy_id', true);

do $build021_verify$
declare
  original record;
  copied record;
begin
  select is_locked, is_hidden, archived_at, row_version
  into original
  from icamp_private.campground_map_polygons
  where id = current_setting('icamp.test.b21_polygon_id')::uuid;

  select duplicated_from_polygon_id, is_locked, is_hidden, archived_at
  into copied
  from icamp_private.campground_map_polygons
  where id = current_setting('icamp.test.b21_copy_id')::uuid;

  if not original.is_locked or not original.is_hidden or original.archived_at is null then
    raise exception 'Expected persistent Build 021 lifecycle state';
  end if;
  if original.row_version < 2 then
    raise exception 'Expected lifecycle update to increment row version';
  end if;
  if copied.duplicated_from_polygon_id <> current_setting('icamp.test.b21_polygon_id')::uuid then
    raise exception 'Expected duplicate provenance';
  end if;
  if copied.is_locked or copied.is_hidden or copied.archived_at is not null then
    raise exception 'Expected duplicate to start active, visible and unlocked';
  end if;
end
$build021_verify$;

rollback;
