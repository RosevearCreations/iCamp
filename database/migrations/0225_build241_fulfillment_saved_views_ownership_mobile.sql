-- Build 241: campground-private supervisor views, audited ownership events,
-- and worker-origin mobile field observations. No signer, connection or
-- independent acceptance is created by these records.
create table public.service_fulfillment_priority_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  owner_user_id uuid not null references icamp_private.user_accounts(id),
  label text not null check (char_length(trim(label)) between 2 and 48),
  priority_filter text not null
    check (priority_filter in ('open','overdue','support','reviewed','history','all')),
  created_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id) on delete restrict
);
create unique index service_fulfillment_saved_view_owner_label_idx
  on public.service_fulfillment_priority_saved_views
  (campground_id, owner_user_id, lower(label));
create index service_fulfillment_saved_view_owner_idx
  on public.service_fulfillment_priority_saved_views
  (campground_id, owner_user_id, created_at desc);

create table public.service_fulfillment_case_owner_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  previous_event_id uuid references public.service_fulfillment_case_owner_events(id),
  claimed_by_user_id uuid references icamp_private.user_accounts(id),
  changed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reason text not null check (char_length(trim(reason)) between 5 and 300),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id, campground_id, dispatch_id)
    references public.service_fulfillment_dispatches(organization_id, campground_id, id)
    on delete restrict,
  unique (dispatch_id, previous_event_id)
);
create unique index service_fulfillment_case_owner_first_idx
  on public.service_fulfillment_case_owner_events(dispatch_id)
  where previous_event_id is null;
create index service_fulfillment_case_owner_latest_idx
  on public.service_fulfillment_case_owner_events(campground_id, dispatch_id, recorded_at desc, id desc);

create table public.service_fulfillment_mobile_field_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  reported_by_user_id uuid not null references icamp_private.user_accounts(id),
  device_kind text not null check (device_kind in ('mobile','tablet','desktop')),
  outcome text not null check (outcome in ('usable','blocked')),
  observation text not null check (char_length(trim(observation)) between 5 and 300),
  reported_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id, campground_id, dispatch_id)
    references public.service_fulfillment_dispatches(organization_id, campground_id, id)
    on delete restrict
);
create index service_fulfillment_mobile_worker_latest_idx
  on public.service_fulfillment_mobile_field_reports
  (campground_id, reported_by_user_id, reported_at desc);
create index service_fulfillment_mobile_case_latest_idx
  on public.service_fulfillment_mobile_field_reports
  (campground_id, dispatch_id, reported_at desc);

create function icamp_private.guard_service_fulfillment_saved_view()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Campground supervisor view owner required';
  end if;
  new.created_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_saved_view_guard
before insert on public.service_fulfillment_priority_saved_views
for each row execute function icamp_private.guard_service_fulfillment_saved_view();

create function icamp_private.guard_service_fulfillment_case_owner_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  latest record;
begin
  if new.changed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify')
    or (new.claimed_by_user_id is not null
      and new.claimed_by_user_id is distinct from new.changed_by_user_id) then
    raise exception 'Only an authorized campground supervisor may claim a case';
  end if;
  select id, claimed_by_user_id into latest
  from public.service_fulfillment_case_owner_events
  where campground_id = new.campground_id and dispatch_id = new.dispatch_id
  order by recorded_at desc, id desc limit 1;
  if new.previous_event_id is distinct from latest.id then
    raise exception 'Case ownership changed. Refresh the source case';
  end if;
  if new.claimed_by_user_id is not distinct from latest.claimed_by_user_id then
    raise exception 'Case ownership must change';
  end if;
  if new.claimed_by_user_id is null and
    latest.claimed_by_user_id is distinct from new.changed_by_user_id then
    raise exception 'Only the current owner may release a case';
  end if;
  new.recorded_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_case_owner_guard
before insert on public.service_fulfillment_case_owner_events
for each row execute function icamp_private.guard_service_fulfillment_case_owner_event();

create function icamp_private.guard_service_fulfillment_mobile_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare current_dispatch record;
begin
  if new.reported_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Private worker device report only';
  end if;
  select d.assigned_user_id, d.assignment_row_version, d.job_row_version,
         a.row_version as current_assignment_version,
         a.assigned_user_id as current_worker,
         j.row_version as current_job_version, j.job_state
    into current_dispatch
  from public.service_fulfillment_dispatches d
  join public.service_fulfillment_jobs j on j.id = d.job_id
    and j.organization_id = d.organization_id and j.campground_id = d.campground_id
  join public.service_fulfillment_assignments a on a.job_id = j.id
    and a.organization_id = j.organization_id and a.campground_id = j.campground_id
  where d.id = new.dispatch_id and d.campground_id = new.campground_id
    and d.organization_id = new.organization_id
  for share of j, a;
  if not found or current_dispatch.assigned_user_id is distinct from new.reported_by_user_id
    or current_dispatch.current_worker is distinct from new.reported_by_user_id
    or current_dispatch.assignment_row_version <> current_dispatch.current_assignment_version
    or current_dispatch.job_row_version <> current_dispatch.current_job_version
    or current_dispatch.job_state not in ('scheduled','in_progress') then
    raise exception 'Device report must reference active assigned work';
  end if;
  new.reported_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_mobile_report_guard
before insert on public.service_fulfillment_mobile_field_reports
for each row execute function icamp_private.guard_service_fulfillment_mobile_report();

alter table public.service_fulfillment_priority_saved_views enable row level security;
alter table public.service_fulfillment_priority_saved_views force row level security;
alter table public.service_fulfillment_case_owner_events enable row level security;
alter table public.service_fulfillment_case_owner_events force row level security;
alter table public.service_fulfillment_mobile_field_reports enable row level security;
alter table public.service_fulfillment_mobile_field_reports force row level security;
revoke all on public.service_fulfillment_priority_saved_views from public;
revoke all on public.service_fulfillment_case_owner_events from public;
revoke all on public.service_fulfillment_mobile_field_reports from public;
do $roles$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.service_fulfillment_priority_saved_views from anon;
    revoke all on public.service_fulfillment_case_owner_events from anon;
    revoke all on public.service_fulfillment_mobile_field_reports from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.service_fulfillment_priority_saved_views from authenticated;
    revoke all on public.service_fulfillment_case_owner_events from authenticated;
    revoke all on public.service_fulfillment_mobile_field_reports from authenticated;
  end if;
end $roles$;
grant select, insert, delete on public.service_fulfillment_priority_saved_views to icamp_app;
grant select, insert on public.service_fulfillment_case_owner_events to icamp_app;
grant select, insert on public.service_fulfillment_mobile_field_reports to icamp_app;
create policy service_fulfillment_saved_view_owner_read
on public.service_fulfillment_priority_saved_views for select to icamp_app
using (owner_user_id = icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_saved_view_owner_insert
on public.service_fulfillment_priority_saved_views for insert to icamp_app
with check (owner_user_id = icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_saved_view_owner_delete
on public.service_fulfillment_priority_saved_views for delete to icamp_app
using (owner_user_id = icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id,'staff.manage'));
create policy service_fulfillment_case_owner_supervisor_read
on public.service_fulfillment_case_owner_events for select to icamp_app
using (icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_case_owner_supervisor_insert
on public.service_fulfillment_case_owner_events for insert to icamp_app
with check (changed_by_user_id = icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_mobile_worker_or_supervisor_read
on public.service_fulfillment_mobile_field_reports for select to icamp_app
using ((reported_by_user_id = icamp_private.request_user_id()
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'))
  or (icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify')));
create policy service_fulfillment_mobile_worker_insert
on public.service_fulfillment_mobile_field_reports for insert to icamp_app
with check (reported_by_user_id = icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
