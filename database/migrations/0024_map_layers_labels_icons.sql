-- iCamp Build 022
-- Map layers, labels, icons, permission-gated visibility and layer ordering.

create table icamp_private.campground_map_layers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  layer_key text not null
    check (
      layer_key in (
        'booking',
        'maintenance',
        'security',
        'utilities',
        'amenities',
        'management'
      )
    ),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 80),
  icon_key text not null
    check (
      icon_key in (
        'calendar',
        'tools',
        'shield',
        'bolt',
        'star',
        'layers'
      )
    ),
  sort_order integer not null check (sort_order between 0 and 9999),
  visibility_permission_key text not null
    references icamp_private.permission_catalog(permission_key)
    on update cascade
    on delete restrict,
  is_enabled boolean not null default true,
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
  constraint campground_map_layers_scope_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_map_layers_key_unique
    unique (campground_id, layer_key),
  constraint campground_map_layers_scope_id_unique
    unique (organization_id, campground_id, id)
);

create index campground_map_layers_order_idx
  on icamp_private.campground_map_layers (
    campground_id,
    sort_order,
    display_name
  );

create index campground_map_layers_visibility_permission_idx
  on icamp_private.campground_map_layers (visibility_permission_key);

create index campground_map_layers_created_by_idx
  on icamp_private.campground_map_layers (created_by_user_id)
  where created_by_user_id is not null;

create index campground_map_layers_updated_by_idx
  on icamp_private.campground_map_layers (updated_by_user_id)
  where updated_by_user_id is not null;

create trigger campground_map_layers_touch_row
before update on icamp_private.campground_map_layers
for each row execute function icamp_private.touch_row();

insert into icamp_private.campground_map_layers (
  organization_id,
  campground_id,
  layer_key,
  display_name,
  icon_key,
  sort_order,
  visibility_permission_key
)
select
  c.organization_id,
  c.id,
  defaults.layer_key,
  defaults.display_name,
  defaults.icon_key,
  defaults.sort_order,
  defaults.visibility_permission_key
from public.campgrounds c
cross join (
  values
    ('booking', 'Booking', 'calendar', 10, 'reservation.read'),
    ('maintenance', 'Maintenance', 'tools', 20, 'maintenance.read'),
    ('security', 'Security', 'shield', 30, 'access.events.read'),
    ('utilities', 'Utilities', 'bolt', 40, 'campground.map'),
    ('amenities', 'Amenities', 'star', 50, 'accommodation.read'),
    ('management', 'Management', 'layers', 60, 'campground.configuration')
) as defaults(
  layer_key,
  display_name,
  icon_key,
  sort_order,
  visibility_permission_key
)
on conflict (campground_id, layer_key) do nothing;

alter table icamp_private.campground_map_polygons
  add column layer_id uuid,
  add column map_label text,
  add column map_icon_key text,
  add column map_label_visible boolean not null default true;

update icamp_private.campground_map_polygons p
set layer_id = l.id,
    map_label = p.label
from icamp_private.campground_map_layers l
where l.organization_id = p.organization_id
  and l.campground_id = p.campground_id
  and l.layer_key = 'management'
  and p.layer_id is null;

alter table icamp_private.campground_map_polygons
  alter column layer_id set not null,
  alter column map_label set not null,
  add constraint campground_map_polygons_layer_scope_fk
    foreign key (organization_id, campground_id, layer_id)
    references icamp_private.campground_map_layers(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  add constraint campground_map_polygons_map_label_check
    check (char_length(trim(map_label)) between 1 and 160),
  add constraint campground_map_polygons_map_icon_key_check
    check (
      map_icon_key is null
      or map_icon_key in (
        'pin',
        'tent',
        'cottage',
        'gate',
        'water',
        'washroom',
        'field',
        'building',
        'dock',
        'road',
        'warning',
        'info',
        'tree'
      )
    );

create index campground_map_polygons_layer_idx
  on icamp_private.campground_map_polygons (
    layer_id,
    map_image_version_id,
    updated_at desc
  )
  where archived_at is null;

revoke all on icamp_private.campground_map_layers from public;

do $build022_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.campground_map_layers from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.campground_map_layers from authenticated';
  end if;
end
$build022_permissions$;

comment on table icamp_private.campground_map_layers is
  'Campground map layer configuration. Build 023 binds canonical campground objects to layer-aware geometry.';
comment on column icamp_private.campground_map_layers.visibility_permission_key is
  'Canonical campground permission required before the server returns this layer or its polygons.';
comment on column icamp_private.campground_map_polygons.map_label is
  'Map-facing label rendered independently from the administrative polygon label.';
comment on column icamp_private.campground_map_polygons.map_icon_key is
  'Optional polygon-specific icon override; null inherits the layer icon.';
