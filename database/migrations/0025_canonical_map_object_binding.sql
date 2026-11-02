-- iCamp Build 023
-- Canonical Map Object Binding.

alter table icamp_private.campground_map_image_versions
  add constraint campground_map_image_versions_scope_id_unique
    unique (organization_id, campground_id, id);

alter table icamp_private.campground_map_polygons
  add constraint campground_map_polygons_scope_id_unique
    unique (organization_id, campground_id, id);

create table icamp_private.campground_map_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  object_kind text not null
    check (
      object_kind in (
        'site',
        'cottage',
        'pool',
        'washroom',
        'gate',
        'dock',
        'road',
        'building',
        'asset'
      )
    ),
  object_code text not null
    check (object_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 160),
  section_id uuid,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'archived')),
  archived_at timestamptz,
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
  constraint campground_map_objects_scope_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_map_objects_section_fk
    foreign key (organization_id, campground_id, section_id)
    references public.campground_sections(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint campground_map_objects_scope_code_unique
    unique (campground_id, object_code),
  constraint campground_map_objects_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint campground_map_objects_archive_state_check
    check (
      lifecycle_state <> 'archived'
      or archived_at is not null
    )
);

create index campground_map_objects_kind_idx
  on icamp_private.campground_map_objects (
    campground_id,
    object_kind,
    display_name
  )
  where lifecycle_state <> 'archived';

create index campground_map_objects_section_idx
  on icamp_private.campground_map_objects (
    organization_id,
    campground_id,
    section_id
  )
  where section_id is not null;

create index campground_map_objects_created_by_idx
  on icamp_private.campground_map_objects (created_by_user_id)
  where created_by_user_id is not null;

create index campground_map_objects_updated_by_idx
  on icamp_private.campground_map_objects (updated_by_user_id)
  where updated_by_user_id is not null;

create trigger campground_map_objects_touch_row
before update on icamp_private.campground_map_objects
for each row execute function icamp_private.touch_row();

create table icamp_private.campground_map_object_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  map_object_id uuid not null,
  map_image_version_id uuid not null,
  layer_id uuid not null,
  geometry_kind text not null
    check (geometry_kind in ('polygon', 'point')),
  polygon_id uuid,
  point_geometry jsonb,
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
  constraint campground_map_object_bindings_scope_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_map_object_bindings_object_fk
    foreign key (organization_id, campground_id, map_object_id)
    references icamp_private.campground_map_objects(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint campground_map_object_bindings_image_fk
    foreign key (organization_id, campground_id, map_image_version_id)
    references icamp_private.campground_map_image_versions(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint campground_map_object_bindings_layer_fk
    foreign key (organization_id, campground_id, layer_id)
    references icamp_private.campground_map_layers(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint campground_map_object_bindings_polygon_fk
    foreign key (organization_id, campground_id, polygon_id)
    references icamp_private.campground_map_polygons(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint campground_map_object_bindings_object_unique
    unique (map_object_id),
  constraint campground_map_object_bindings_polygon_unique
    unique (polygon_id),
  constraint campground_map_object_bindings_geometry_check
    check (
      (
        geometry_kind = 'polygon'
        and polygon_id is not null
        and point_geometry is null
      )
      or
      (
        geometry_kind = 'point'
        and polygon_id is null
        and point_geometry is not null
      )
    ),
  constraint campground_map_object_bindings_point_geometry_check
    check (
      point_geometry is null
      or (
        jsonb_typeof(point_geometry) = 'object'
        and point_geometry ->> 'schemaVersion' = '1'
        and jsonb_typeof(point_geometry -> 'image') = 'object'
        and jsonb_typeof(point_geometry -> 'normalized') = 'object'
        and jsonb_typeof(point_geometry -> 'image' -> 'x') = 'number'
        and jsonb_typeof(point_geometry -> 'image' -> 'y') = 'number'
        and jsonb_typeof(point_geometry -> 'normalized' -> 'x') = 'number'
        and jsonb_typeof(point_geometry -> 'normalized' -> 'y') = 'number'
        and (point_geometry -> 'normalized' ->> 'x')::numeric between 0 and 1
        and (point_geometry -> 'normalized' ->> 'y')::numeric between 0 and 1
      )
    )
);

create or replace function icamp_private.canonicalize_map_object_binding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  polygon_row record;
begin
  if new.geometry_kind = 'polygon' then
    select
      p.organization_id,
      p.campground_id,
      p.map_image_version_id,
      p.layer_id
    into polygon_row
    from icamp_private.campground_map_polygons p
    where p.id = new.polygon_id;

    if not found then
      raise exception 'Bound polygon does not exist';
    end if;

    if polygon_row.organization_id <> new.organization_id
      or polygon_row.campground_id <> new.campground_id then
      raise exception 'Bound polygon is outside the map object campground';
    end if;

    new.map_image_version_id := polygon_row.map_image_version_id;
    new.layer_id := polygon_row.layer_id;
    new.point_geometry := null;
  end if;

  return new;
end;
$$;

create trigger campground_map_object_bindings_canonicalize
before insert or update on icamp_private.campground_map_object_bindings
for each row execute function icamp_private.canonicalize_map_object_binding();

create trigger campground_map_object_bindings_touch_row
before update on icamp_private.campground_map_object_bindings
for each row execute function icamp_private.touch_row();

create index campground_map_object_bindings_image_layer_idx
  on icamp_private.campground_map_object_bindings (
    map_image_version_id,
    layer_id,
    geometry_kind
  );

create index campground_map_object_bindings_scope_idx
  on icamp_private.campground_map_object_bindings (
    organization_id,
    campground_id,
    updated_at desc
  );

create index campground_map_object_bindings_created_by_idx
  on icamp_private.campground_map_object_bindings (created_by_user_id)
  where created_by_user_id is not null;

create index campground_map_object_bindings_updated_by_idx
  on icamp_private.campground_map_object_bindings (updated_by_user_id)
  where updated_by_user_id is not null;

revoke all on icamp_private.campground_map_objects from public;
revoke all on icamp_private.campground_map_object_bindings from public;

do $build023_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.campground_map_objects from anon';
    execute 'revoke all on icamp_private.campground_map_object_bindings from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.campground_map_objects from authenticated';
    execute 'revoke all on icamp_private.campground_map_object_bindings from authenticated';
  end if;
end
$build023_permissions$;

comment on table icamp_private.campground_map_objects is
  'Canonical map identity anchors for sites, cottages and operational/facility objects. Builds 024-030 attach richer domain records without replacing these identities.';
comment on table icamp_private.campground_map_object_bindings is
  'Exactly one current polygon or point binding per canonical map object. Foreign keys and uniqueness prevent orphan and duplicate bindings.';
comment on column icamp_private.campground_map_object_bindings.point_geometry is
  'Build 019 canonical stored point: source-image pixels plus normalized 0-1 coordinates.';
