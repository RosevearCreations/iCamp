-- iCamp Build 029
-- Operational Asset & Equipment/Fleet Model.

insert into icamp_private.permission_catalog (permission_key, description, risk_level)
values
  ('asset.read', 'Asset Read', 'standard'),
  ('asset.manage', 'Asset Manage', 'elevated'),
  ('equipment.read', 'Equipment Read', 'standard'),
  ('equipment.manage', 'Equipment Manage', 'elevated')
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, grants.permission_key
from (
  values
    ('maintenance', 'asset.read'),
    ('maintenance', 'equipment.read'),
    ('maintenance_lead', 'asset.read'),
    ('maintenance_lead', 'asset.manage'),
    ('maintenance_lead', 'equipment.read'),
    ('maintenance_lead', 'equipment.manage'),
    ('campground_manager', 'asset.read'),
    ('campground_manager', 'asset.manage'),
    ('campground_manager', 'equipment.read'),
    ('campground_manager', 'equipment.manage'),
    ('owner_admin', 'asset.read'),
    ('owner_admin', 'asset.manage'),
    ('owner_admin', 'equipment.read'),
    ('owner_admin', 'equipment.manage')
) as grants(role_code, permission_key)
join icamp_private.roles r
  on r.role_code = grants.role_code
 and r.organization_id is null
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict (role_id, permission_key) do nothing;

create table public.operational_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on update cascade on delete restrict,
  campground_id uuid not null,
  section_id uuid,
  map_object_id uuid,
  asset_class text not null check (asset_class in ('facility', 'equipment')),
  code text not null check (code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active', 'inactive', 'archived')),
  operating_state text not null default 'unknown'
    check (operating_state in ('unknown', 'operational', 'limited', 'unavailable', 'seasonal')),
  status_revision bigint not null default 1 check (status_revision >= 1),
  notes text check (notes is null or char_length(notes) <= 2000),
  archived_at timestamptz,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint operational_assets_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id) on update cascade on delete restrict,
  constraint operational_assets_section_fk
    foreign key (organization_id, campground_id, section_id)
    references public.campground_sections(organization_id, campground_id, id) on update cascade on delete restrict,
  constraint operational_assets_map_object_fk
    foreign key (organization_id, campground_id, map_object_id)
    references icamp_private.campground_map_objects(organization_id, campground_id, id) on update cascade on delete restrict,
  constraint operational_assets_scope_id_unique unique (organization_id, campground_id, id),
  constraint operational_assets_scope_code_unique unique (campground_id, code),
  constraint operational_assets_facility_map_check check (asset_class <> 'facility' or map_object_id is not null),
  constraint operational_assets_archive_state_check check (lifecycle_state <> 'archived' or archived_at is not null)
);

create unique index operational_assets_map_object_unique
  on public.operational_assets (map_object_id)
  where map_object_id is not null;

create table public.operational_facilities (
  asset_id uuid primary key,
  organization_id uuid not null,
  campground_id uuid not null,
  facility_type text not null
    check (facility_type in (
      'pool', 'water_park', 'washroom', 'sports_field', 'playground',
      'hall', 'beach', 'dock', 'launch', 'road', 'parking', 'gate',
      'building', 'garbage_area', 'septic_area', 'utility', 'other'
    )),
  guest_visibility text not null default 'internal'
    check (guest_visibility in ('internal', 'public_candidate')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint operational_facilities_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade on delete restrict
);

create table public.operational_equipment (
  asset_id uuid primary key,
  organization_id uuid not null,
  campground_id uuid not null,
  equipment_type text not null
    check (equipment_type in (
      'tractor', 'mower', 'maintenance_vehicle', 'cart', 'trailer',
      'power_equipment', 'watercraft', 'other'
    )),
  make text check (make is null or char_length(trim(make)) between 1 and 120),
  model text check (model is null or char_length(trim(model)) between 1 and 120),
  serial_number text check (serial_number is null or char_length(trim(serial_number)) between 1 and 160),
  ownership_type text not null default 'owned'
    check (ownership_type in ('owned', 'leased', 'rented', 'loaned', 'contractor', 'other')),
  meter_kind text not null default 'none'
    check (meter_kind in ('none', 'hours', 'odometer_km', 'cycles')),
  meter_value numeric(14, 2) check (meter_value is null or meter_value >= 0),
  storage_location text
    check (storage_location is null or char_length(trim(storage_location)) between 1 and 240),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint operational_equipment_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint operational_equipment_meter_check
    check ((meter_kind = 'none' and meter_value is null) or (meter_kind <> 'none' and meter_value is not null))
);

create unique index operational_equipment_serial_unique
  on public.operational_equipment (campground_id, lower(serial_number))
  where serial_number is not null;

create index operational_assets_scope_class_idx
  on public.operational_assets (organization_id, campground_id, asset_class, display_name)
  where lifecycle_state <> 'archived';
create index operational_assets_section_idx
  on public.operational_assets (organization_id, campground_id, section_id)
  where section_id is not null;
create index operational_assets_created_by_idx
  on public.operational_assets (created_by_user_id) where created_by_user_id is not null;
create index operational_assets_updated_by_idx
  on public.operational_assets (updated_by_user_id) where updated_by_user_id is not null;
create index operational_facilities_scope_idx
  on public.operational_facilities (organization_id, campground_id, facility_type);
create index operational_equipment_scope_idx
  on public.operational_equipment (organization_id, campground_id, equipment_type);

create or replace function icamp_private.advance_operational_asset_status_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.operating_state is distinct from new.operating_state then
    new.status_revision := old.status_revision + 1;
  end if;
  return new;
end;
$$;

create trigger operational_assets_status_revision
before update of operating_state on public.operational_assets
for each row execute function icamp_private.advance_operational_asset_status_revision();

create trigger operational_assets_touch_row
before update on public.operational_assets
for each row execute function icamp_private.touch_row();
create trigger operational_facilities_touch_row
before update on public.operational_facilities
for each row execute function icamp_private.touch_row();
create trigger operational_equipment_touch_row
before update on public.operational_equipment
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.validate_operational_asset_shape()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_id uuid;
  target_class text;
  target_map_object_id uuid;
  target_section_id uuid;
  target_campground_id uuid;
  facility_count integer;
  equipment_count integer;
  facility_kind text;
  map_kind text;
  map_section_id uuid;
begin
  if tg_table_name = 'operational_assets' then
    target_id := new.id;
  elsif tg_op = 'DELETE' then
    target_id := old.asset_id;
  else
    target_id := new.asset_id;
  end if;

  select asset_class, map_object_id, section_id, campground_id
  into target_class, target_map_object_id, target_section_id, target_campground_id
  from public.operational_assets
  where id = target_id;

  if target_class is null then
    return null;
  end if;

  select count(*) into facility_count from public.operational_facilities where asset_id = target_id;
  select count(*) into equipment_count from public.operational_equipment where asset_id = target_id;

  if facility_count + equipment_count <> 1 then
    raise exception 'Operational asset must have exactly one matching subtype';
  end if;
  if (target_class = 'facility' and facility_count <> 1)
    or (target_class = 'equipment' and equipment_count <> 1) then
    raise exception 'Operational asset subtype does not match asset class';
  end if;

  if target_map_object_id is not null then
    select object_kind, section_id
    into map_kind, map_section_id
    from icamp_private.campground_map_objects
    where id = target_map_object_id
      and campground_id = target_campground_id
      and lifecycle_state <> 'archived';
    if not found then
      raise exception 'Operational asset map object is unavailable';
    end if;
    if target_section_id is not null and map_section_id is distinct from target_section_id then
      raise exception 'Operational asset section must match its map object';
    end if;
  end if;

  if target_class = 'equipment' then
    if target_map_object_id is not null and map_kind <> 'asset' then
      raise exception 'Mapped equipment must use an asset map object';
    end if;
    return null;
  end if;

  select facility_type into facility_kind
  from public.operational_facilities
  where asset_id = target_id;

  if facility_kind = 'pool' and map_kind <> 'pool' then
    raise exception 'Pool facilities must use a pool map object';
  elsif facility_kind = 'washroom' and map_kind <> 'washroom' then
    raise exception 'Washroom facilities must use a washroom map object';
  elsif facility_kind = 'dock' and map_kind <> 'dock' then
    raise exception 'Dock facilities must use a dock map object';
  elsif facility_kind = 'road' and map_kind <> 'road' then
    raise exception 'Road facilities must use a road map object';
  elsif facility_kind = 'gate' and map_kind <> 'gate' then
    raise exception 'Gate facilities must use a gate map object';
  elsif facility_kind in ('hall', 'building') and map_kind <> 'building' then
    raise exception 'Hall/building facilities must use a building map object';
  elsif facility_kind = 'launch' and map_kind not in ('asset', 'dock') then
    raise exception 'Launch facilities must use an asset or dock map object';
  elsif facility_kind = 'parking' and map_kind not in ('asset', 'road') then
    raise exception 'Parking facilities must use an asset or road map object';
  elsif facility_kind not in ('pool', 'washroom', 'dock', 'road', 'gate', 'hall', 'building', 'launch', 'parking')
    and map_kind <> 'asset' then
    raise exception 'This facility type must use an asset map object';
  end if;

  return null;
end;
$$;

create constraint trigger operational_assets_require_subtype
after insert or update on public.operational_assets
deferrable initially deferred
for each row execute function icamp_private.validate_operational_asset_shape();
create constraint trigger operational_facilities_validate_shape
after insert or update or delete on public.operational_facilities
deferrable initially deferred
for each row execute function icamp_private.validate_operational_asset_shape();
create constraint trigger operational_equipment_validate_shape
after insert or update or delete on public.operational_equipment
deferrable initially deferred
for each row execute function icamp_private.validate_operational_asset_shape();

alter table public.operational_assets enable row level security;
alter table public.operational_facilities enable row level security;
alter table public.operational_equipment enable row level security;
alter table public.operational_assets force row level security;
alter table public.operational_facilities force row level security;
alter table public.operational_equipment force row level security;

revoke all on public.operational_assets from public;
revoke all on public.operational_facilities from public;
revoke all on public.operational_equipment from public;

do $build029_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.operational_assets from anon';
    execute 'revoke all on public.operational_facilities from anon';
    execute 'revoke all on public.operational_equipment from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.operational_assets from authenticated';
    execute 'revoke all on public.operational_facilities from authenticated';
    execute 'revoke all on public.operational_equipment from authenticated';
  end if;
end
$build029_permissions$;

grant select, insert, update on public.operational_assets to icamp_app;
grant select, insert, update on public.operational_facilities to icamp_app;
grant select, insert, update on public.operational_equipment to icamp_app;

create policy operational_assets_read on public.operational_assets for select to icamp_app
using (
  (asset_class = 'facility' and (
    icamp_private.has_campground_permission(campground_id, 'asset.read')
    or icamp_private.has_campground_permission(campground_id, 'asset.manage')
  ))
  or
  (asset_class = 'equipment' and (
    icamp_private.has_campground_permission(campground_id, 'equipment.read')
    or icamp_private.has_campground_permission(campground_id, 'equipment.manage')
  ))
);

create policy operational_assets_manage_insert on public.operational_assets for insert to icamp_app
with check (
  (asset_class = 'facility' and icamp_private.has_campground_permission(campground_id, 'asset.manage'))
  or
  (asset_class = 'equipment' and icamp_private.has_campground_permission(campground_id, 'equipment.manage'))
);

create policy operational_assets_manage_update on public.operational_assets for update to icamp_app
using (
  (asset_class = 'facility' and icamp_private.has_campground_permission(campground_id, 'asset.manage'))
  or
  (asset_class = 'equipment' and icamp_private.has_campground_permission(campground_id, 'equipment.manage'))
)
with check (
  (asset_class = 'facility' and icamp_private.has_campground_permission(campground_id, 'asset.manage'))
  or
  (asset_class = 'equipment' and icamp_private.has_campground_permission(campground_id, 'equipment.manage'))
);

create policy operational_facilities_read on public.operational_facilities for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'asset.read')
  or icamp_private.has_campground_permission(campground_id, 'asset.manage')
);
create policy operational_facilities_manage_insert on public.operational_facilities for insert to icamp_app
with check (icamp_private.has_campground_permission(campground_id, 'asset.manage'));
create policy operational_facilities_manage_update on public.operational_facilities for update to icamp_app
using (icamp_private.has_campground_permission(campground_id, 'asset.manage'))
with check (icamp_private.has_campground_permission(campground_id, 'asset.manage'));

create policy operational_equipment_read on public.operational_equipment for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'equipment.read')
  or icamp_private.has_campground_permission(campground_id, 'equipment.manage')
);
create policy operational_equipment_manage_insert on public.operational_equipment for insert to icamp_app
with check (icamp_private.has_campground_permission(campground_id, 'equipment.manage'));
create policy operational_equipment_manage_update on public.operational_equipment for update to icamp_app
using (icamp_private.has_campground_permission(campground_id, 'equipment.manage'))
with check (icamp_private.has_campground_permission(campground_id, 'equipment.manage'));

comment on table public.operational_assets is
  'Build 029 canonical facility/equipment inventory. operating_state and status_revision are hooks; Build 030 owns authoritative status history and transition rules.';
comment on table public.operational_facilities is
  'Operational campground facilities and infrastructure such as pools, washrooms, fields, halls, docks, roads, garbage/septic areas and utilities.';
comment on table public.operational_equipment is
  'Campground equipment/fleet detail including type, make/model/serial, ownership and current usage meter snapshot.';
comment on column public.operational_facilities.guest_visibility is
  'Publication-readiness hint only. Internal records stay non-public until later guest/public experience builds deliberately publish them.';
