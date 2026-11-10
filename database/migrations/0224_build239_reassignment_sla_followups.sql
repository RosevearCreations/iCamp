-- Build 239: campground-owned assignment history and SLA follow-up.
-- Worker inbox is a read model over existing dispatches, not another queue.
create table public.service_fulfillment_assignment_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  job_id uuid not null,
  previous_user_id uuid references icamp_private.user_accounts(id),
  assigned_user_id uuid references icamp_private.user_accounts(id),
  assignment_row_version bigint not null check (assignment_row_version >= 1),
  changed_by_user_id uuid not null references icamp_private.user_accounts(id),
  transition_reason text check (transition_reason is null or char_length(transition_reason) <= 300),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id, campground_id, job_id)
    references public.service_fulfillment_jobs(organization_id, campground_id, id)
    on delete restrict,
  unique (campground_id, job_id, assignment_row_version)
);
create index service_fulfillment_assignment_transitions_recent_idx
  on public.service_fulfillment_assignment_transitions
  (campground_id, job_id, recorded_at desc, id desc);

create function icamp_private.record_service_fulfillment_assignment_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous_worker uuid;
  previous_note text;
begin
  if tg_op = 'UPDATE' then
    previous_worker := old.assigned_user_id;
    previous_note := old.assignment_note;
  end if;
  if previous_worker is not distinct from new.assigned_user_id then
    return new;
  end if;
  if previous_worker is not null and
    (char_length(trim(coalesce(new.assignment_note, ''))) = 0
      or trim(coalesce(new.assignment_note, ''))
        = trim(coalesce(previous_note, ''))) then
    raise exception 'A new reason is required when reassigning or removing a worker';
  end if;
  insert into public.service_fulfillment_assignment_transitions
    (organization_id, campground_id, job_id, previous_user_id,
     assigned_user_id, assignment_row_version, changed_by_user_id,
     transition_reason)
  values (new.organization_id, new.campground_id, new.job_id, previous_worker,
          new.assigned_user_id, new.row_version, new.changed_by_user_id,
          nullif(trim(coalesce(new.assignment_note, '')), ''));
  return new;
end;
$$;
create trigger service_fulfillment_assignment_transition_history
after insert or update on public.service_fulfillment_assignments
for each row execute function icamp_private.record_service_fulfillment_assignment_transition();

create table public.service_fulfillment_sla_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  previous_review_id uuid,
  review_state text not null
    check (review_state in ('investigating','awaiting_worker','resolved','reopened')),
  review_note text not null
    check (char_length(trim(review_note)) between 1 and 500),
  exception_signals text[] not null default array['pending']::text[]
    check (cardinality(exception_signals) >= 1),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id, campground_id, dispatch_id)
    references public.service_fulfillment_dispatches(organization_id, campground_id, id)
    on delete restrict,
  foreign key (previous_review_id)
    references public.service_fulfillment_sla_followups(id) on delete restrict,
  unique (dispatch_id, previous_review_id)
);
create unique index service_fulfillment_sla_followups_first_unique_idx
  on public.service_fulfillment_sla_followups(dispatch_id)
  where previous_review_id is null;
create index service_fulfillment_sla_followups_recent_idx
  on public.service_fulfillment_sla_followups
  (campground_id, dispatch_id, reviewed_at desc, id desc);

create function icamp_private.guard_service_fulfillment_sla_followup()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  latest_review_id uuid;
  latest_review_state text;
  source record;
  signals text[] := array[]::text[];
begin
  if new.reviewed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id, 'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id, 'reservation.modify') then
    raise exception 'Campground supervisor authorization is required for SLA follow-up';
  end if;
  select d.acknowledgement_due_at, d.completion_due_at,
         ack.response, ack.recorded_at, j.completed_at
    into source
  from public.service_fulfillment_dispatches d
  join public.service_fulfillment_jobs j on j.id = d.job_id
    and j.organization_id = d.organization_id and j.campground_id = d.campground_id
  left join public.service_fulfillment_dispatch_acknowledgements ack
    on ack.dispatch_id = d.id and ack.organization_id = d.organization_id
    and ack.campground_id = d.campground_id
  where d.id = new.dispatch_id and d.organization_id = new.organization_id
    and d.campground_id = new.campground_id;
  if not found then
    raise exception 'SLA follow-up must reference a campground dispatch';
  end if;
  if source.response = 'needs_support' then
    signals := array_append(signals, 'worker_support_requested');
  end if;
  if source.recorded_at is null and statement_timestamp() > source.acknowledgement_due_at then
    signals := array_append(signals, 'acknowledgement_overdue');
  elsif source.recorded_at > source.acknowledgement_due_at then
    signals := array_append(signals, 'acknowledgement_late');
  end if;
  if source.completion_due_at is not null then
    if source.completed_at is null and statement_timestamp() > source.completion_due_at then
      signals := array_append(signals, 'completion_overdue');
    elsif source.completed_at > source.completion_due_at then
      signals := array_append(signals, 'completion_late');
    end if;
  end if;
  if cardinality(signals) = 0 then
    raise exception 'An evidenced SLA exception is required for follow-up';
  end if;
  select id, review_state into latest_review_id, latest_review_state
  from public.service_fulfillment_sla_followups
  where campground_id = new.campground_id and dispatch_id = new.dispatch_id
  order by reviewed_at desc, id desc limit 1;
  if new.previous_review_id is distinct from latest_review_id then
    raise exception 'SLA follow-up changed. Refresh the review history';
  end if;
  if new.review_state = 'reopened' and
    latest_review_state is distinct from 'resolved' then
    raise exception 'Only a resolved SLA review may be reopened';
  end if;
  new.exception_signals := signals;
  new.reviewed_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_sla_followups_guard
before insert on public.service_fulfillment_sla_followups
for each row execute function icamp_private.guard_service_fulfillment_sla_followup();

alter table public.service_fulfillment_assignment_transitions enable row level security;
alter table public.service_fulfillment_assignment_transitions force row level security;
alter table public.service_fulfillment_sla_followups enable row level security;
alter table public.service_fulfillment_sla_followups force row level security;
revoke all on public.service_fulfillment_assignment_transitions from public;
revoke all on public.service_fulfillment_sla_followups from public;
do $roles$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.service_fulfillment_assignment_transitions from anon;
    revoke all on public.service_fulfillment_sla_followups from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.service_fulfillment_assignment_transitions from authenticated;
    revoke all on public.service_fulfillment_sla_followups from authenticated;
  end if;
end $roles$;
grant select on public.service_fulfillment_assignment_transitions to icamp_app;
grant select, insert on public.service_fulfillment_sla_followups to icamp_app;
create policy service_fulfillment_assignment_transitions_supervisor_read
on public.service_fulfillment_assignment_transitions for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'staff.manage')
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);
create policy service_fulfillment_sla_followups_supervisor_read
on public.service_fulfillment_sla_followups for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'staff.manage')
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);
create policy service_fulfillment_sla_followups_supervisor_insert
on public.service_fulfillment_sla_followups for insert to icamp_app
with check (
  reviewed_by_user_id = icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id, 'staff.manage')
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);
comment on table public.service_fulfillment_assignment_transitions is
  'Build 239 immutable source-triggered assignment changes, beginning at migration installation; no invented history.';
comment on table public.service_fulfillment_sla_followups is
  'Build 239 supervisor-only, append-only SLA exception decision trail, no automated guest messaging or job mutation.';
