-- Build 236: campground-only work ownership and append-only blocker decisions.
-- Bookings, guest records, charges and payment state remain on their own tables.
alter table public.service_fulfillment_jobs
  add constraint service_fulfillment_jobs_tenant_identity_unique
  unique (organization_id, campground_id, id);

create table public.service_fulfillment_assignments (
  job_id uuid primary key,
  organization_id uuid not null,
  campground_id uuid not null,
  assigned_user_id uuid references icamp_private.user_accounts(id) on delete restrict,
  assignment_note text check (assignment_note is null or char_length(assignment_note) <= 300),
  changed_by_user_id uuid not null references icamp_private.user_accounts(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint service_fulfillment_assignments_job_scope_fk
    foreign key (organization_id, campground_id, job_id)
    references public.service_fulfillment_jobs(organization_id, campground_id, id)
    on delete restrict
);

create index service_fulfillment_assignments_workload_idx
  on public.service_fulfillment_assignments
  (campground_id, assigned_user_id) where assigned_user_id is not null;

create function icamp_private.guard_service_fulfillment_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  assigned_job_state text;
begin
  if tg_op = 'UPDATE' and row(old.organization_id, old.campground_id,
    old.job_id, old.created_at) is distinct from
    row(new.organization_id, new.campground_id, new.job_id, new.created_at) then
    raise exception 'Fulfillment assignment scope is immutable';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := statement_timestamp();
    new.row_version := 1;
  end if;
  if new.changed_by_user_id is distinct from
    nullif(pg_catalog.current_setting('icamp.user_id', true), '')::uuid
    or not icamp_private.has_campground_permission(new.campground_id, 'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id, 'reservation.modify') then
    raise exception 'Supervisor authorization is required for fulfillment assignment';
  end if;
  select j.job_state into assigned_job_state
  from public.service_fulfillment_jobs j
  where j.id = new.job_id
    and j.organization_id = new.organization_id
    and j.campground_id = new.campground_id
  for share;
  if not found or assigned_job_state = 'completed' then
    raise exception 'Completed or out-of-scope work cannot be assigned';
  end if;
  if new.assigned_user_id is not null and not exists (
    select 1 from icamp_private.campground_assignments a
    join icamp_private.user_accounts u on u.id = a.user_id
    where a.user_id = new.assigned_user_id
      and a.organization_id = new.organization_id
      and a.campground_id = new.campground_id
      and a.assignment_state = 'active'
      and a.starts_at <= statement_timestamp()
      and (a.ends_at is null or a.ends_at > statement_timestamp())
      and u.account_type = 'staff' and u.account_state = 'active'
      and exists (
        select 1 from icamp_private.campground_assignment_roles ar
        join icamp_private.roles r on r.id = ar.role_id
        join icamp_private.role_permissions rp on rp.role_id = r.id
        where ar.assignment_id = a.id and r.lifecycle_state = 'active'
          and rp.permission_key = 'reservation.modify'
      )
  ) then
    raise exception 'Assigned worker must be active and authorized in this campground';
  end if;
  return new;
end;
$$;

create trigger service_fulfillment_assignments_guard
before insert or update on public.service_fulfillment_assignments
for each row execute function icamp_private.guard_service_fulfillment_assignment();
create trigger service_fulfillment_assignments_touch
before update on public.service_fulfillment_assignments
for each row execute function icamp_private.touch_row();

create table public.service_fulfillment_exception_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  job_id uuid not null,
  blocked_row_version bigint not null check (blocked_row_version >= 1),
  review_state text not null
    check (review_state in ('acknowledged', 'follow_up_required', 'ready_to_reschedule')),
  review_note text not null check (char_length(trim(review_note)) between 1 and 500),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  constraint service_fulfillment_exception_reviews_job_scope_fk
    foreign key (organization_id, campground_id, job_id)
    references public.service_fulfillment_jobs(organization_id, campground_id, id)
    on delete restrict
);
create index service_fulfillment_exception_reviews_latest_idx
  on public.service_fulfillment_exception_reviews
  (campground_id, job_id, blocked_row_version, reviewed_at desc, id desc);

create function icamp_private.guard_service_fulfillment_exception_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_job record;
begin
  if new.reviewed_by_user_id is distinct from
    nullif(pg_catalog.current_setting('icamp.user_id', true), '')::uuid
    or not icamp_private.has_campground_permission(new.campground_id, 'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id, 'reservation.modify') then
    raise exception 'Supervisor authorization is required for exception review';
  end if;
  select j.row_version, j.job_state into current_job
  from public.service_fulfillment_jobs j
  where j.id = new.job_id and j.organization_id = new.organization_id
    and j.campground_id = new.campground_id
  for share;
  if not found or current_job.job_state <> 'blocked'
    or current_job.row_version <> new.blocked_row_version then
    raise exception 'Exception review must reference the current blocked task version';
  end if;
  new.reviewed_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_exception_reviews_guard
before insert on public.service_fulfillment_exception_reviews
for each row execute function icamp_private.guard_service_fulfillment_exception_review();

alter table public.service_fulfillment_assignments enable row level security;
alter table public.service_fulfillment_assignments force row level security;
alter table public.service_fulfillment_exception_reviews enable row level security;
alter table public.service_fulfillment_exception_reviews force row level security;
revoke all on public.service_fulfillment_assignments from public;
revoke all on public.service_fulfillment_exception_reviews from public;
do $roles$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.service_fulfillment_assignments from anon;
    revoke all on public.service_fulfillment_exception_reviews from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.service_fulfillment_assignments from authenticated;
    revoke all on public.service_fulfillment_exception_reviews from authenticated;
  end if;
end $roles$;

grant select, insert, update on public.service_fulfillment_assignments to icamp_app;
grant select, insert on public.service_fulfillment_exception_reviews to icamp_app;
create policy service_fulfillment_assignments_read
  on public.service_fulfillment_assignments for select to icamp_app
  using (icamp_private.has_campground_permission(campground_id, 'reservation.modify'));
create policy service_fulfillment_assignments_insert
  on public.service_fulfillment_assignments for insert to icamp_app
  with check (
    icamp_private.has_campground_permission(campground_id, 'staff.manage')
    and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
    and changed_by_user_id = icamp_private.request_user_id()
  );
create policy service_fulfillment_assignments_update
  on public.service_fulfillment_assignments for update to icamp_app
  using (
    icamp_private.has_campground_permission(campground_id, 'staff.manage')
    and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  )
  with check (
    icamp_private.has_campground_permission(campground_id, 'staff.manage')
    and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
    and changed_by_user_id = icamp_private.request_user_id()
  );
create policy service_fulfillment_exception_reviews_read
  on public.service_fulfillment_exception_reviews for select to icamp_app
  using (
    icamp_private.has_campground_permission(campground_id, 'staff.manage')
    and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  );
create policy service_fulfillment_exception_reviews_insert
  on public.service_fulfillment_exception_reviews for insert to icamp_app
  with check (
    icamp_private.has_campground_permission(campground_id, 'staff.manage')
    and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
    and reviewed_by_user_id = icamp_private.request_user_id()
  );

comment on table public.service_fulfillment_assignments is
  'Build 236 campground-authorized staff work assignment; immutable quoted reservation work and no cross-tenant worker assignment.';
comment on table public.service_fulfillment_exception_reviews is
  'Build 236 append-only, per-blocked-version supervisor exception decisions. Never automatically clears or charges a reservation.';
