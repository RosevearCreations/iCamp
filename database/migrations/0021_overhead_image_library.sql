-- iCamp Build 018
-- Overhead image library and version metadata.

create table icamp_private.campground_map_image_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  media_asset_id uuid not null
    references icamp_private.media_assets(id)
    on update cascade
    on delete restrict,
  version_number integer not null
    check (version_number >= 1),
  label text not null
    check (char_length(trim(label)) between 1 and 160),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  source_width integer not null
    check (source_width between 256 and 20000),
  source_height integer not null
    check (source_height between 256 and 20000),
  source_content_type text not null
    check (source_content_type in ('image/jpeg', 'image/png', 'image/webp')),
  source_byte_size bigint not null
    check (source_byte_size between 1 and 12582912),
  source_checksum_sha256 text not null
    check (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  is_active boolean not null default false,
  is_published boolean not null default false,
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  published_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  published_at timestamptz,
  row_version bigint not null default 1
    check (row_version >= 1),
  constraint campground_map_image_versions_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_map_image_versions_scope_version_unique
    unique (campground_id, version_number),
  constraint campground_map_image_versions_media_unique
    unique (media_asset_id),
  constraint campground_map_image_versions_published_metadata_check
    check (
      (is_published and published_at is not null)
      or
      (not is_published)
    )
);

create unique index campground_map_image_versions_one_active_idx
  on icamp_private.campground_map_image_versions (campground_id)
  where is_active;

create unique index campground_map_image_versions_one_published_idx
  on icamp_private.campground_map_image_versions (campground_id)
  where is_published;

create index campground_map_image_versions_scope_time_idx
  on icamp_private.campground_map_image_versions (
    organization_id,
    campground_id,
    created_at desc
  );

create index campground_map_image_versions_created_by_idx
  on icamp_private.campground_map_image_versions (
    created_by_user_id,
    created_at desc
  );

create index campground_map_image_versions_published_by_idx
  on icamp_private.campground_map_image_versions (
    published_by_user_id,
    published_at desc
  )
  where published_by_user_id is not null;

create trigger campground_map_image_versions_touch_row
before update on icamp_private.campground_map_image_versions
for each row execute function icamp_private.touch_row();

revoke all on icamp_private.campground_map_image_versions from public;

do $build018_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.campground_map_image_versions from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.campground_map_image_versions from authenticated';
  end if;
end
$build018_permissions$;

comment on table icamp_private.campground_map_image_versions is
  'Versioned overhead/drone/site-plan image metadata. Binary image bytes remain in the secure media storage adapter.';
comment on column icamp_private.campground_map_image_versions.is_active is
  'The image version selected for current map editing.';
comment on column icamp_private.campground_map_image_versions.is_published is
  'The version designated for publication. Public rendering remains governed by later map-publication workflows.';
