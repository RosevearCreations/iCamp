-- iCamp Build 058
-- Access Event & Device Event Ledger.
--
-- Append-only device observations and access-attempt evidence. Build 058 does
-- not issue commands, enforce access rules, or store raw credential secrets.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values (
  'access.events.record',
  'Record access and device monitoring events',
  'elevated'
)
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,'access.events.record'
from icamp_private.roles r
where r.role_kind='template'
  and r.role_code in ('security','campground_manager','owner_admin')
on conflict do nothing;

create table public.access_device_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  device_id uuid not null,
  event_kind text not null
    check (event_kind in (
      'state_observed',
      'health_observed',
      'fault',
      'recovered',
      'heartbeat'
    )),
  gate_state text
    check (
      gate_state is null
      or gate_state in ('open','closed','unknown')
    ),
  health_state text
    check (
      health_state is null
      or health_state in (
        'unknown','healthy','degraded','offline','maintenance','retired'
      )
    ),
  provider_event_reference text
    check (
      provider_event_reference is null
      or char_length(trim(provider_event_reference)) between 1 and 240
    ),
  occurred_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  source_kind text not null default 'provider'
    check (source_kind in ('provider','system','staff')),
  actor_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  event_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_metadata)='object'),
  constraint access_device_events_scope_device_fk
    foreign key (organization_id,campground_id,device_id)
    references public.access_devices(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_device_events_state_shape_check
    check (
      (event_kind='state_observed' and gate_state is not null)
      or
      (event_kind<>'state_observed')
    ),
  constraint access_device_events_health_shape_check
    check (
      (event_kind='health_observed' and health_state is not null)
      or
      (event_kind<>'health_observed')
    ),
  constraint access_device_events_actor_shape_check
    check (
      (source_kind='staff' and actor_user_id is not null)
      or source_kind<>'staff'
    )
);

create unique index access_device_events_provider_reference_unique
  on public.access_device_events(campground_id,provider_event_reference)
  where provider_event_reference is not null;

create index access_device_events_scope_device_fk_idx
  on public.access_device_events(
    organization_id,campground_id,device_id
  );

create index access_device_events_device_time_idx
  on public.access_device_events(campground_id,device_id,occurred_at desc);

create index access_device_events_state_time_idx
  on public.access_device_events(campground_id,gate_state,occurred_at desc)
  where gate_state is not null;

create index access_device_events_actor_idx
  on public.access_device_events(actor_user_id)
  where actor_user_id is not null;

create table public.access_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  device_id uuid not null,
  credential_id uuid,
  guest_profile_id uuid,
  visitor_registration_id uuid,
  road_vehicle_registration_id uuid,
  staff_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  outcome text not null
    check (outcome in ('granted','denied','error','unknown')),
  denied_reason text
    check (
      denied_reason is null
      or char_length(trim(denied_reason)) between 1 and 500
    ),
  direction text not null default 'unknown'
    check (direction in ('entry','exit','unknown')),
  source_kind text not null default 'provider'
    check (source_kind in ('provider','system','staff')),
  provider_event_reference text
    check (
      provider_event_reference is null
      or char_length(trim(provider_event_reference)) between 1 and 240
    ),
  occurred_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  recorded_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  event_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_metadata)='object'),
  constraint access_events_scope_device_fk
    foreign key (organization_id,campground_id,device_id)
    references public.access_devices(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_events_scope_credential_fk
    foreign key (organization_id,campground_id,credential_id)
    references public.access_credentials(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_events_scope_guest_profile_fk
    foreign key (organization_id,campground_id,guest_profile_id)
    references public.guest_profiles(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_events_scope_visitor_fk
    foreign key (organization_id,campground_id,visitor_registration_id)
    references public.visitor_registrations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_events_scope_vehicle_fk
    foreign key (organization_id,campground_id,road_vehicle_registration_id)
    references public.road_vehicle_registrations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_events_denied_reason_check
    check (
      (outcome='denied' and denied_reason is not null)
      or
      (outcome<>'denied' and denied_reason is null)
    ),
  constraint access_events_staff_source_check
    check (
      (source_kind='staff' and recorded_by_user_id is not null)
      or source_kind<>'staff'
    )
);

create unique index access_events_provider_reference_unique
  on public.access_events(campground_id,provider_event_reference)
  where provider_event_reference is not null;

create index access_events_scope_device_fk_idx
  on public.access_events(organization_id,campground_id,device_id);

create index access_events_scope_credential_fk_idx
  on public.access_events(organization_id,campground_id,credential_id)
  where credential_id is not null;

create index access_events_scope_guest_profile_fk_idx
  on public.access_events(organization_id,campground_id,guest_profile_id)
  where guest_profile_id is not null;

create index access_events_scope_visitor_fk_idx
  on public.access_events(organization_id,campground_id,visitor_registration_id)
  where visitor_registration_id is not null;

create index access_events_scope_vehicle_fk_idx
  on public.access_events(
    organization_id,campground_id,road_vehicle_registration_id
  )
  where road_vehicle_registration_id is not null;

create index access_events_staff_user_idx
  on public.access_events(staff_user_id)
  where staff_user_id is not null;

create index access_events_recorded_by_idx
  on public.access_events(recorded_by_user_id)
  where recorded_by_user_id is not null;

create index access_events_outcome_time_idx
  on public.access_events(campground_id,outcome,occurred_at desc);

alter table public.access_device_events enable row level security;
alter table public.access_device_events force row level security;
alter table public.access_events enable row level security;
alter table public.access_events force row level security;

revoke all on public.access_device_events from public;
revoke all on public.access_events from public;

grant select,insert on public.access_device_events to icamp_app;
grant select,insert on public.access_events to icamp_app;

do $revoke_data_api$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.access_device_events from anon';
    execute 'revoke all on public.access_events from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.access_device_events from authenticated';
    execute 'revoke all on public.access_events from authenticated';
  end if;
end
$revoke_data_api$;

create policy access_device_events_read on public.access_device_events
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'gate.state.read')
  or icamp_private.has_campground_permission(campground_id,'access.events.read')
);

create policy access_device_events_append on public.access_device_events
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.events.record')
);

create policy access_events_read on public.access_events
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.events.read')
);

create policy access_events_append on public.access_events
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.events.record')
);

comment on table public.access_device_events is
  'Build 058 append-only device observation ledger. Open/closed/unknown observations are evidence only; Build 059 owns manual commands.';

comment on table public.access_events is
  'Build 058 append-only access-attempt ledger with credential/person/vehicle associations and denied-access reasons. Build 060 owns enforceable access rules.';
