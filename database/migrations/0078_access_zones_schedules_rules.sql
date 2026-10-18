-- iCamp Build 060
-- Access Zones, Schedules & Rules.
--
-- Provider-neutral, deterministic authorization policy for guest, visitor,
-- staff, contractor, camper and event access. Build 061 owns pass/wristband/QR
-- presentation; Build 060 owns the enforceable zone/time/subject decision.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values (
  'access.rules.manage',
  'Manage access zones, schedules and authorization rules',
  'elevated'
)
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,'access.rules.manage'
from icamp_private.roles r
where r.role_kind='template'
  and r.role_code in ('security','campground_manager','owner_admin')
on conflict do nothing;

create table public.access_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  zone_code text not null
    check (zone_code ~ '^AZ-[A-Z0-9]{3,32}$'),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 160),
  zone_kind text not null default 'general'
    check (zone_kind in (
      'general','camper_only','event','staff','service','restricted'
    )),
  description text not null default ''
    check (char_length(description) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint access_zones_scope_code_unique
    unique (organization_id,campground_id,zone_code),
  constraint access_zones_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint access_zones_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict
);

create index access_zones_scope_campground_fk_idx
  on public.access_zones(organization_id,campground_id);

create index access_zones_kind_active_idx
  on public.access_zones(campground_id,zone_kind,is_active);

create table public.access_zone_devices (
  organization_id uuid not null,
  campground_id uuid not null,
  zone_id uuid not null,
  device_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (zone_id,device_id),
  constraint access_zone_devices_scope_zone_fk
    foreign key (organization_id,campground_id,zone_id)
    references public.access_zones(organization_id,campground_id,id)
    on update cascade
    on delete cascade,
  constraint access_zone_devices_scope_device_fk
    foreign key (organization_id,campground_id,device_id)
    references public.access_devices(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create index access_zone_devices_zone_fk_idx
  on public.access_zone_devices(organization_id,campground_id,zone_id);

create index access_zone_devices_device_fk_idx
  on public.access_zone_devices(organization_id,campground_id,device_id);

create table public.access_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  schedule_code text not null
    check (schedule_code ~ '^AS-[A-Z0-9]{3,32}$'),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 160),
  weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[]
    check (
      cardinality(weekdays) between 1 and 7
      and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
    ),
  start_local time not null default time '00:00',
  end_local time not null default time '23:59:59',
  valid_from date,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint access_schedules_scope_code_unique
    unique (organization_id,campground_id,schedule_code),
  constraint access_schedules_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint access_schedules_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict,
  constraint access_schedules_date_window_check
    check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create index access_schedules_scope_campground_fk_idx
  on public.access_schedules(organization_id,campground_id);

create index access_schedules_active_idx
  on public.access_schedules(campground_id,is_active,valid_from,valid_until);

create table public.access_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  zone_id uuid not null,
  schedule_id uuid,
  rule_code text not null
    check (rule_code ~ '^AR-[A-Z0-9]{3,32}$'),
  priority integer not null default 100
    check (priority between 0 and 100000),
  effect text not null
    check (effect in ('allow','deny')),
  subject_kind text not null
    check (subject_kind in (
      'any','guest','visitor','staff','contractor','camper','event'
    )),
  event_reference text
    check (
      event_reference is null
      or char_length(trim(event_reference)) between 1 and 160
    ),
  require_active_stay boolean not null default false,
  decision_reason text not null
    check (char_length(trim(decision_reason)) between 3 and 240),
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint access_rules_scope_code_unique
    unique (organization_id,campground_id,rule_code),
  constraint access_rules_scope_zone_fk
    foreign key (organization_id,campground_id,zone_id)
    references public.access_zones(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_rules_scope_schedule_fk
    foreign key (organization_id,campground_id,schedule_id)
    references public.access_schedules(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create index access_rules_zone_fk_idx
  on public.access_rules(organization_id,campground_id,zone_id);

create index access_rules_schedule_fk_idx
  on public.access_rules(organization_id,campground_id,schedule_id)
  where schedule_id is not null;

create index access_rules_evaluation_idx
  on public.access_rules(
    campground_id,zone_id,is_active,priority desc,effect,subject_kind
  );

create trigger access_zones_touch
before update on public.access_zones
for each row execute function icamp_private.touch_row();

create trigger access_schedules_touch
before update on public.access_schedules
for each row execute function icamp_private.touch_row();

create trigger access_rules_touch
before update on public.access_rules
for each row execute function icamp_private.touch_row();

alter table public.access_zones enable row level security;
alter table public.access_zones force row level security;
alter table public.access_zone_devices enable row level security;
alter table public.access_zone_devices force row level security;
alter table public.access_schedules enable row level security;
alter table public.access_schedules force row level security;
alter table public.access_rules enable row level security;
alter table public.access_rules force row level security;

revoke all on public.access_zones from public;
revoke all on public.access_zone_devices from public;
revoke all on public.access_schedules from public;
revoke all on public.access_rules from public;

grant select,insert,update on public.access_zones to icamp_app;
grant select,insert,delete on public.access_zone_devices to icamp_app;
grant select,insert,update on public.access_schedules to icamp_app;
grant select,insert,update on public.access_rules to icamp_app;

do $revoke_data_api$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.access_zones from anon';
    execute 'revoke all on public.access_zone_devices from anon';
    execute 'revoke all on public.access_schedules from anon';
    execute 'revoke all on public.access_rules from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.access_zones from authenticated';
    execute 'revoke all on public.access_zone_devices from authenticated';
    execute 'revoke all on public.access_schedules from authenticated';
    execute 'revoke all on public.access_rules from authenticated';
  end if;
end
$revoke_data_api$;

create policy access_zones_read on public.access_zones
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.events.read')
  or icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_zones_manage on public.access_zones
for all to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_zone_devices_read on public.access_zone_devices
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.events.read')
  or icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_zone_devices_manage on public.access_zone_devices
for all to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_schedules_read on public.access_schedules
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.events.read')
  or icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_schedules_manage on public.access_schedules
for all to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_rules_read on public.access_rules
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.events.read')
  or icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_rules_manage on public.access_rules
for all to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

comment on table public.access_zones is
  'Build 060 enforceable access zones. zone_kind adds camper-only/event/staff/service/restricted semantics; Build 057 zone_reference remains descriptive only.';

comment on table public.access_zone_devices is
  'Build 060 many-to-many binding between enforceable zones and Build 057 access devices.';

comment on table public.access_schedules is
  'Build 060 reusable local-campground weekday/time/date windows. start_local > end_local represents an overnight window.';

comment on table public.access_rules is
  'Build 060 ordered allow/deny rules for guest, visitor, staff, contractor, camper and event contexts. Default decision is deny when no active allow rule matches.';
