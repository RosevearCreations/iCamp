-- iCamp Build 078
-- Assistance Triage & Management Escalation.
--
-- Build 077 remains immutable guest-originated intake. Build 078 adds a
-- separate operational case projection, append-only staff/guest-visible
-- evidence, scoped assignment, management escalation, and terminal closure.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values
  (
    'assistance.triage',
    'Triage, reclassify and assign camper assistance cases.',
    'elevated'
  ),
  (
    'assistance.escalate',
    'Escalate and resolve management escalation for camper assistance cases.',
    'elevated'
  ),
  (
    'assistance.communicate',
    'Record guest-visible camper assistance communication.',
    'standard'
  ),
  (
    'assistance.close',
    'Close camper assistance cases with a recorded outcome.',
    'elevated'
  )
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join (
  values
    ('front_desk', 'assistance.triage'),
    ('front_desk', 'assistance.communicate'),
    ('maintenance_lead', 'assistance.triage'),
    ('maintenance_lead', 'assistance.communicate'),
    ('maintenance_foreman', 'assistance.triage'),
    ('maintenance_foreman', 'assistance.communicate'),
    ('maintenance_main_foreman', 'assistance.triage'),
    ('maintenance_main_foreman', 'assistance.escalate'),
    ('maintenance_main_foreman', 'assistance.communicate'),
    ('maintenance_main_foreman', 'assistance.close'),
    ('security', 'assistance.triage'),
    ('security', 'assistance.communicate'),
    ('campground_manager', 'assistance.triage'),
    ('campground_manager', 'assistance.escalate'),
    ('campground_manager', 'assistance.communicate'),
    ('campground_manager', 'assistance.close'),
    ('owner_admin', 'assistance.triage'),
    ('owner_admin', 'assistance.escalate'),
    ('owner_admin', 'assistance.communicate'),
    ('owner_admin', 'assistance.close')
) as grants(role_code, permission_key)
  on r.role_code = grants.role_code
 and r.role_kind = 'template'
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict do nothing;

create table public.camper_assistance_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  request_id uuid not null unique,
  operational_category text not null
    check (
      operational_category in (
        'maintenance',
        'garbage',
        'septic',
        'electrical',
        'water',
        'wifi',
        'noise',
        'security',
        'rental',
        'store',
        'other'
      )
    ),
  operational_severity text not null
    check (operational_severity in ('routine','soon','urgent')),
  case_state text not null default 'new'
    check (case_state in ('new','triaged','assigned','escalated','closed')),
  assigned_to_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  escalation_level text not null default 'none'
    check (
      escalation_level in ('none','main_foreman','manager','owner')
    ),
  outcome_code text
    check (
      outcome_code is null
      or outcome_code in (
        'resolved',
        'referred',
        'duplicate',
        'guest_cancelled',
        'not_reproducible',
        'other'
      )
    ),
  outcome_summary text
    check (
      outcome_summary is null
      or char_length(trim(outcome_summary)) between 3 and 2000
    ),
  updated_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  closed_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint camper_assistance_cases_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint camper_assistance_cases_request_fk
    foreign key (organization_id,campground_id,request_id)
    references public.camper_assistance_requests(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint camper_assistance_cases_escalation_state_check
    check (
      (case_state = 'escalated' and escalation_level <> 'none')
      or case_state <> 'escalated'
    ),
  constraint camper_assistance_cases_closure_check
    check (
      (
        case_state = 'closed'
        and outcome_code is not null
        and outcome_summary is not null
        and closed_by_user_id is not null
        and closed_at is not null
      )
      or
      (
        case_state <> 'closed'
        and outcome_code is null
        and outcome_summary is null
        and closed_by_user_id is null
        and closed_at is null
      )
    )
);

create index camper_assistance_cases_scope_request_fk_idx
  on public.camper_assistance_cases(
    organization_id,
    campground_id,
    request_id
  );

create index camper_assistance_cases_queue_idx
  on public.camper_assistance_cases(
    campground_id,
    case_state,
    operational_severity,
    updated_at
  );

create index camper_assistance_cases_assigned_to_idx
  on public.camper_assistance_cases(assigned_to_user_id)
  where assigned_to_user_id is not null;

create index camper_assistance_cases_updated_by_idx
  on public.camper_assistance_cases(updated_by_user_id);

create index camper_assistance_cases_closed_by_idx
  on public.camper_assistance_cases(closed_by_user_id)
  where closed_by_user_id is not null;

create table public.camper_assistance_case_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  case_id uuid not null,
  event_kind text not null
    check (
      event_kind in (
        'triaged',
        'assigned',
        'escalated',
        'escalation_acknowledged',
        'escalation_resolved',
        'guest_message',
        'staff_note',
        'closed'
      )
    ),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  source_channel text not null default 'web'
    check (source_channel in ('web','ivr','sms','staff','system')),
  contact_channel text
    check (
      contact_channel is null
      or contact_channel in ('in_app','email','sms','phone')
    ),
  guest_visible boolean not null default false,
  summary text not null
    check (char_length(trim(summary)) between 3 and 2000),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint camper_assistance_case_events_case_fk
    foreign key (organization_id,campground_id,case_id)
    references public.camper_assistance_cases(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint camper_assistance_case_events_visibility_check
    check (
      not guest_visible
      or event_kind in ('guest_message','closed')
    )
);

create index camper_assistance_case_events_scope_case_fk_idx
  on public.camper_assistance_case_events(
    organization_id,
    campground_id,
    case_id
  );

create index camper_assistance_case_events_case_time_idx
  on public.camper_assistance_case_events(case_id,occurred_at desc);

create index camper_assistance_case_events_actor_idx
  on public.camper_assistance_case_events(actor_user_id);

create table public.camper_assistance_escalations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  case_id uuid not null,
  escalation_level text not null
    check (escalation_level in ('main_foreman','manager','owner')),
  state text not null default 'open'
    check (state in ('open','acknowledged','resolved')),
  reason text not null
    check (char_length(trim(reason)) between 3 and 2000),
  raised_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  raised_at timestamptz not null default statement_timestamp(),
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
  constraint camper_assistance_escalations_case_fk
    foreign key (organization_id,campground_id,case_id)
    references public.camper_assistance_cases(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint camper_assistance_escalations_evidence_check
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

create unique index camper_assistance_escalations_active_case_idx
  on public.camper_assistance_escalations(case_id)
  where state in ('open','acknowledged');

create index camper_assistance_escalations_scope_case_fk_idx
  on public.camper_assistance_escalations(
    organization_id,
    campground_id,
    case_id
  );

create index camper_assistance_escalations_queue_idx
  on public.camper_assistance_escalations(
    campground_id,
    state,
    escalation_level,
    raised_at
  );

create index camper_assistance_escalations_raised_by_idx
  on public.camper_assistance_escalations(raised_by_user_id);

create index camper_assistance_escalations_acknowledged_by_idx
  on public.camper_assistance_escalations(acknowledged_by_user_id)
  where acknowledged_by_user_id is not null;

create index camper_assistance_escalations_resolved_by_idx
  on public.camper_assistance_escalations(resolved_by_user_id)
  where resolved_by_user_id is not null;

insert into public.camper_assistance_cases (
  organization_id,
  campground_id,
  request_id,
  operational_category,
  operational_severity,
  updated_by_user_id
)
select
  r.organization_id,
  r.campground_id,
  r.id,
  r.category,
  r.severity,
  r.guest_user_id
from public.camper_assistance_requests r
on conflict (request_id) do nothing;

create trigger camper_assistance_cases_touch
before update on public.camper_assistance_cases
for each row execute function icamp_private.touch_row();

create trigger camper_assistance_escalations_touch
before update on public.camper_assistance_escalations
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.prevent_camper_assistance_case_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Camper assistance operational events are append-only';
end;
$$;

create trigger camper_assistance_case_events_append_only
before update or delete on public.camper_assistance_case_events
for each row execute function icamp_private.prevent_camper_assistance_case_event_mutation();

create or replace function icamp_private.guard_camper_assistance_case_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := icamp_private.request_user_id();

  if old.id is distinct from new.id
     or old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.request_id is distinct from new.request_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Camper assistance case identity is immutable';
  end if;

  if old.case_state = 'closed' then
    raise exception 'Closed camper assistance cases are terminal';
  end if;

  if new.updated_by_user_id is distinct from actor_id then
    raise exception 'updated_by_user_id must match the request actor';
  end if;

  if not (
    icamp_private.has_campground_permission(
      new.campground_id,
      'assistance.triage'
    )
    or icamp_private.has_campground_permission(
      new.campground_id,
      'assistance.escalate'
    )
    or icamp_private.has_campground_permission(
      new.campground_id,
      'assistance.close'
    )
    or icamp_private.has_campground_permission(
      new.campground_id,
      'campground.operations.manage'
    )
  ) then
    raise exception 'Camper assistance case update permission is required';
  end if;

  return new;
end;
$$;

create trigger camper_assistance_cases_guard_update
before update on public.camper_assistance_cases
for each row execute function icamp_private.guard_camper_assistance_case_update();

create or replace function icamp_private.guard_camper_assistance_escalation_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := icamp_private.request_user_id();

  if old.id is distinct from new.id
     or old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.case_id is distinct from new.case_id
     or old.escalation_level is distinct from new.escalation_level
     or old.reason is distinct from new.reason
     or old.raised_by_user_id is distinct from new.raised_by_user_id
     or old.raised_at is distinct from new.raised_at then
    raise exception 'Camper assistance escalation raise evidence is immutable';
  end if;

  if old.state = 'resolved' then
    raise exception 'Resolved camper assistance escalations are terminal';
  end if;

  if not (
    icamp_private.has_campground_permission(
      new.campground_id,
      'assistance.escalate'
    )
    or icamp_private.has_campground_permission(
      new.campground_id,
      'campground.operations.manage'
    )
  ) then
    raise exception 'assistance.escalate permission is required';
  end if;

  if new.state = 'acknowledged' then
    if old.state <> 'open'
       or new.acknowledged_by_user_id is distinct from actor_id
       or new.acknowledged_at is null then
      raise exception 'Valid escalation acknowledgement evidence is required';
    end if;
  elsif new.state = 'resolved' then
    if new.resolved_by_user_id is distinct from actor_id
       or new.resolved_at is null
       or new.resolution_note is null then
      raise exception 'Valid escalation resolution evidence is required';
    end if;
  elsif new.state is distinct from old.state then
    raise exception 'Invalid camper assistance escalation transition';
  end if;

  return new;
end;
$$;

create trigger camper_assistance_escalations_guard_update
before update on public.camper_assistance_escalations
for each row execute function icamp_private.guard_camper_assistance_escalation_update();

alter table public.camper_assistance_cases enable row level security;
alter table public.camper_assistance_cases force row level security;
alter table public.camper_assistance_case_events enable row level security;
alter table public.camper_assistance_case_events force row level security;
alter table public.camper_assistance_escalations enable row level security;
alter table public.camper_assistance_escalations force row level security;

revoke all on
  public.camper_assistance_cases,
  public.camper_assistance_case_events,
  public.camper_assistance_escalations
from public;

do $build078_direct_roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname=role_name) then
      execute format(
        'revoke all on public.camper_assistance_cases, public.camper_assistance_case_events, public.camper_assistance_escalations from %I',
        role_name
      );
    end if;
  end loop;
end
$build078_direct_roles$;

grant select,insert,update on public.camper_assistance_cases to icamp_app;
grant select,insert on public.camper_assistance_case_events to icamp_app;
grant select,insert,update on public.camper_assistance_escalations to icamp_app;

create policy camper_assistance_cases_read
on public.camper_assistance_cases
for select
to icamp_app
using (
  exists (
    select 1
    from public.camper_assistance_requests r
    where r.id = camper_assistance_cases.request_id
      and r.organization_id = camper_assistance_cases.organization_id
      and r.campground_id = camper_assistance_cases.campground_id
      and (
        r.guest_user_id = icamp_private.request_user_id()
        or icamp_private.has_campground_permission(
          r.campground_id,
          'assistance.triage'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'assistance.escalate'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'assistance.communicate'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'assistance.close'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'campground.operations.manage'
        )
      )
  )
);

create policy camper_assistance_cases_insert
on public.camper_assistance_cases
for insert
to icamp_app
with check (
  updated_by_user_id = icamp_private.request_user_id()
  and exists (
    select 1
    from public.camper_assistance_requests r
    where r.id = camper_assistance_cases.request_id
      and r.organization_id = camper_assistance_cases.organization_id
      and r.campground_id = camper_assistance_cases.campground_id
      and (
        r.guest_user_id = icamp_private.request_user_id()
        or icamp_private.has_campground_permission(
          r.campground_id,
          'assistance.triage'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'campground.operations.manage'
        )
      )
  )
);

create policy camper_assistance_cases_update
on public.camper_assistance_cases
for update
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'assistance.triage'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'assistance.escalate'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'assistance.close'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
)
with check (
  updated_by_user_id = icamp_private.request_user_id()
  and (
    icamp_private.has_campground_permission(
      campground_id,
      'assistance.triage'
    )
    or icamp_private.has_campground_permission(
      campground_id,
      'assistance.escalate'
    )
    or icamp_private.has_campground_permission(
      campground_id,
      'assistance.close'
    )
    or icamp_private.has_campground_permission(
      campground_id,
      'campground.operations.manage'
    )
  )
);

create policy camper_assistance_case_events_read
on public.camper_assistance_case_events
for select
to icamp_app
using (
  exists (
    select 1
    from public.camper_assistance_cases c
    join public.camper_assistance_requests r
      on r.id = c.request_id
     and r.organization_id = c.organization_id
     and r.campground_id = c.campground_id
    where c.id = camper_assistance_case_events.case_id
      and c.organization_id =
        camper_assistance_case_events.organization_id
      and c.campground_id =
        camper_assistance_case_events.campground_id
      and (
        (
          camper_assistance_case_events.guest_visible
          and r.guest_user_id = icamp_private.request_user_id()
        )
        or icamp_private.has_campground_permission(
          c.campground_id,
          'assistance.triage'
        )
        or icamp_private.has_campground_permission(
          c.campground_id,
          'assistance.escalate'
        )
        or icamp_private.has_campground_permission(
          c.campground_id,
          'assistance.communicate'
        )
        or icamp_private.has_campground_permission(
          c.campground_id,
          'assistance.close'
        )
        or icamp_private.has_campground_permission(
          c.campground_id,
          'campground.operations.manage'
        )
      )
  )
);

create policy camper_assistance_case_events_insert
on public.camper_assistance_case_events
for insert
to icamp_app
with check (
  actor_user_id = icamp_private.request_user_id()
  and (
    icamp_private.has_campground_permission(
      campground_id,
      'assistance.triage'
    )
    or icamp_private.has_campground_permission(
      campground_id,
      'assistance.escalate'
    )
    or icamp_private.has_campground_permission(
      campground_id,
      'assistance.communicate'
    )
    or icamp_private.has_campground_permission(
      campground_id,
      'assistance.close'
    )
    or icamp_private.has_campground_permission(
      campground_id,
      'campground.operations.manage'
    )
  )
);

create policy camper_assistance_escalations_read
on public.camper_assistance_escalations
for select
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'assistance.escalate'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

create policy camper_assistance_escalations_insert
on public.camper_assistance_escalations
for insert
to icamp_app
with check (
  raised_by_user_id = icamp_private.request_user_id()
  and (
    icamp_private.has_campground_permission(
      campground_id,
      'assistance.escalate'
    )
    or icamp_private.has_campground_permission(
      campground_id,
      'campground.operations.manage'
    )
  )
);

create policy camper_assistance_escalations_update
on public.camper_assistance_escalations
for update
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'assistance.escalate'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
)
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'assistance.escalate'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

create policy camper_assistance_requests_build078_staff_read
on public.camper_assistance_requests
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'assistance.triage')
  or icamp_private.has_campground_permission(campground_id,'assistance.escalate')
  or icamp_private.has_campground_permission(campground_id,'assistance.communicate')
  or icamp_private.has_campground_permission(campground_id,'assistance.close')
);

create policy camper_assistance_request_events_build078_staff_read
on public.camper_assistance_request_events
for select
to icamp_app
using (
  exists (
    select 1
    from public.camper_assistance_requests r
    where r.id=camper_assistance_request_events.request_id
      and r.organization_id=camper_assistance_request_events.organization_id
      and r.campground_id=camper_assistance_request_events.campground_id
      and (
        icamp_private.has_campground_permission(r.campground_id,'assistance.triage')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.escalate')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.communicate')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.close')
      )
  )
);

create policy camper_assistance_request_media_build078_staff_read
on public.camper_assistance_request_media
for select
to icamp_app
using (
  exists (
    select 1
    from public.camper_assistance_requests r
    where r.id=camper_assistance_request_media.request_id
      and r.organization_id=camper_assistance_request_media.organization_id
      and r.campground_id=camper_assistance_request_media.campground_id
      and (
        icamp_private.has_campground_permission(r.campground_id,'assistance.triage')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.escalate')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.communicate')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.close')
      )
  )
);

comment on table public.camper_assistance_cases is
  'Build 078 operational projection over immutable Build 077 camper assistance intake.';

comment on table public.camper_assistance_case_events is
  'Build 078 append-only triage, assignment, escalation, guest communication and closure evidence.';

comment on table public.camper_assistance_escalations is
  'Build 078 explicit management escalation evidence. Escalation does not imply emergency-services dispatch.';
