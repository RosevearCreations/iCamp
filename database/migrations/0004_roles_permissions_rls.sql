-- iCamp Build 005
-- Roles, permissions, campground assignments and row-level security.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'icamp_app') then
    create role icamp_app nologin noinherit;
  end if;
end
$$;

create table icamp_private.permission_catalog (
  permission_key text primary key
    check (permission_key ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$'),
  description text not null
    check (char_length(trim(description)) between 1 and 240),
  risk_level text not null default 'standard'
    check (risk_level in ('standard', 'elevated', 'high')),
  created_at timestamptz not null default statement_timestamp()
);

create table icamp_private.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid
    references public.organizations(id)
    on update cascade
    on delete restrict,
  role_code text not null
    check (role_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 120),
  description text not null default ''
    check (char_length(description) <= 500),
  role_kind text not null
    check (role_kind in ('template', 'custom')),
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  constraint roles_scope_code_unique
    unique nulls not distinct (organization_id, role_code),
  constraint roles_kind_scope_check
    check (
      (role_kind = 'template' and organization_id is null)
      or
      (role_kind = 'custom' and organization_id is not null)
    ),
  constraint roles_archive_state_check
    check (
      lifecycle_state <> 'archived'
      or archived_at is not null
    )
);

create table icamp_private.role_permissions (
  role_id uuid not null
    references icamp_private.roles(id)
    on update cascade
    on delete cascade,
  permission_key text not null
    references icamp_private.permission_catalog(permission_key)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key (role_id, permission_key)
);

create table icamp_private.campground_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete cascade,
  organization_id uuid not null,
  campground_id uuid not null,
  assignment_state text not null default 'active'
    check (assignment_state in ('active', 'inactive')),
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_assignments_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_assignments_user_campground_unique
    unique (user_id, campground_id),
  constraint campground_assignments_time_check
    check (ends_at is null or ends_at > starts_at)
);

create table icamp_private.campground_assignment_roles (
  assignment_id uuid not null
    references icamp_private.campground_assignments(id)
    on update cascade
    on delete cascade,
  role_id uuid not null
    references icamp_private.roles(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key (assignment_id, role_id)
);

create index roles_organization_idx
  on icamp_private.roles (organization_id, lifecycle_state);

create index campground_assignments_user_idx
  on icamp_private.campground_assignments (
    user_id,
    assignment_state,
    campground_id
  );

create index campground_assignment_roles_role_idx
  on icamp_private.campground_assignment_roles (role_id, assignment_id);

create trigger roles_touch_row
before update on icamp_private.roles
for each row execute function icamp_private.touch_row();

create trigger campground_assignments_touch_row
before update on icamp_private.campground_assignments
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.validate_staff_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_type_value text;
begin
  select account_type
    into account_type_value
  from icamp_private.user_accounts
  where id = new.user_id;

  if account_type_value is distinct from 'staff' then
    raise exception using
      errcode = '23514',
      message = 'Only staff identities can receive campground staff assignments';
  end if;

  return new;
end;
$$;

create trigger campground_assignments_validate_staff
before insert or update of user_id on icamp_private.campground_assignments
for each row execute function icamp_private.validate_staff_assignment();

create or replace function icamp_private.validate_assignment_role_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assignment_org uuid;
  role_org uuid;
  role_state text;
begin
  select organization_id
    into assignment_org
  from icamp_private.campground_assignments
  where id = new.assignment_id;

  select organization_id, lifecycle_state
    into role_org, role_state
  from icamp_private.roles
  where id = new.role_id;

  if assignment_org is null or role_state is null then
    raise exception using
      errcode = '23514',
      message = 'Assignment and role must exist';
  end if;

  if role_state <> 'active' then
    raise exception using
      errcode = '23514',
      message = 'Inactive or archived roles cannot be assigned';
  end if;

  if role_org is not null and role_org <> assignment_org then
    raise exception using
      errcode = '23514',
      message = 'Custom roles cannot cross organization boundaries';
  end if;

  return new;
end;
$$;

create trigger campground_assignment_roles_validate_scope
before insert or update on icamp_private.campground_assignment_roles
for each row execute function icamp_private.validate_assignment_role_scope();

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
select
  permission_key,
  initcap(replace(permission_key, '.', ' ')),
  case
    when permission_key in (
      'refund.issue',
      'gate.override.open',
      'gate.override.close',
      'access.credential.issue',
      'access.credential.revoke',
      'financing.read',
      'financing.manage',
      'role.manage',
      'finance.manage',
      'emergency.broadcast',
      'it.diagnostics.export',
      'system.admin'
    ) then 'high'
    when permission_key like '%.manage'
      or permission_key like '%.override'
      or permission_key like '%.signoff'
      or permission_key like '%.send'
      or permission_key like '%.capture'
      or permission_key like '%.issue'
      or permission_key like '%.revoke'
      or permission_key like '%.transfer'
      or permission_key like '%.publish'
    then 'elevated'
    else 'standard'
  end
from (
  values
    ('campground.configuration'),
    ('campground.map'),
    ('campground.map.publish'),
    ('accommodation.read'),
    ('accommodation.manage'),
    ('accommodation.media.manage'),
    ('reservation.read'),
    ('reservation.create'),
    ('reservation.modify'),
    ('reservation.cancel'),
    ('reservation.override'),
    ('pricing.manage'),
    ('payment.read'),
    ('payment.capture'),
    ('refund.issue'),
    ('discount.apply'),
    ('guest.read'),
    ('guest.manage'),
    ('vehicle.read'),
    ('vehicle.register'),
    ('vehicle.pass.issue'),
    ('visitor.read'),
    ('visitor.register'),
    ('access.credential.issue'),
    ('access.credential.revoke'),
    ('access.events.read'),
    ('gate.state.read'),
    ('gate.override.open'),
    ('gate.override.close'),
    ('security.incident.manage'),
    ('maintenance.read'),
    ('maintenance.create'),
    ('maintenance.assign'),
    ('maintenance.complete'),
    ('inspection.perform'),
    ('inspection.signoff'),
    ('seasonal.manage'),
    ('winterization.signoff'),
    ('permanent_unit.manage'),
    ('permanent_unit.transfer'),
    ('financing.read'),
    ('financing.manage'),
    ('event.manage'),
    ('event.access.manage'),
    ('local_interest.manage'),
    ('promotion.manage'),
    ('waterfront.manage'),
    ('boat.manage'),
    ('dock.manage'),
    ('safety.warning.issue'),
    ('safety.suspension.issue'),
    ('safety.suspension.review'),
    ('rental.manage'),
    ('pos.sell'),
    ('pos.refund'),
    ('inventory.read'),
    ('inventory.manage'),
    ('garbage.pickup.manage'),
    ('staff.read'),
    ('staff.manage'),
    ('role.manage'),
    ('schedule.manage'),
    ('timekeeping.manage'),
    ('vendor.read'),
    ('vendor.manage'),
    ('finance.read'),
    ('finance.manage'),
    ('reports.read'),
    ('audit.read'),
    ('announcement.send'),
    ('communications.read'),
    ('communications.send'),
    ('communications.manage'),
    ('voice.call'),
    ('ivr.admin'),
    ('sms.send'),
    ('sms.preference.manage'),
    ('emergency.broadcast'),
    ('it.health.read'),
    ('it.diagnostics.read'),
    ('it.incident.manage'),
    ('it.integration.read'),
    ('it.release.read'),
    ('it.diagnostics.export'),
    ('system.status.publish'),
    ('system.admin')
) as permissions(permission_key)
on conflict (permission_key) do nothing;

insert into icamp_private.roles (
  role_code,
  display_name,
  description,
  role_kind
)
values
  ('front_desk', 'Front Desk', 'Reservation, guest and arrival/departure operations.', 'template'),
  ('maintenance', 'Maintenance', 'Maintenance and routine inspection operations.', 'template'),
  ('maintenance_lead', 'Maintenance Lead', 'Maintenance assignment and sign-off responsibilities.', 'template'),
  ('security', 'Security', 'Access, gate, visitor and security incident operations.', 'template'),
  ('store_pos', 'Store / POS', 'Retail sales and inventory operations.', 'template'),
  ('finance', 'Finance', 'Payment, vendor and financial reporting operations.', 'template'),
  ('it_admin', 'I.T. Administrator', 'System health, diagnostics and technical administration.', 'template'),
  ('campground_manager', 'Campground Manager', 'Broad campground operations and staff administration.', 'template'),
  ('owner_admin', 'Owner / Administrator', 'All currently catalogued permissions.', 'template')
on conflict (organization_id, role_code) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
cross join icamp_private.permission_catalog p
where r.role_kind = 'template'
  and r.role_code = 'owner_admin'
on conflict do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, grants.permission_key
from icamp_private.roles r
join (
  values
    ('front_desk', 'accommodation.read'),
    ('front_desk', 'reservation.read'),
    ('front_desk', 'reservation.create'),
    ('front_desk', 'reservation.modify'),
    ('front_desk', 'reservation.cancel'),
    ('front_desk', 'payment.read'),
    ('front_desk', 'guest.read'),
    ('front_desk', 'guest.manage'),
    ('front_desk', 'vehicle.read'),
    ('front_desk', 'vehicle.register'),
    ('front_desk', 'vehicle.pass.issue'),
    ('front_desk', 'visitor.read'),
    ('front_desk', 'visitor.register'),

    ('maintenance', 'accommodation.read'),
    ('maintenance', 'maintenance.read'),
    ('maintenance', 'maintenance.create'),
    ('maintenance', 'maintenance.complete'),
    ('maintenance', 'inspection.perform'),

    ('maintenance_lead', 'accommodation.read'),
    ('maintenance_lead', 'maintenance.read'),
    ('maintenance_lead', 'maintenance.create'),
    ('maintenance_lead', 'maintenance.assign'),
    ('maintenance_lead', 'maintenance.complete'),
    ('maintenance_lead', 'inspection.perform'),
    ('maintenance_lead', 'inspection.signoff'),
    ('maintenance_lead', 'winterization.signoff'),

    ('security', 'vehicle.read'),
    ('security', 'visitor.read'),
    ('security', 'access.credential.issue'),
    ('security', 'access.credential.revoke'),
    ('security', 'access.events.read'),
    ('security', 'gate.state.read'),
    ('security', 'gate.override.open'),
    ('security', 'gate.override.close'),
    ('security', 'security.incident.manage'),
    ('security', 'safety.warning.issue'),
    ('security', 'safety.suspension.issue'),
    ('security', 'safety.suspension.review'),

    ('store_pos', 'pos.sell'),
    ('store_pos', 'inventory.read'),
    ('store_pos', 'inventory.manage'),
    ('store_pos', 'rental.manage'),

    ('finance', 'payment.read'),
    ('finance', 'payment.capture'),
    ('finance', 'refund.issue'),
    ('finance', 'discount.apply'),
    ('finance', 'vendor.read'),
    ('finance', 'finance.read'),
    ('finance', 'finance.manage'),
    ('finance', 'reports.read'),

    ('it_admin', 'it.health.read'),
    ('it_admin', 'it.diagnostics.read'),
    ('it_admin', 'it.incident.manage'),
    ('it_admin', 'it.integration.read'),
    ('it_admin', 'it.release.read'),
    ('it_admin', 'it.diagnostics.export'),
    ('it_admin', 'system.status.publish'),
    ('it_admin', 'audit.read'),
    ('it_admin', 'system.admin'),

    ('campground_manager', 'campground.configuration'),
    ('campground_manager', 'campground.map'),
    ('campground_manager', 'campground.map.publish'),
    ('campground_manager', 'accommodation.read'),
    ('campground_manager', 'accommodation.manage'),
    ('campground_manager', 'reservation.read'),
    ('campground_manager', 'reservation.create'),
    ('campground_manager', 'reservation.modify'),
    ('campground_manager', 'reservation.cancel'),
    ('campground_manager', 'reservation.override'),
    ('campground_manager', 'pricing.manage'),
    ('campground_manager', 'payment.read'),
    ('campground_manager', 'guest.read'),
    ('campground_manager', 'guest.manage'),
    ('campground_manager', 'vehicle.read'),
    ('campground_manager', 'visitor.read'),
    ('campground_manager', 'maintenance.read'),
    ('campground_manager', 'maintenance.create'),
    ('campground_manager', 'maintenance.assign'),
    ('campground_manager', 'inspection.signoff'),
    ('campground_manager', 'event.manage'),
    ('campground_manager', 'event.access.manage'),
    ('campground_manager', 'local_interest.manage'),
    ('campground_manager', 'promotion.manage'),
    ('campground_manager', 'inventory.read'),
    ('campground_manager', 'staff.read'),
    ('campground_manager', 'staff.manage'),
    ('campground_manager', 'role.manage'),
    ('campground_manager', 'schedule.manage'),
    ('campground_manager', 'vendor.read'),
    ('campground_manager', 'vendor.manage'),
    ('campground_manager', 'reports.read'),
    ('campground_manager', 'announcement.send'),
    ('campground_manager', 'communications.read'),
    ('campground_manager', 'communications.send')
) as grants(role_code, permission_key)
  on r.role_code = grants.role_code
 and r.role_kind = 'template'
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict do nothing;

create or replace function icamp_private.request_user_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  raw_value text;
begin
  raw_value := current_setting('icamp.user_id', true);

  if raw_value is null or raw_value = '' then
    return null;
  end if;

  return raw_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function icamp_private.has_campground_assignment(
  target_campground_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from icamp_private.campground_assignments a
    where a.user_id = icamp_private.request_user_id()
      and a.campground_id = target_campground_id
      and a.assignment_state = 'active'
      and a.starts_at <= statement_timestamp()
      and (a.ends_at is null or a.ends_at > statement_timestamp())
  );
$$;

create or replace function icamp_private.has_organization_membership(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from icamp_private.campground_assignments a
    where a.user_id = icamp_private.request_user_id()
      and a.organization_id = target_organization_id
      and a.assignment_state = 'active'
      and a.starts_at <= statement_timestamp()
      and (a.ends_at is null or a.ends_at > statement_timestamp())
  );
$$;

create or replace function icamp_private.has_campground_permission(
  target_campground_id uuid,
  target_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from icamp_private.campground_assignments a
    join icamp_private.campground_assignment_roles ar
      on ar.assignment_id = a.id
    join icamp_private.roles r
      on r.id = ar.role_id
    join icamp_private.role_permissions rp
      on rp.role_id = r.id
    where a.user_id = icamp_private.request_user_id()
      and a.campground_id = target_campground_id
      and a.assignment_state = 'active'
      and a.starts_at <= statement_timestamp()
      and (a.ends_at is null or a.ends_at > statement_timestamp())
      and r.lifecycle_state = 'active'
      and rp.permission_key = target_permission
  );
$$;

create or replace function icamp_private.has_organization_permission(
  target_organization_id uuid,
  target_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from icamp_private.campground_assignments a
    join icamp_private.campground_assignment_roles ar
      on ar.assignment_id = a.id
    join icamp_private.roles r
      on r.id = ar.role_id
    join icamp_private.role_permissions rp
      on rp.role_id = r.id
    where a.user_id = icamp_private.request_user_id()
      and a.organization_id = target_organization_id
      and a.assignment_state = 'active'
      and a.starts_at <= statement_timestamp()
      and (a.ends_at is null or a.ends_at > statement_timestamp())
      and r.lifecycle_state = 'active'
      and rp.permission_key = target_permission
  );
$$;

revoke all on function icamp_private.request_user_id() from public;
revoke all on function icamp_private.has_campground_assignment(uuid) from public;
revoke all on function icamp_private.has_organization_membership(uuid) from public;
revoke all on function icamp_private.has_campground_permission(uuid, text) from public;
revoke all on function icamp_private.has_organization_permission(uuid, text) from public;

grant usage on schema public to icamp_app;
grant usage on schema icamp_private to icamp_app;
grant execute on function icamp_private.request_user_id() to icamp_app;
grant execute on function icamp_private.has_campground_assignment(uuid) to icamp_app;
grant execute on function icamp_private.has_organization_membership(uuid) to icamp_app;
grant execute on function icamp_private.has_campground_permission(uuid, text) to icamp_app;
grant execute on function icamp_private.has_organization_permission(uuid, text) to icamp_app;

revoke all on public.organizations from public;
revoke all on public.campgrounds from public;
revoke all on public.campground_sections from public;
revoke all on public.campground_subsections from public;
revoke all on public.admin_refresh_states from public;

grant select, update on public.organizations to icamp_app;
grant select, update on public.campgrounds to icamp_app;
grant select, update on public.campground_sections to icamp_app;
grant select, update on public.campground_subsections to icamp_app;
grant select, insert, update on public.admin_refresh_states to icamp_app;

alter table public.organizations force row level security;
alter table public.campgrounds force row level security;
alter table public.campground_sections force row level security;
alter table public.campground_subsections force row level security;
alter table public.admin_refresh_states force row level security;

create policy organizations_assigned_select
on public.organizations
for select
to icamp_app
using (icamp_private.has_organization_membership(id));

create policy organizations_configuration_update
on public.organizations
for update
to icamp_app
using (
  icamp_private.has_organization_permission(id, 'campground.configuration')
)
with check (
  icamp_private.has_organization_permission(id, 'campground.configuration')
);

create policy campgrounds_assigned_select
on public.campgrounds
for select
to icamp_app
using (icamp_private.has_campground_assignment(id));

create policy campgrounds_configuration_update
on public.campgrounds
for update
to icamp_app
using (
  icamp_private.has_campground_permission(id, 'campground.configuration')
)
with check (
  icamp_private.has_campground_permission(id, 'campground.configuration')
);

create policy campground_sections_assigned_select
on public.campground_sections
for select
to icamp_app
using (icamp_private.has_campground_assignment(campground_id));

create policy campground_sections_configuration_update
on public.campground_sections
for update
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
)
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
);

create policy campground_subsections_assigned_select
on public.campground_subsections
for select
to icamp_app
using (icamp_private.has_campground_assignment(campground_id));

create policy campground_subsections_configuration_update
on public.campground_subsections
for update
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
)
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
);

create policy admin_refresh_states_it_select
on public.admin_refresh_states
for select
to icamp_app
using (
  icamp_private.has_organization_permission(organization_id, 'it.health.read')
  or icamp_private.has_organization_permission(organization_id, 'system.admin')
);

create policy admin_refresh_states_system_insert
on public.admin_refresh_states
for insert
to icamp_app
with check (
  icamp_private.has_organization_permission(organization_id, 'system.admin')
);

create policy admin_refresh_states_system_update
on public.admin_refresh_states
for update
to icamp_app
using (
  icamp_private.has_organization_permission(organization_id, 'system.admin')
)
with check (
  icamp_private.has_organization_permission(organization_id, 'system.admin')
);

comment on table icamp_private.permission_catalog is
  'Canonical permission keys used by server authorization and role templates.';

comment on table icamp_private.roles is
  'System role templates and organization-scoped custom roles.';

comment on table icamp_private.campground_assignments is
  'Staff identity assignments to an explicit campground/property boundary.';

comment on role icamp_app is
  'Trusted no-login application role used for RLS-enforced data access.';
