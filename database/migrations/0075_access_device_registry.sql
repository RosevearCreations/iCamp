-- iCamp Build 057
-- Gate, Barrier & Access Device Registry.
--
-- Provider-neutral physical access-device configuration. This build records
-- identity, topology, provider/hardware mapping, declared capabilities and the
-- latest administrative health snapshot. Build 058 owns access/device events,
-- Build 059 owns manual control commands, and Build 060 owns enforceable zones
-- and schedules.

create table public.access_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  device_code text not null
    check (device_code ~ '^AD-[A-Z0-9]{4,32}$'),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 160),
  device_type text not null
    check (device_type in (
      'gate','door','barrier','controller','reader','keypad','intercom','other'
    )),
  integration_mode text not null default 'local'
    check (integration_mode in ('local','provider','hybrid')),
  location_label text
    check (
      location_label is null
      or char_length(trim(location_label)) between 1 and 240
    ),
  zone_reference text
    check (
      zone_reference is null
      or char_length(trim(zone_reference)) between 1 and 80
    ),
  parent_controller_id uuid,
  provider_code text
    check (
      provider_code is null
      or provider_code ~ '^[a-z][a-z0-9_-]{1,63}$'
    ),
  provider_device_reference text
    check (
      provider_device_reference is null
      or char_length(trim(provider_device_reference)) between 1 and 240
    ),
  manufacturer text
    check (
      manufacturer is null
      or char_length(trim(manufacturer)) between 1 and 120
    ),
  model text
    check (
      model is null
      or char_length(trim(model)) between 1 and 120
    ),
  serial_number text
    check (
      serial_number is null
      or char_length(trim(serial_number)) between 1 and 160
    ),
  capabilities text[] not null default '{}'::text[]
    check (
      capabilities <@ array[
        'credential_read','state_report','remote_open','remote_close',
        'intercom','vehicle_loop','entry_direction','exit_direction'
      ]::text[]
    ),
  health_state text not null default 'unknown'
    check (health_state in (
      'unknown','healthy','degraded','offline','maintenance','retired'
    )),
  health_observed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint access_devices_scope_code_unique
    unique (organization_id,campground_id,device_code),
  constraint access_devices_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint access_devices_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict,
  constraint access_devices_parent_controller_fk
    foreign key (organization_id,campground_id,parent_controller_id)
    references public.access_devices(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_devices_provider_pair_check
    check (
      (provider_code is null and provider_device_reference is null)
      or
      (provider_code is not null and provider_device_reference is not null)
    ),
  constraint access_devices_integration_provider_check
    check (
      integration_mode='local'
      or (provider_code is not null and provider_device_reference is not null)
    ),
  constraint access_devices_health_observed_check
    check (
      health_state='unknown'
      or health_observed_at is not null
    )
);

create unique index access_devices_provider_reference_unique
  on public.access_devices(campground_id,provider_code,provider_device_reference)
  where provider_code is not null and provider_device_reference is not null;

create unique index access_devices_serial_unique
  on public.access_devices(campground_id,serial_number)
  where serial_number is not null;

create index access_devices_parent_controller_idx
  on public.access_devices(organization_id,campground_id,parent_controller_id)
  where parent_controller_id is not null;

create index access_devices_type_active_idx
  on public.access_devices(campground_id,device_type,is_active);

create index access_devices_health_idx
  on public.access_devices(campground_id,health_state,health_observed_at desc);

create or replace function icamp_private.validate_access_device()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_type text;
begin
  if new.parent_controller_id is not null then
    if new.parent_controller_id = new.id then
      raise exception 'An access device cannot be its own controller';
    end if;

    select d.device_type into parent_type
    from public.access_devices d
    where d.organization_id=new.organization_id
      and d.campground_id=new.campground_id
      and d.id=new.parent_controller_id;

    if parent_type is distinct from 'controller' then
      raise exception 'Parent access device must be a controller in the same campground';
    end if;
  end if;

  if tg_op='UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id
      or old.device_code is distinct from new.device_code
      or old.created_at is distinct from new.created_at then
      raise exception 'Access device scope and identity are immutable';
    end if;
  end if;

  return new;
end;
$$;

create trigger access_devices_validate
before insert or update on public.access_devices
for each row execute function icamp_private.validate_access_device();

create trigger access_devices_touch
before update on public.access_devices
for each row execute function icamp_private.touch_row();

alter table public.access_devices enable row level security;
alter table public.access_devices force row level security;

revoke all on public.access_devices from public;
grant select,insert,update on public.access_devices to icamp_app;

do $revoke_data_api$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.access_devices from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.access_devices from authenticated';
  end if;
end
$revoke_data_api$;

create policy access_devices_read on public.access_devices
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'gate.state.read')
  or icamp_private.has_campground_permission(campground_id,'campground.configuration')
);

create policy access_devices_create on public.access_devices
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
);

create policy access_devices_manage on public.access_devices
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
)
with check (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
);

comment on table public.access_devices is
  'Build 057 provider-neutral gate/door/barrier/controller registry. Stores no provider secrets. Build 058 owns access/device events, Build 059 commands, and Build 060 enforceable zones/schedules.';

comment on column public.access_devices.zone_reference is
  'Administrative location/zone label only; not an authorization rule. Build 060 owns enforceable access zones and schedules.';

comment on column public.access_devices.health_state is
  'Latest administrative/provider health snapshot only. Build 058 owns the append-only device-event ledger.';
