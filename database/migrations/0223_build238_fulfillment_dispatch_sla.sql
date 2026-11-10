-- Build 238: explicit campground-owned work handoffs and worker receipts.
-- These records are append-only. They cannot create reservations, charge
-- guests, send messages, or authorize unattended Master Shell actions.
create table public.service_fulfillment_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  job_id uuid not null,
  assigned_user_id uuid not null references icamp_private.user_accounts(id),
  assignment_row_version bigint not null check (assignment_row_version >= 1),
  job_row_version bigint not null check (job_row_version >= 1),
  dispatched_by_user_id uuid not null references icamp_private.user_accounts(id),
  acknowledgement_minutes integer not null
    check (acknowledgement_minutes between 5 and 10080),
  acknowledgement_due_at timestamptz not null,
  completion_due_at timestamptz,
  dispatched_at timestamptz not null default statement_timestamp(),
  unique (organization_id, campground_id, id),
  unique (campground_id, job_id, assignment_row_version, job_row_version),
  foreign key (organization_id, campground_id, job_id)
    references public.service_fulfillment_jobs(organization_id, campground_id, id)
    on delete restrict
);
create index service_fulfillment_dispatches_latest_idx
  on public.service_fulfillment_dispatches
  (campground_id, job_id, dispatched_at desc, id desc);
create index service_fulfillment_dispatches_worker_idx
  on public.service_fulfillment_dispatches
  (campground_id, assigned_user_id, dispatched_at desc);

create function icamp_private.guard_service_fulfillment_dispatch()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_work record;
begin
  if new.dispatched_by_user_id is distinct from
    icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id, 'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id, 'reservation.modify') then
    raise exception 'Authorized campground supervisor required to dispatch';
  end if;
  select j.organization_id, j.row_version as job_version,
         j.job_state, r.status as reservation_status,
         a.assigned_user_id, a.row_version as assignment_version
    into current_work
  from public.service_fulfillment_jobs j
  join public.reservations r on r.id = j.reservation_id
    and r.organization_id = j.organization_id and r.campground_id = j.campground_id
  join public.service_fulfillment_assignments a on a.job_id = j.id
    and a.organization_id = j.organization_id and a.campground_id = j.campground_id
  where j.id = new.job_id and j.campground_id = new.campground_id
    and j.organization_id = new.organization_id
  for share of j, a;
  if not found or current_work.job_state not in ('scheduled','in_progress')
    or current_work.reservation_status not in ('pending','confirmed','checked_in')
    or current_work.assigned_user_id is distinct from new.assigned_user_id
    or current_work.job_version <> new.job_row_version
    or current_work.assignment_version <> new.assignment_row_version then
    raise exception 'Dispatch must match current assigned active campground work';
  end if;
  new.dispatched_at := statement_timestamp();
  new.acknowledgement_due_at := new.dispatched_at
    + (new.acknowledgement_minutes * interval '1 minute');
  if new.completion_due_at is not null and
     (new.completion_due_at <= new.dispatched_at
      or new.completion_due_at > new.dispatched_at + interval '400 days') then
    raise exception 'Completion target must be future and within 400 days';
  end if;
  return new;
end;
$$;
create trigger service_fulfillment_dispatches_guard
before insert on public.service_fulfillment_dispatches
for each row execute function icamp_private.guard_service_fulfillment_dispatch();

create table public.service_fulfillment_dispatch_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null unique,
  acknowledged_by_user_id uuid not null references icamp_private.user_accounts(id),
  response text not null check (response in ('accepted','needs_support')),
  response_note text check (response_note is null or char_length(response_note) <= 300),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id, campground_id, dispatch_id)
    references public.service_fulfillment_dispatches(organization_id, campground_id, id)
    on delete restrict,
  check (response <> 'needs_support' or char_length(trim(coalesce(response_note, ''))) >= 1)
);
create index service_fulfillment_acknowledgements_scope_idx
  on public.service_fulfillment_dispatch_acknowledgements
  (campground_id, dispatch_id, recorded_at desc);

create function icamp_private.guard_service_fulfillment_dispatch_acknowledgement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_dispatch record;
begin
  if new.acknowledged_by_user_id is distinct from
    icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id, 'reservation.modify') then
    raise exception 'Authorized campground worker required';
  end if;
  select d.assigned_user_id, d.assignment_row_version, d.job_row_version,
         j.row_version as current_job_version, j.job_state,
         a.assigned_user_id as current_worker, a.row_version as current_assignment_version,
         r.status as reservation_status
    into current_dispatch
  from public.service_fulfillment_dispatches d
  join public.service_fulfillment_jobs j on j.id = d.job_id
    and j.organization_id = d.organization_id and j.campground_id = d.campground_id
  join public.service_fulfillment_assignments a on a.job_id = j.id
    and a.organization_id = j.organization_id and a.campground_id = j.campground_id
  join public.reservations r on r.id = j.reservation_id
    and r.organization_id = j.organization_id and r.campground_id = j.campground_id
  where d.id = new.dispatch_id and d.campground_id = new.campground_id
    and d.organization_id = new.organization_id
  for share of j, a;
  if not found or current_dispatch.assigned_user_id <> new.acknowledged_by_user_id
    or current_dispatch.current_worker <> new.acknowledged_by_user_id
    or current_dispatch.assignment_row_version <> current_dispatch.current_assignment_version
    or current_dispatch.job_row_version <> current_dispatch.current_job_version
    or current_dispatch.job_state not in ('scheduled','in_progress')
    or current_dispatch.reservation_status not in ('pending','confirmed','checked_in') then
    raise exception 'Only current assigned work may be acknowledged';
  end if;
  new.recorded_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_acknowledgements_guard
before insert on public.service_fulfillment_dispatch_acknowledgements
for each row execute function icamp_private.guard_service_fulfillment_dispatch_acknowledgement();

alter table public.service_fulfillment_dispatches enable row level security;
alter table public.service_fulfillment_dispatches force row level security;
alter table public.service_fulfillment_dispatch_acknowledgements enable row level security;
alter table public.service_fulfillment_dispatch_acknowledgements force row level security;
revoke all on public.service_fulfillment_dispatches from public;
revoke all on public.service_fulfillment_dispatch_acknowledgements from public;
do $roles$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.service_fulfillment_dispatches from anon;
    revoke all on public.service_fulfillment_dispatch_acknowledgements from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.service_fulfillment_dispatches from authenticated;
    revoke all on public.service_fulfillment_dispatch_acknowledgements from authenticated;
  end if;
end $roles$;
grant select, insert on public.service_fulfillment_dispatches to icamp_app;
grant select, insert on public.service_fulfillment_dispatch_acknowledgements to icamp_app;

create policy service_fulfillment_dispatches_read
on public.service_fulfillment_dispatches for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  and (assigned_user_id = icamp_private.request_user_id()
    or icamp_private.has_campground_permission(campground_id, 'staff.manage'))
);
create policy service_fulfillment_dispatches_insert
on public.service_fulfillment_dispatches for insert to icamp_app
with check (
  dispatched_by_user_id = icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  and icamp_private.has_campground_permission(campground_id, 'staff.manage')
);
create policy service_fulfillment_acknowledgements_read
on public.service_fulfillment_dispatch_acknowledgements for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  and (acknowledged_by_user_id = icamp_private.request_user_id()
    or icamp_private.has_campground_permission(campground_id, 'staff.manage'))
);
create policy service_fulfillment_acknowledgements_insert
on public.service_fulfillment_dispatch_acknowledgements for insert to icamp_app
with check (
  acknowledged_by_user_id = icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);

comment on table public.service_fulfillment_dispatches is
  'Build 238 immutable campground supervisor-to-worker dispatch handoff. Explicit acknowledgement and completion targets, not an automated notification or clock-in.';
comment on table public.service_fulfillment_dispatch_acknowledgements is
  'Build 238 immutable receipt from the currently assigned campground worker. No guest messaging, payment, or booking mutation.';
