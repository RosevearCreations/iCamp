-- iCamp Build 052
-- Stay Extension & Accommodation Move.

create table public.reservation_stay_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  change_history_id uuid not null,
  adjustment_kind text not null
    check (adjustment_kind in ('extend','shorten','move','edit')),
  prior_accommodation_id uuid not null,
  revised_accommodation_id uuid not null,
  prior_arrival_date date not null,
  prior_departure_date date not null,
  revised_arrival_date date not null,
  revised_departure_date date not null,
  availability_rechecked boolean not null default true
    check (availability_rechecked),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  previous_total_cents integer not null
    check (previous_total_cents between 0 and 200000000),
  revised_total_cents integer not null
    check (revised_total_cents between 0 and 200000000),
  delta_cents integer not null
    check (delta_cents between -200000000 and 200000000),
  captured_cents bigint not null
    check (captured_cents between 0 and 400000000),
  financial_review_required boolean not null default false,
  housekeeping_review_required boolean not null default false,
  maintenance_review_required boolean not null default false,
  prior_accommodation_status text,
  revised_accommodation_status text,
  operational_summary text not null
    check (char_length(trim(operational_summary)) between 3 and 1000),
  source_channel text not null default 'web'
    check (source_channel in ('web','staff','ivr','sms','system')),
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 8 and 200),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint reservation_stay_adjustments_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint reservation_stay_adjustments_idempotency_unique
    unique (campground_id,idempotency_key),
  constraint reservation_stay_adjustments_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_stay_adjustments_prior_accommodation_fk
    foreign key (organization_id,campground_id,prior_accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_stay_adjustments_revised_accommodation_fk
    foreign key (organization_id,campground_id,revised_accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_stay_adjustments_change_history_fk
    foreign key (change_history_id)
    references public.reservation_change_history(id)
    on update cascade
    on delete restrict,
  constraint reservation_stay_adjustments_dates_check
    check (
      prior_departure_date > prior_arrival_date
      and revised_departure_date > revised_arrival_date
    ),
  constraint reservation_stay_adjustments_delta_check
    check (delta_cents = revised_total_cents - previous_total_cents)
);

create index reservation_stay_adjustments_reservation_idx
  on public.reservation_stay_adjustments(
    campground_id,
    reservation_id,
    occurred_at desc
  );

create index reservation_stay_adjustments_prior_accommodation_idx
  on public.reservation_stay_adjustments(
    organization_id,
    campground_id,
    prior_accommodation_id
  );

create index reservation_stay_adjustments_revised_accommodation_idx
  on public.reservation_stay_adjustments(
    organization_id,
    campground_id,
    revised_accommodation_id
  );

create index reservation_stay_adjustments_change_history_idx
  on public.reservation_stay_adjustments(change_history_id);

create index reservation_stay_adjustments_actor_idx
  on public.reservation_stay_adjustments(actor_user_id);

create or replace function icamp_private.guard_reservation_stay_adjustment_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Reservation stay-adjustment evidence is append-only';
end;
$$;

create trigger reservation_stay_adjustments_append_only
before update or delete on public.reservation_stay_adjustments
for each row
execute function icamp_private.guard_reservation_stay_adjustment_evidence();

alter table public.reservation_stay_adjustments enable row level security;
alter table public.reservation_stay_adjustments force row level security;

revoke all on public.reservation_stay_adjustments from public;

do $build052_direct_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.reservation_stay_adjustments from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.reservation_stay_adjustments from authenticated';
  end if;
end
$build052_direct_roles$;

grant select,insert on public.reservation_stay_adjustments to icamp_app;

create policy reservation_stay_adjustments_read
on public.reservation_stay_adjustments
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);

create policy reservation_stay_adjustments_insert
on public.reservation_stay_adjustments
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'reservation.modify')
  and actor_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.reservation_stay_adjustments is
  'Build 052 append-only checked-in stay extension/accommodation move evidence. Reservation pricing/change history remains canonical in Build 044; financial execution remains Build 045.';

comment on column public.reservation_stay_adjustments.availability_rechecked is
  'True only after the canonical Build 035 reservation conflict trigger accepts the revised accommodation/date window.';

comment on column public.reservation_stay_adjustments.housekeeping_review_required is
  'Operational handoff signal for changed departure timing or in-stay accommodation moves. Later maintenance/housekeeping builds remain the canonical task authority.';
