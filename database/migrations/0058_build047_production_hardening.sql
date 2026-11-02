-- iCamp Build 047 production hardening.
-- Tighten long-term authorization/evidence and complete permanent-unit integration.

alter table public.seasonal_assignments
  add column winterization_required boolean not null default false;

alter table public.seasonal_assignment_events
  add column source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','import','system'));

alter table public.rate_plans
  drop constraint if exists rate_plans_accommodation_kind_check;

alter table public.rate_plans
  add constraint rate_plans_accommodation_kind_check
  check (
    accommodation_kind is null
    or accommodation_kind in ('campsite','rental_cottage','permanent_unit')
  );

create or replace function icamp_private.guard_seasonal_assignment_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.accommodation_id is distinct from new.accommodation_id
    or old.starts_on is distinct from new.starts_on
    or old.ends_on is distinct from new.ends_on
    or old.assignment_kind is distinct from new.assignment_kind
    or old.rate_plan_id is distinct from new.rate_plan_id
    or old.charge_amount_cents is distinct from new.charge_amount_cents
    or old.currency_code is distinct from new.currency_code
    or old.charge_due_on is distinct from new.charge_due_on then
    raise exception 'Long-term assignment identity and charge snapshot are immutable after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists seasonal_assignments_guard_identity
  on public.seasonal_assignments;
create trigger seasonal_assignments_guard_identity
before update on public.seasonal_assignments
for each row execute function icamp_private.guard_seasonal_assignment_identity();

create or replace function icamp_private.guard_seasonal_assignment_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Seasonal assignment lifecycle evidence is append-only';
end;
$$;

drop trigger if exists seasonal_assignment_events_append_only
  on public.seasonal_assignment_events;
create trigger seasonal_assignment_events_append_only
before update or delete on public.seasonal_assignment_events
for each row execute function icamp_private.guard_seasonal_assignment_event();

drop policy if exists seasonal_assignments_read on public.seasonal_assignments;
drop policy if exists seasonal_assignments_write on public.seasonal_assignments;
drop policy if exists seasonal_assignments_update on public.seasonal_assignments;

create policy seasonal_assignments_read
on public.seasonal_assignments
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
);

create policy seasonal_assignments_write
on public.seasonal_assignments
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy seasonal_assignments_update
on public.seasonal_assignments
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

drop policy if exists seasonal_assignment_events_read
  on public.seasonal_assignment_events;
drop policy if exists seasonal_assignment_events_write
  on public.seasonal_assignment_events;

create policy seasonal_assignment_events_read
on public.seasonal_assignment_events
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
);

create policy seasonal_assignment_events_write
on public.seasonal_assignment_events
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  and actor_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

drop policy if exists rate_plans_read on public.rate_plans;

create policy rate_plans_read
on public.rate_plans
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'pricing.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
  or icamp_private.has_campground_permission(campground_id,'seasonal.manage')
);

comment on column public.seasonal_assignments.winterization_required is
  'Build 047 stable handoff flag for later winterization/readiness workflows.';
comment on column public.seasonal_assignment_events.source_channel is
  'Canonical channel that initiated the long-term lifecycle event.';
comment on function icamp_private.guard_seasonal_assignment_identity() is
  'Build 047 prevents later mutation of canonical site/term/package charge evidence; lifecycle state remains independently transitionable.';
