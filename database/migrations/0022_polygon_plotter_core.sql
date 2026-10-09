-- iCamp Build 020
-- Polygon Plotter Core persistence.

create table icamp_private.campground_map_polygons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  map_image_version_id uuid not null
    references icamp_private.campground_map_image_versions(id)
    on update cascade
    on delete restrict,
  label text not null
    check (char_length(trim(label)) between 1 and 160),
  geometry jsonb not null,
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_map_polygons_scope_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_map_polygons_geometry_check
    check (
      jsonb_typeof(geometry) = 'object'
      and geometry ->> 'schemaVersion' = '1'
      and geometry ->> 'closed' = 'true'
      and jsonb_typeof(geometry -> 'vertices') = 'array'
      and jsonb_array_length(geometry -> 'vertices') between 3 and 256
    )
);

create index campground_map_polygons_version_idx
  on icamp_private.campground_map_polygons (map_image_version_id, updated_at desc);

create index campground_map_polygons_scope_idx
  on icamp_private.campground_map_polygons (organization_id, campground_id, updated_at desc);

create index campground_map_polygons_created_by_idx
  on icamp_private.campground_map_polygons (created_by_user_id)
  where created_by_user_id is not null;

create index campground_map_polygons_updated_by_idx
  on icamp_private.campground_map_polygons (updated_by_user_id)
  where updated_by_user_id is not null;

create trigger campground_map_polygons_touch_row
before update on icamp_private.campground_map_polygons
for each row execute function icamp_private.touch_row();

revoke all on icamp_private.campground_map_polygons from public;

do $build020_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.campground_map_polygons from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.campground_map_polygons from authenticated';
  end if;
end
$build020_permissions$;

comment on table icamp_private.campground_map_polygons is
  'Campground map polygon geometry bound to the exact overhead image version used for editing. Canonical object binding arrives in Build 023.';
