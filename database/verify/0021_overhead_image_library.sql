-- Build 018 overhead image library verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 018 Verify Org', 'build018-verify-org')
returning id as b18_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b18_org_id',
  'Build 018 Verify Camp',
  'build018-verify-camp',
  'America/Toronto'
)
returning id as b18_camp_id
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
  :'b18_org_id',
  :'b18_camp_id',
  'internal',
  'image',
  'supabase',
  'icamp-internal-media',
  :'b18_org_id' || '/' || :'b18_camp_id' || '/build018v1.png',
  'build018v1.png',
  'image/png',
  4096,
  repeat('a', 64),
  'validated',
  'active'
)
returning id as b18_media_v1
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
  :'b18_org_id',
  :'b18_camp_id',
  'internal',
  'image',
  'supabase',
  'icamp-internal-media',
  :'b18_org_id' || '/' || :'b18_camp_id' || '/build018v2.png',
  'build018v2.png',
  'image/png',
  8192,
  repeat('b', 64),
  'validated',
  'active'
)
returning id as b18_media_v2
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
  :'b18_org_id',
  :'b18_camp_id',
  :'b18_media_v1',
  1,
  'Initial site plan',
  2048,
  1536,
  'image/png',
  4096,
  repeat('a', 64),
  true
)
returning id as b18_version_v1
\gset

update icamp_private.campground_map_image_versions
set is_active = false
where id = :'b18_version_v1';

insert into icamp_private.campground_map_image_versions (
  organization_id,
  campground_id,
  media_asset_id,
  version_number,
  label,
  notes,
  source_width,
  source_height,
  source_content_type,
  source_byte_size,
  source_checksum_sha256,
  is_active,
  is_published,
  published_at
)
values (
  :'b18_org_id',
  :'b18_camp_id',
  :'b18_media_v2',
  2,
  'Updated drone survey',
  'Synthetic verification only.',
  4096,
  3072,
  'image/png',
  8192,
  repeat('b', 64),
  true,
  true,
  statement_timestamp()
)
returning id as b18_version_v2
\gset

select set_config('icamp.test.b18_version_v1', :'b18_version_v1', true);
select set_config('icamp.test.b18_version_v2', :'b18_version_v2', true);

savepoint duplicate_active;
do $build018_active$
begin
  begin
    update icamp_private.campground_map_image_versions
    set is_active = true
    where id = current_setting('icamp.test.b18_version_v1')::uuid;
    raise exception 'Expected one-active-version constraint';
  exception
    when unique_violation then
      null;
  end;
end
$build018_active$;
rollback to savepoint duplicate_active;

savepoint duplicate_published;
do $build018_published$
begin
  begin
    update icamp_private.campground_map_image_versions
    set is_published = true,
        published_at = statement_timestamp()
    where id = current_setting('icamp.test.b18_version_v1')::uuid;
    raise exception 'Expected one-published-version constraint';
  exception
    when unique_violation then
      null;
  end;
end
$build018_published$;
rollback to savepoint duplicate_published;

update icamp_private.campground_map_image_versions
set label = 'Updated drone survey verified'
where id = :'b18_version_v2';

do $build018_verify$
declare
  row_data record;
begin
  select
    version_number,
    source_width,
    source_height,
    is_active,
    is_published,
    row_version
  into row_data
  from icamp_private.campground_map_image_versions
  where id = current_setting('icamp.test.b18_version_v2')::uuid;

  if row_data.version_number <> 2 then
    raise exception 'Expected version 2';
  end if;
  if row_data.source_width <> 4096 or row_data.source_height <> 3072 then
    raise exception 'Unexpected source dimensions';
  end if;
  if not row_data.is_active or not row_data.is_published then
    raise exception 'Expected active and published version';
  end if;
  if row_data.row_version < 2 then
    raise exception 'Expected row-version increment';
  end if;
end
$build018_verify$;

rollback;
