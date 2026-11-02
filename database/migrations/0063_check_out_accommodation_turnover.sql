-- iCamp Build 050
-- Check-Out & Accommodation Turnover Trigger.

create table public.reservation_check_outs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  check_in_id uuid not null,
  accommodation_id uuid not null,
  prior_reservation_status text not null
    check (prior_reservation_status = 'checked_in'),
  reservation_total_cents integer not null
    check (reservation_total_cents between 0 and 200000000),
  expected_payable_cents integer not null
    check (expected_payable_cents between 0 and 300000000),
  captured_cents bigint not null
    check (captured_cents between 0 and 400000000),
  outstanding_balance_cents bigint not null
    check (outstanding_balance_cents between 0 and 400000000),
  financial_review_required boolean not null default false,
  financial_handoff_state text not null default 'clear'
    check (financial_handoff_state in ('clear','follow_up_required')),
  financial_acknowledged_at timestamptz,
  rental_return_state text not null default 'not_applicable'
    check (
      rental_return_state in (
        'not_applicable',
        'complete',
        'follow_up_required'
      )
    ),
  key_return_state text not null default 'not_applicable'
    check (
      key_return_state in (
        'not_applicable',
        'complete',
        'follow_up_required'
      )
    ),
  credential_return_state text not null default 'not_applicable'
    check (
      credential_return_state in (
        'not_applicable',
        'complete',
        'follow_up_required'
      )
    ),
  return_notes text
    check (return_notes is null or char_length(return_notes) <= 2000),
  departure_notes text
    check (departure_notes is null or char_length(departure_notes) <= 2000),
  accommodation_status_before text not null
    check (
      accommodation_status_before in (
        'available',
        'held',
        'reserved',
        'arriving',
        'occupied',
        'departing',
        'inspection',
        'maintenance',
        'winterized',
        'closed'
      )
    ),
  accommodation_status_after text not null
    check (
      accommodation_status_after in (
        'available',
        'held',
        'reserved',
        'arriving',
        'occupied',
        'departing',
        'inspection',
        'maintenance',
        'winterized',
        'closed'
      )
    ),
  turnover_kind text not null
    check (
      turnover_kind in (
        'cottage_housekeeping',
        'post_departure_inspection'
      )
    ),
  turnover_state text not null
    check (
      turnover_state in (
        'cottage_scheduled',
        'cottage_configuration_required',
        'inspection_required',
        'protected_existing_state'
      )
    ),
  cottage_turnover_id uuid,
  cottage_turnover_template_id uuid,
  source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','system')),
  checked_out_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  checked_out_at timestamptz not null default statement_timestamp(),
  constraint reservation_check_outs_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint reservation_check_outs_reservation_unique
    unique (reservation_id),
  constraint reservation_check_outs_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_check_outs_check_in_fk
    foreign key (organization_id,campground_id,check_in_id)
    references public.reservation_check_ins(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_check_outs_accommodation_fk
    foreign key (organization_id,campground_id,accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_check_outs_cottage_turnover_fk
    foreign key (organization_id,campground_id,cottage_turnover_id)
    references public.cottage_turnovers(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_check_outs_turnover_template_fk
    foreign key (
      organization_id,
      campground_id,
      cottage_turnover_template_id
    )
    references public.cottage_housekeeping_templates(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint reservation_check_outs_balance_check
    check (
      outstanding_balance_cents =
        greatest(expected_payable_cents::bigint - captured_cents,0)
    ),
  constraint reservation_check_outs_financial_shape_check
    check (
      (
        financial_handoff_state = 'clear'
        and outstanding_balance_cents = 0
        and not financial_review_required
        and financial_acknowledged_at is null
      )
      or
      (
        financial_handoff_state = 'follow_up_required'
        and (
          outstanding_balance_cents > 0
          or financial_review_required
        )
        and financial_acknowledged_at is not null
      )
    ),
  constraint reservation_check_outs_turnover_shape_check
    check (
      (
        turnover_state = 'cottage_scheduled'
        and turnover_kind = 'cottage_housekeeping'
        and cottage_turnover_id is not null
        and cottage_turnover_template_id is not null
      )
      or
      (
        turnover_state = 'cottage_configuration_required'
        and turnover_kind = 'cottage_housekeeping'
        and cottage_turnover_id is null
        and cottage_turnover_template_id is null
      )
      or
      (
        turnover_state in (
          'inspection_required',
          'protected_existing_state'
        )
        and turnover_kind = 'post_departure_inspection'
        and cottage_turnover_id is null
        and cottage_turnover_template_id is null
      )
    )
);

create index reservation_check_outs_campground_time_idx
  on public.reservation_check_outs(campground_id,checked_out_at desc);

create index reservation_check_outs_scope_reservation_fk_idx
  on public.reservation_check_outs(
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_check_outs_scope_check_in_fk_idx
  on public.reservation_check_outs(
    organization_id,
    campground_id,
    check_in_id
  );

create index reservation_check_outs_scope_accommodation_fk_idx
  on public.reservation_check_outs(
    organization_id,
    campground_id,
    accommodation_id
  );

create index reservation_check_outs_scope_cottage_turnover_fk_idx
  on public.reservation_check_outs(
    organization_id,
    campground_id,
    cottage_turnover_id
  )
  where cottage_turnover_id is not null;

create index reservation_check_outs_scope_turnover_template_fk_idx
  on public.reservation_check_outs(
    organization_id,
    campground_id,
    cottage_turnover_template_id
  )
  where cottage_turnover_template_id is not null;

create index reservation_check_outs_checked_out_by_fk_idx
  on public.reservation_check_outs(checked_out_by_user_id);

create or replace function icamp_private.guard_reservation_check_out_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Reservation checkout evidence is append-only';
end;
$$;

create trigger reservation_check_outs_append_only
before update or delete on public.reservation_check_outs
for each row
execute function icamp_private.guard_reservation_check_out_evidence();

alter table public.reservation_check_outs enable row level security;
alter table public.reservation_check_outs force row level security;

revoke all on public.reservation_check_outs from public;

do $build050_direct_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.reservation_check_outs from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.reservation_check_outs from authenticated';
  end if;
end
$build050_direct_roles$;

grant select,insert on public.reservation_check_outs to icamp_app;

create policy reservation_check_outs_read
on public.reservation_check_outs
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);

create policy reservation_check_outs_insert
on public.reservation_check_outs
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'reservation.modify')
  and checked_out_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.reservation_check_outs is
  'Build 050 immutable departure evidence. Outstanding balances become financial follow-up rather than preventing physical departure. Cottage checkout may trigger the existing Build 027 departure turnover; campsite cleanup tasking remains Build 074.';

comment on column public.reservation_check_outs.cottage_turnover_id is
  'Existing Build 027 turnover created automatically at checkout when one active departure template is available.';

comment on column public.reservation_check_outs.turnover_state is
  'Operational handoff state only. Build 074 owns campsite cleanup tasks and Build 063 owns canonical credential lifecycle/revocation.';
