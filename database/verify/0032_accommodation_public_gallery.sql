-- Build 028 public accommodation gallery verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 028 Verify Org', 'build028-verify-org')
returning id as b28_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b28_org_id',
  'Build 028 Verify Camp',
  'build028-verify-camp',
  'America/Toronto'
)
returning id as b28_camp_id
\gset

insert into public.campground_sections (
  organization_id,
  campground_id,
  name,
  code,
  sort_order
)
values (
  :'b28_org_id',
  :'b28_camp_id',
  'Gallery Row',
  'GAL',
  10
)
returning id as b28_section_id
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
  :'b28_org_id',
  :'b28_camp_id',
  'site',
  'SITE-28',
  'Gallery Site 28',
  :'b28_section_id'
)
returning id as b28_map_id
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
  :'b28_org_id',
  :'b28_camp_id',
  :'b28_section_id',
  :'b28_map_id',
  'campsite',
  'SITE-28',
  'Gallery Site 28'
)
returning id as b28_accommodation_id
\gset

insert into public.campsites (
  accommodation_id,
  organization_id,
  campground_id
)
values (
  :'b28_accommodation_id',
  :'b28_org_id',
  :'b28_camp_id'
);

set constraints all immediate;

select set_config('icamp.test.b28_org_id', :'b28_org_id', true);
select set_config('icamp.test.b28_camp_id', :'b28_camp_id', true);
select set_config('icamp.test.b28_accommodation_id', :'b28_accommodation_id', true);

do $build028_verify$
declare
  i integer;
  source_id uuid;
  thumbnail_id uuid;
  optimized_id uuid;
  rejected_eleventh boolean := false;
begin
  for i in 1..10 loop
    source_id := gen_random_uuid();
    thumbnail_id := gen_random_uuid();
    optimized_id := gen_random_uuid();

    insert into icamp_private.media_assets (
      id,
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
      validation_state,
      lifecycle_state
    )
    values
      (
        source_id,
        current_setting('icamp.test.b28_org_id', true)::uuid,
        current_setting('icamp.test.b28_camp_id', true)::uuid,
        'public',
        'image',
        'supabase',
        'icamp-public-media',
        'verify/' || source_id::text || '.jpg',
        'source-' || i::text || '.jpg',
        'image/jpeg',
        2048,
        'validated',
        'active'
      ),
      (
        thumbnail_id,
        current_setting('icamp.test.b28_org_id', true)::uuid,
        current_setting('icamp.test.b28_camp_id', true)::uuid,
        'public',
        'image',
        'supabase',
        'icamp-public-media',
        'verify/' || thumbnail_id::text || '.webp',
        'thumb-' || i::text || '.webp',
        'image/webp',
        512,
        'validated',
        'active'
      ),
      (
        optimized_id,
        current_setting('icamp.test.b28_org_id', true)::uuid,
        current_setting('icamp.test.b28_camp_id', true)::uuid,
        'public',
        'image',
        'supabase',
        'icamp-public-media',
        'verify/' || optimized_id::text || '.webp',
        'optimized-' || i::text || '.webp',
        'image/webp',
        1024,
        'validated',
        'active'
      );

    insert into public.accommodation_public_gallery_images (
      organization_id,
      campground_id,
      accommodation_id,
      source_media_asset_id,
      thumbnail_media_asset_id,
      optimized_media_asset_id,
      caption,
      alt_text,
      sort_order,
      is_hero,
      source_width,
      source_height,
      thumbnail_width,
      thumbnail_height,
      optimized_width,
      optimized_height
    )
    values (
      current_setting('icamp.test.b28_org_id', true)::uuid,
      current_setting('icamp.test.b28_camp_id', true)::uuid,
      current_setting('icamp.test.b28_accommodation_id', true)::uuid,
      source_id,
      thumbnail_id,
      optimized_id,
      case when i = 1 then 'Hero site view' else null end,
      'Gallery verification image ' || i::text,
      i,
      i = 1,
      1600,
      900,
      360,
      203,
      1440,
      810
    );
  end loop;

  if (
    select count(*)
    from public.accommodation_public_gallery_images
    where accommodation_id =
      current_setting('icamp.test.b28_accommodation_id', true)::uuid
      and is_active
  ) <> 10 then
    raise exception 'Build 028 did not persist ten active gallery images';
  end if;

  if (
    select count(*)
    from public.accommodation_public_gallery_images
    where accommodation_id =
      current_setting('icamp.test.b28_accommodation_id', true)::uuid
      and is_active
      and is_hero
  ) <> 1 then
    raise exception 'Build 028 hero uniqueness failed';
  end if;

  source_id := gen_random_uuid();
  thumbnail_id := gen_random_uuid();
  optimized_id := gen_random_uuid();

  insert into icamp_private.media_assets (
    id,
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
    validation_state,
    lifecycle_state
  )
  values
    (
      source_id,
      current_setting('icamp.test.b28_org_id', true)::uuid,
      current_setting('icamp.test.b28_camp_id', true)::uuid,
      'public',
      'image',
      'supabase',
      'icamp-public-media',
      'verify/' || source_id::text || '.jpg',
      'source-11.jpg',
      'image/jpeg',
      2048,
      'validated',
      'active'
    ),
    (
      thumbnail_id,
      current_setting('icamp.test.b28_org_id', true)::uuid,
      current_setting('icamp.test.b28_camp_id', true)::uuid,
      'public',
      'image',
      'supabase',
      'icamp-public-media',
      'verify/' || thumbnail_id::text || '.webp',
      'thumb-11.webp',
      'image/webp',
      512,
      'validated',
      'active'
    ),
    (
      optimized_id,
      current_setting('icamp.test.b28_org_id', true)::uuid,
      current_setting('icamp.test.b28_camp_id', true)::uuid,
      'public',
      'image',
      'supabase',
      'icamp-public-media',
      'verify/' || optimized_id::text || '.webp',
      'optimized-11.webp',
      'image/webp',
      1024,
      'validated',
      'active'
    );

  begin
    insert into public.accommodation_public_gallery_images (
      organization_id,
      campground_id,
      accommodation_id,
      source_media_asset_id,
      thumbnail_media_asset_id,
      optimized_media_asset_id,
      alt_text,
      sort_order,
      source_width,
      source_height,
      thumbnail_width,
      thumbnail_height,
      optimized_width,
      optimized_height
    )
    values (
      current_setting('icamp.test.b28_org_id', true)::uuid,
      current_setting('icamp.test.b28_camp_id', true)::uuid,
      current_setting('icamp.test.b28_accommodation_id', true)::uuid,
      source_id,
      thumbnail_id,
      optimized_id,
      'Rejected eleventh image',
      10,
      1600,
      900,
      360,
      203,
      1440,
      810
    );
  exception
    when raise_exception then
      rejected_eleventh := true;
  end;

  if not rejected_eleventh then
    raise exception 'Build 028 accepted an eleventh active public image';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'anon'
  ) and has_table_privilege(
    'anon',
    'public.accommodation_public_gallery_images',
    'select'
  ) then
    raise exception 'anon must not directly read gallery management records';
  end if;

  if exists (
    select 1 from pg_roles where rolname = 'authenticated'
  ) and has_table_privilege(
    'authenticated',
    'public.accommodation_public_gallery_images',
    'select'
  ) then
    raise exception 'authenticated must not directly read gallery management records';
  end if;
end
$build028_verify$;

rollback;
