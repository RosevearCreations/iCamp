-- iCamp Build 066
-- Maintenance Roles, Foreman Queue & Escalation.
--
-- Adds a permission-derived maintenance responsibility hierarchy and
-- campground-scoped escalation policy/evidence over the canonical Build 065
-- work-order engine. No duplicate work-order authority is introduced.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values
  (
    'maintenance.triage',
    'Triage maintenance work orders and acknowledge escalations.',
    'elevated'
  ),
  (
    'maintenance.escalate',
    'Manage maintenance escalation policy and resolve escalations.',
    'elevated'
  )
on conflict (permission_key) do nothing;

insert into icamp_private.roles (
  role_code,
  display_name,
  description,
  role_kind
)
values
  (
    'maintenance_foreman',
    'Maintenance Foreman',
    'Assigns crew work, triages the maintenance queue and acknowledges escalations.',
    'template'
  ),
  (
    'maintenance_main_foreman',
    'Maintenance Main Foreman',
    'Coordinates foremen, manages escalation policy and resolves escalated maintenance work.',
    'template'
  )
on conflict (organization_id, role_code) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join (
  values
    ('maintenance_foreman', 'accommodation.read'),
    ('maintenance_foreman', 'maintenance.read'),
    ('maintenance_foreman', 'maintenance.create'),
    ('maintenance_foreman', 'maintenance.assign'),
    ('maintenance_foreman', 'maintenance.complete'),
    ('maintenance_foreman', 'maintenance.triage'),
    ('maintenance_foreman', 'inspection.perform'),
    ('maintenance_foreman', 'asset.read'),
    ('maintenance_foreman', 'equipment.read'),

    ('maintenance_main_foreman', 'accommodation.read'),
    ('maintenance_main_foreman', 'maintenance.read'),
    ('maintenance_main_foreman', 'maintenance.create'),
    ('maintenance_main_foreman', 'maintenance.assign'),
    ('maintenance_main_foreman', 'maintenance.complete'),
    ('maintenance_main_foreman', 'maintenance.triage'),
    ('maintenance_main_foreman', 'maintenance.escalate'),
    ('maintenance_main_foreman', 'inspection.perform'),
    ('maintenance_main_foreman', 'inspection.signoff'),
    ('maintenance_main_foreman', 'winterization.signoff'),
    ('maintenance_main_foreman', 'asset.read'),
    ('maintenance_main_foreman', 'asset.manage'),
    ('maintenance_main_foreman', 'equipment.read'),
    ('maintenance_main_foreman', 'equipment.manage'),

    ('maintenance_lead', 'maintenance.triage'),

    ('campground_manager', 'maintenance.complete'),
    ('campground_manager', 'maintenance.triage'),
    ('campground_manager', 'maintenance.escalate'),

    ('owner_admin', 'maintenance.triage'),
    ('owner_admin', 'maintenance.escalate')
) as grants(role_code, permission_key)
  on r.role_code = grants.role_code
 and r.role_kind = 'template'
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict do nothing;

create or replace function icamp_private.maintenance_responsibility_rank(
  p_user_id uuid,
  p_campground_id uuid
)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  with granted as (
    select distinct rp.permission_key
    from icamp_private.campground_assignments a
    join icamp_private.user_accounts u
      on u.id = a.user_id
    join icamp_private.campground_assignment_roles ar
      on ar.assignment_id = a.id
    join icamp_private.roles r
      on r.id = ar.role_id
     and r.lifecycle_state = 'active'
    join icamp_private.role_permissions rp
      on rp.role_id = r.id
    where a.user_id = p_user_id
      and a.campground_id = p_campground_id
      and a.assignment_state = 'active'
      and a.starts_at <= statement_timestamp()
      and (a.ends_at is null or a.ends_at > statement_timestamp())
      and u.account_type = 'staff'
      and u.account_state = 'active'
  ),
  flags as (
    select
      coalesce(bool_or(permission_key = 'staff.manage'), false) as staff_manage,
      coalesce(bool_or(permission_key = 'maintenance.escalate'), false) as escalate,
      coalesce(bool_or(permission_key = 'maintenance.triage'), false) as triage,
      coalesce(
        bool_or(permission_key in ('maintenance.create','maintenance.complete')),
        false
      ) as crew
    from granted
  )
  select case
    when staff_manage and escalate then 4
    when escalate then 3
    when triage then 2
    when crew then 1
    else 0
  end::smallint
  from flags;
$$;

create or replace function icamp_private.maintenance_responsibility_level(
  p_user_id uuid,
  p_campground_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case icamp_private.maintenance_responsibility_rank(
    p_user_id,
    p_campground_id
  )
    when 4 then 'manager'
    when 3 then 'main_foreman'
    when 2 then 'foreman'
    when 1 then 'crew'
    else null
  end;
$$;

create table public.maintenance_escalation_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  trigger_key text not null
    check (
      trigger_key in (
        'emergency_priority',
        'urgent_priority',
        'blocked',
        'response_overdue',
        'completion_overdue'
      )
    ),
  target_level text not null
    check (target_level in ('foreman','main_foreman','manager')),
  threshold_minutes integer not null default 0
    check (threshold_minutes between 0 and 43200),
  is_active boolean not null default true,
  instructions text
    check (instructions is null or char_length(instructions) <= 1000),
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint maintenance_escalation_policies_scope_trigger_unique
    unique (organization_id, campground_id, trigger_key),
  constraint maintenance_escalation_policies_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict
);

create table public.maintenance_work_order_escalations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  work_order_id uuid not null,
  trigger_key text not null,
  target_level text not null
    check (target_level in ('foreman','main_foreman','manager')),
  state text not null default 'open'
    check (state in ('open','acknowledged','resolved')),
  raised_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  raised_at timestamptz not null default statement_timestamp(),
  acknowledgement_note text
    check (
      acknowledgement_note is null
      or char_length(trim(acknowledgement_note)) between 1 and 2000
    ),
  acknowledged_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  acknowledged_at timestamptz,
  resolution_note text
    check (
      resolution_note is null
      or char_length(trim(resolution_note)) between 3 and 2000
    ),
  resolved_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  resolved_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint maintenance_work_order_escalations_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_order_escalations_policy_fk
    foreign key (organization_id, campground_id, trigger_key)
    references public.maintenance_escalation_policies(
      organization_id,
      campground_id,
      trigger_key
    )
    on update cascade
    on delete restrict,
  constraint maintenance_work_order_escalations_ack_check
    check (
      (
        state = 'open'
        and acknowledged_by_user_id is null
        and acknowledged_at is null
        and resolution_note is null
        and resolved_by_user_id is null
        and resolved_at is null
      )
      or
      (
        state = 'acknowledged'
        and acknowledged_by_user_id is not null
        and acknowledged_at is not null
        and resolution_note is null
        and resolved_by_user_id is null
        and resolved_at is null
      )
      or
      (
        state = 'resolved'
        and resolution_note is not null
        and resolved_by_user_id is not null
        and resolved_at is not null
      )
    )
);

create unique index maintenance_work_order_escalations_active_trigger_idx
  on public.maintenance_work_order_escalations(work_order_id, trigger_key)
  where state in ('open','acknowledged');

create index maintenance_escalation_policies_scope_fk_idx
  on public.maintenance_escalation_policies(organization_id, campground_id);

create index maintenance_escalation_policies_updated_by_idx
  on public.maintenance_escalation_policies(updated_by_user_id)
  where updated_by_user_id is not null;

create index maintenance_work_order_escalations_scope_work_order_fk_idx
  on public.maintenance_work_order_escalations(
    organization_id,
    campground_id,
    work_order_id
  );

create index maintenance_work_order_escalations_scope_policy_fk_idx
  on public.maintenance_work_order_escalations(
    organization_id,
    campground_id,
    trigger_key
  );

create index maintenance_work_order_escalations_queue_idx
  on public.maintenance_work_order_escalations(
    campground_id,
    state,
    target_level,
    raised_at
  );

create index maintenance_work_order_escalations_raised_by_idx
  on public.maintenance_work_order_escalations(raised_by_user_id);

create index maintenance_work_order_escalations_acknowledged_by_idx
  on public.maintenance_work_order_escalations(acknowledged_by_user_id)
  where acknowledged_by_user_id is not null;

create index maintenance_work_order_escalations_resolved_by_idx
  on public.maintenance_work_order_escalations(resolved_by_user_id)
  where resolved_by_user_id is not null;

create trigger maintenance_escalation_policies_touch
before update on public.maintenance_escalation_policies
for each row execute function icamp_private.touch_row();

create trigger maintenance_work_order_escalations_touch
before update on public.maintenance_work_order_escalations
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.seed_maintenance_escalation_policies(
  p_organization_id uuid,
  p_campground_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.maintenance_escalation_policies (
    organization_id,
    campground_id,
    trigger_key,
    target_level,
    threshold_minutes,
    instructions
  )
  values
    (
      p_organization_id,
      p_campground_id,
      'emergency_priority',
      'foreman',
      0,
      'Emergency-priority work enters the foreman triage queue immediately.'
    ),
    (
      p_organization_id,
      p_campground_id,
      'urgent_priority',
      'foreman',
      0,
      'Urgent-priority work enters the foreman triage queue immediately.'
    ),
    (
      p_organization_id,
      p_campground_id,
      'blocked',
      'main_foreman',
      0,
      'Blocked work is elevated to the main foreman for coordination.'
    ),
    (
      p_organization_id,
      p_campground_id,
      'response_overdue',
      'foreman',
      0,
      'Unresponded work escalates when its Build 064 response target is exceeded.'
    ),
    (
      p_organization_id,
      p_campground_id,
      'completion_overdue',
      'main_foreman',
      0,
      'Incomplete work escalates when its Build 064 completion target is exceeded.'
    )
  on conflict (organization_id, campground_id, trigger_key) do nothing;
end;
$$;

select icamp_private.seed_maintenance_escalation_policies(
  c.organization_id,
  c.id
)
from public.campgrounds c
where c.lifecycle_state <> 'archived';

create or replace function icamp_private.seed_maintenance_escalation_after_campground()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform icamp_private.seed_maintenance_escalation_policies(
    new.organization_id,
    new.id
  );
  return new;
end;
$$;

create trigger campgrounds_seed_maintenance_escalation
after insert on public.campgrounds
for each row execute function icamp_private.seed_maintenance_escalation_after_campground();

create or replace function icamp_private.guard_maintenance_escalation_policy_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id', true), '')::uuid;

  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.trigger_key is distinct from new.trigger_key
     or old.created_at is distinct from new.created_at then
    raise exception 'Maintenance escalation policy identity is immutable';
  end if;

  if not icamp_private.has_campground_permission(
    new.campground_id,
    'maintenance.escalate'
  ) then
    raise exception 'maintenance.escalate permission is required';
  end if;

  if new.updated_by_user_id is distinct from actor_id then
    raise exception 'updated_by_user_id must match the request actor';
  end if;

  return new;
end;
$$;

create trigger maintenance_escalation_policies_guard_update
before update on public.maintenance_escalation_policies
for each row execute function icamp_private.guard_maintenance_escalation_policy_update();

create or replace function icamp_private.guard_maintenance_escalation_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id', true), '')::uuid;

  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.work_order_id is distinct from new.work_order_id
     or old.trigger_key is distinct from new.trigger_key
     or old.target_level is distinct from new.target_level
     or old.raised_by_user_id is distinct from new.raised_by_user_id
     or old.raised_at is distinct from new.raised_at then
    raise exception 'Maintenance escalation identity and raise evidence are immutable';
  end if;

  if old.state = 'resolved' then
    raise exception 'Resolved maintenance escalations are terminal';
  end if;

  if new.state = 'acknowledged' then
    if old.state <> 'open' then
      raise exception 'Only open maintenance escalations can be acknowledged';
    end if;

    if not icamp_private.has_campground_permission(
      new.campground_id,
      'maintenance.triage'
    ) then
      raise exception 'maintenance.triage permission is required';
    end if;

    if new.acknowledged_by_user_id is distinct from actor_id
       or new.acknowledged_at is null then
      raise exception 'Acknowledgement actor and timestamp are required';
    end if;
  elsif new.state = 'resolved' then
    if not icamp_private.has_campground_permission(
      new.campground_id,
      'maintenance.escalate'
    ) then
      raise exception 'maintenance.escalate permission is required to resolve';
    end if;

    if new.resolved_by_user_id is distinct from actor_id
       or new.resolved_at is null
       or new.resolution_note is null then
      raise exception 'Resolution actor, timestamp and note are required';
    end if;
  elsif new.state is distinct from old.state then
    raise exception 'Unsupported maintenance escalation state transition';
  end if;

  return new;
end;
$$;

create trigger maintenance_work_order_escalations_guard_update
before update on public.maintenance_work_order_escalations
for each row execute function icamp_private.guard_maintenance_escalation_update();

create or replace function icamp_private.guard_maintenance_work_order_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
  assigned_is_current boolean;
  actor_rank smallint;
  target_rank smallint;
begin
  actor_id := nullif(current_setting('icamp.user_id', true), '')::uuid;

  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.category_id is distinct from new.category_id
     or old.priority_policy_id is distinct from new.priority_policy_id
     or old.section_id is distinct from new.section_id
     or old.asset_id is distinct from new.asset_id
     or old.accommodation_id is distinct from new.accommodation_id
     or old.location_description is distinct from new.location_description
     or old.title is distinct from new.title
     or old.description is distinct from new.description
     or old.response_due_at is distinct from new.response_due_at
     or old.completion_due_at is distinct from new.completion_due_at
     or old.created_by_user_id is distinct from new.created_by_user_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Build 065 work-order classification and creation evidence is immutable';
  end if;

  if old.status in ('completed','cancelled')
     and old.assigned_to_user_id is distinct from new.assigned_to_user_id then
    raise exception 'Closed maintenance work orders cannot be reassigned';
  end if;

  if new.assigned_to_user_id is not null then
    select exists (
      select 1
      from icamp_private.campground_assignments a
      join icamp_private.user_accounts u on u.id = a.user_id
      where a.user_id = new.assigned_to_user_id
        and a.organization_id = new.organization_id
        and a.campground_id = new.campground_id
        and a.assignment_state = 'active'
        and a.starts_at <= statement_timestamp()
        and (a.ends_at is null or a.ends_at > statement_timestamp())
        and u.account_type = 'staff'
        and u.account_state = 'active'
    ) into assigned_is_current;

    if not assigned_is_current then
      raise exception 'Assigned maintenance worker must have an active campground staff assignment';
    end if;
  end if;

  if new.status in ('assigned','in_progress')
     and new.assigned_to_user_id is null then
    raise exception 'Assigned and in-progress work orders require an assignee';
  end if;

  if old.status is distinct from new.status then
    if old.status = 'open' and new.status not in ('assigned','in_progress','cancelled') then
      raise exception 'Unsupported maintenance work-order status transition';
    elsif old.status = 'assigned' and new.status not in ('open','in_progress','blocked','cancelled') then
      raise exception 'Unsupported maintenance work-order status transition';
    elsif old.status = 'in_progress' and new.status not in ('assigned','blocked','completed','cancelled') then
      raise exception 'Unsupported maintenance work-order status transition';
    elsif old.status = 'blocked' and new.status not in ('assigned','in_progress','cancelled') then
      raise exception 'Unsupported maintenance work-order status transition';
    elsif old.status in ('completed','cancelled') then
      raise exception 'Completed or cancelled maintenance work orders are terminal';
    end if;

    if new.status = 'completed' then
      if not icamp_private.has_campground_permission(
        new.campground_id,
        'maintenance.complete'
      ) then
        raise exception 'maintenance.complete permission is required';
      end if;
    elsif not icamp_private.has_campground_permission(
      new.campground_id,
      'maintenance.assign'
    ) then
      raise exception 'maintenance.assign permission is required for status changes';
    end if;
  end if;

  if old.assigned_to_user_id is distinct from new.assigned_to_user_id then
    if not icamp_private.has_campground_permission(
      new.campground_id,
      'maintenance.assign'
    ) then
      raise exception 'maintenance.assign permission is required for assignment changes';
    end if;

    actor_rank := icamp_private.maintenance_responsibility_rank(
      actor_id,
      new.campground_id
    );

    if actor_rank < 2 then
      raise exception 'Foreman responsibility or higher is required for assignment changes';
    end if;

    if new.assigned_to_user_id is not null
       and new.assigned_to_user_id is distinct from actor_id then
      target_rank := icamp_private.maintenance_responsibility_rank(
        new.assigned_to_user_id,
        new.campground_id
      );

      if target_rank < 1 then
        raise exception 'Maintenance work can only be assigned to maintenance-responsible staff';
      end if;

      if actor_rank < 4 and target_rank >= actor_rank then
        raise exception 'Maintenance assignment cannot target an equal or higher responsibility level';
      end if;
    end if;
  end if;

  if new.updated_by_user_id is distinct from actor_id then
    raise exception 'updated_by_user_id must match the request actor';
  end if;

  return new;
end;
$$;

alter table public.maintenance_escalation_policies enable row level security;
alter table public.maintenance_escalation_policies force row level security;
alter table public.maintenance_work_order_escalations enable row level security;
alter table public.maintenance_work_order_escalations force row level security;

revoke all on public.maintenance_escalation_policies from public;
revoke all on public.maintenance_work_order_escalations from public;

grant select,update on public.maintenance_escalation_policies to icamp_app;
grant select,insert,update on public.maintenance_work_order_escalations to icamp_app;

do $revoke_data_api$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format(
        'revoke all on public.maintenance_escalation_policies from %I',
        role_name
      );
      execute format(
        'revoke all on public.maintenance_work_order_escalations from %I',
        role_name
      );
    end if;
  end loop;
end
$revoke_data_api$;

create policy maintenance_escalation_policies_read
on public.maintenance_escalation_policies
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.triage')
  or icamp_private.has_campground_permission(campground_id,'maintenance.escalate')
);

create policy maintenance_escalation_policies_update
on public.maintenance_escalation_policies
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.escalate')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.escalate')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_work_order_escalations_read
on public.maintenance_work_order_escalations
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.triage')
  or icamp_private.has_campground_permission(campground_id,'maintenance.escalate')
);

create policy maintenance_work_order_escalations_insert
on public.maintenance_work_order_escalations
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id,'maintenance.triage')
    or icamp_private.has_campground_permission(campground_id,'maintenance.escalate')
  )
  and raised_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_work_order_escalations_update
on public.maintenance_work_order_escalations
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.triage')
  or icamp_private.has_campground_permission(campground_id,'maintenance.escalate')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.triage')
  or icamp_private.has_campground_permission(campground_id,'maintenance.escalate')
);

comment on function icamp_private.maintenance_responsibility_rank(uuid,uuid) is
  'Build 066 permission-derived maintenance responsibility hierarchy: crew=1, foreman=2, main foreman=3, manager=4.';

comment on table public.maintenance_escalation_policies is
  'Build 066 campground escalation policy over canonical Build 065 work-order state and Build 064 priority targets.';

comment on table public.maintenance_work_order_escalations is
  'Build 066 append-oriented acknowledgement and resolution evidence for maintenance escalation handling.';
