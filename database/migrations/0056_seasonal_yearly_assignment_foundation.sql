-- iCamp Build 047
-- Seasonal/Yearly Assignment Foundation.

alter table public.seasonal_assignments
  add column assignment_kind text not null default 'seasonal'
    check (assignment_kind in ('seasonal','yearly')),
  add column occupant_display_name text not null default 'Unassigned occupant'
    check (char_length(trim(occupant_display_name)) between 1 and 160),
  add column contact_email text,
  add column occupancy_state text not null default 'assigned'
    check (occupancy_state in ('assigned','temporarily_vacant','winter_closed')),
  add column rate_plan_id uuid references public.rate_plans(id) on update cascade on delete restrict,
  add column charge_amount_cents integer
    check (charge_amount_cents is null or charge_amount_cents >= 0),
  add column currency_code text not null default 'CAD'
    check (currency_code ~ '^[A-Z]{3}$'),
  add column charge_due_on date,
  add column notes text;

alter table public.seasonal_assignments
  add constraint seasonal_assignments_scope_id_unique
  unique (organization_id,campground_id,id);

create table public.seasonal_assignment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  assignment_id uuid not null references public.seasonal_assignments(id)
    on update cascade on delete restrict,
  event_kind text not null
    check (event_kind in ('assigned','winter_closed','reopened','ended','cancelled','charge_recorded')),
  effective_on date not null,
  note text,
  actor_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  constraint seasonal_assignment_events_scope_fk
    foreign key (organization_id,campground_id,assignment_id)
    references public.seasonal_assignments(organization_id,campground_id,id)
    on update cascade on delete restrict
);

create index seasonal_assignments_kind_state_idx
  on public.seasonal_assignments(campground_id,assignment_kind,assignment_state,starts_on,ends_on);
create index seasonal_assignments_rate_plan_fk_idx
  on public.seasonal_assignments(rate_plan_id) where rate_plan_id is not null;
create index seasonal_assignment_events_assignment_idx
  on public.seasonal_assignment_events(assignment_id,effective_on,created_at);
create index seasonal_assignment_events_actor_fk_idx
  on public.seasonal_assignment_events(actor_user_id) where actor_user_id is not null;

alter table public.seasonal_assignment_events enable row level security;
alter table public.seasonal_assignment_events force row level security;

revoke all on public.seasonal_assignment_events from public;
do $build047_direct_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.seasonal_assignment_events from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.seasonal_assignment_events from authenticated';
  end if;
end
$build047_direct_roles$;

grant select,insert on public.seasonal_assignment_events to icamp_app;

create policy seasonal_assignment_events_read
on public.seasonal_assignment_events for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
);

create policy seasonal_assignment_events_write
on public.seasonal_assignment_events for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
  and actor_user_id = nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on column public.seasonal_assignments.assignment_kind is
  'Build 047 long-term assignment kind: seasonal or yearly.';
comment on column public.seasonal_assignments.occupancy_state is
  'Non-nightly operational state. winter_closed remains assigned and continues blocking transient availability.';
comment on column public.seasonal_assignments.charge_amount_cents is
  'Immutable-at-assignment snapshot of the selected Build 039 seasonal/yearly rate. Payment collection is owned by later finance workflows.';
comment on table public.seasonal_assignment_events is
  'Build 047 append-style lifecycle evidence for long-term seasonal/yearly site assignments.';
