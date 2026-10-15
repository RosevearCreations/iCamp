-- iCamp Build 047
-- Seasonal/Yearly Assignment Foundation.

alter table public.seasonal_assignments
  add column assignment_kind text not null default 'seasonal'
    check (assignment_kind in ('seasonal','yearly')),
  add column occupant_display_name text
    check (
      occupant_display_name is null
      or char_length(trim(occupant_display_name)) between 1 and 160
    ),
  add column winterization_required boolean not null default false,
  add column source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','import','system')),
  add constraint seasonal_assignments_reference_length_check
    check (reference is null or char_length(trim(reference)) <= 160),
  add constraint seasonal_assignments_scope_id_unique
    unique (organization_id, campground_id, id);

alter table public.rate_plans
  drop constraint if exists rate_plans_accommodation_kind_check;

alter table public.rate_plans
  add constraint rate_plans_accommodation_kind_check
  check (
    accommodation_kind is null
    or accommodation_kind in ('campsite','rental_cottage','permanent_unit')
  );

create table public.seasonal_assignment_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  assignment_id uuid not null,
  rate_plan_id uuid not null
    references public.rate_plans(id)
    on update cascade
    on delete restrict,
  rate_plan_code text not null
    check (char_length(trim(rate_plan_code)) between 1 and 120),
  charge_period text not null
    check (charge_period in ('seasonal','yearly')),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  amount_cents integer not null
    check (amount_cents between 0 and 100000000),
  due_on date not null,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint seasonal_assignment_charges_assignment_unique
    unique (assignment_id),
  constraint seasonal_assignment_charges_assignment_fk
    foreign key (organization_id, campground_id, assignment_id)
    references public.seasonal_assignments(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.seasonal_assignment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  assignment_id uuid not null,
  event_kind text not null
    check (event_kind in ('created','ended','cancelled')),
  from_state text
    check (from_state is null or from_state in ('active','ended','cancelled')),
  to_state text not null
    check (to_state in ('active','ended','cancelled')),
  source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','import','system')),
  reason text not null
    check (char_length(trim(reason)) between 3 and 1000),
  recorded_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint seasonal_assignment_events_assignment_fk
    foreign key (organization_id, campground_id, assignment_id)
    references public.seasonal_assignments(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index seasonal_assignments_campground_state_idx
  on public.seasonal_assignments
  (campground_id, assignment_state, starts_on, ends_on, assignment_kind);

create index seasonal_assignment_charges_assignment_fk_idx
  on public.seasonal_assignment_charges
  (organization_id, campground_id, assignment_id);

create index seasonal_assignment_charges_rate_plan_fk_idx
  on public.seasonal_assignment_charges (rate_plan_id);

create index seasonal_assignment_charges_created_by_idx
  on public.seasonal_assignment_charges (created_by_user_id);

create index seasonal_assignment_events_assignment_fk_idx
  on public.seasonal_assignment_events
  (organization_id, campground_id, assignment_id, occurred_at desc);

create index seasonal_assignment_events_recorded_by_idx
  on public.seasonal_assignment_events (recorded_by_user_id);

create or replace function icamp_private.guard_seasonal_assignment_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Seasonal assignment financial/lifecycle evidence is append-only';
end;
$$;

create trigger seasonal_assignment_charges_append_only
before update or delete on public.seasonal_assignment_charges
for each row execute function icamp_private.guard_seasonal_assignment_evidence();

create trigger seasonal_assignment_events_append_only
before update or delete on public.seasonal_assignment_events
for each row execute function icamp_private.guard_seasonal_assignment_evidence();

alter table public.seasonal_assignment_charges enable row level security;
alter table public.seasonal_assignment_charges force row level security;
alter table public.seasonal_assignment_events enable row level security;
alter table public.seasonal_assignment_events force row level security;

revoke all on
  public.seasonal_assignment_charges,
  public.seasonal_assignment_events
from public;

do $build047_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.seasonal_assignment_charges, public.seasonal_assignment_events from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.seasonal_assignment_charges, public.seasonal_assignment_events from authenticated';
  end if;
end
$build047_direct_roles$;

grant select, insert on public.seasonal_assignment_charges to icamp_app;
grant select, insert on public.seasonal_assignment_events to icamp_app;

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

create policy seasonal_assignment_charges_read
on public.seasonal_assignment_charges
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'finance.read')
);

create policy seasonal_assignment_charges_insert
on public.seasonal_assignment_charges
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy seasonal_assignment_events_read
on public.seasonal_assignment_events
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
);

create policy seasonal_assignment_events_insert
on public.seasonal_assignment_events
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage')
  and recorded_by_user_id =
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

comment on table public.seasonal_assignments is
  'Build 035 authoritative long-term availability blocker, extended by Build 047 with seasonal/yearly identity, occupant label, winterization handoff and channel evidence.';
comment on table public.seasonal_assignment_charges is
  'Build 047 immutable seasonal/yearly package-price snapshot selected from Build 039 rate plans. Later finance workflows may reference this source obligation.';
comment on table public.seasonal_assignment_events is
  'Build 047 append-only non-nightly lifecycle evidence for creation, ending and cancellation.';
