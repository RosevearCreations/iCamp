-- iCamp Build 049
-- Front Desk Check-In.

create table public.reservation_check_ins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_profile_id uuid,
  prior_reservation_status text not null
    check (prior_reservation_status in ('pending','confirmed')),
  verified_occupant_count smallint not null
    check (verified_occupant_count between 1 and 80),
  verified_visitor_count smallint not null default 0
    check (verified_visitor_count between 0 and 80),
  verified_pet_count smallint not null default 0
    check (verified_pet_count between 0 and 20),
  verified_vehicle_count smallint not null default 0
    check (verified_vehicle_count between 0 and 20),
  reservation_total_cents integer not null
    check (reservation_total_cents between 0 and 200000000),
  expected_payable_cents integer not null
    check (expected_payable_cents between 0 and 300000000),
  captured_cents bigint not null
    check (captured_cents between 0 and 400000000),
  outstanding_balance_cents bigint not null
    check (outstanding_balance_cents between 0 and 400000000),
  balance_override_used boolean not null default false,
  balance_override_reason text
    check (
      balance_override_reason is null
      or char_length(trim(balance_override_reason)) between 3 and 1000
    ),
  rules_acknowledged_at timestamptz not null,
  saved_stay_snapshot jsonb not null default '{"vehicles":[],"pets":[]}'::jsonb
    check (jsonb_typeof(saved_stay_snapshot) = 'object'),
  credential_request_count smallint not null default 0
    check (credential_request_count between 0 and 20),
  credential_handoff_state text not null default 'not_requested'
    check (credential_handoff_state in ('not_requested','requested')),
  source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','system')),
  notes text
    check (notes is null or char_length(notes) <= 2000),
  checked_in_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  checked_in_at timestamptz not null default statement_timestamp(),
  constraint reservation_check_ins_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint reservation_check_ins_reservation_unique
    unique (reservation_id),
  constraint reservation_check_ins_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_check_ins_guest_profile_fk
    foreign key (organization_id,campground_id,guest_profile_id)
    references public.guest_profiles(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_check_ins_balance_check
    check (
      outstanding_balance_cents =
        greatest(expected_payable_cents::bigint - captured_cents,0)
    ),
  constraint reservation_check_ins_override_shape_check
    check (
      (not balance_override_used and balance_override_reason is null)
      or
      (balance_override_used and balance_override_reason is not null)
    ),
  constraint reservation_check_ins_credential_shape_check
    check (
      (credential_request_count = 0 and credential_handoff_state = 'not_requested')
      or
      (credential_request_count > 0 and credential_handoff_state = 'requested')
    )
);

create index reservation_check_ins_campground_time_idx
  on public.reservation_check_ins(campground_id,checked_in_at desc);

create index reservation_check_ins_guest_profile_fk_idx
  on public.reservation_check_ins(guest_profile_id)
  where guest_profile_id is not null;

create index reservation_check_ins_checked_in_by_fk_idx
  on public.reservation_check_ins(checked_in_by_user_id);

create table public.reservation_check_in_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  check_in_id uuid not null,
  reservation_id uuid not null,
  request_kind text not null
    check (request_kind in ('rental','store_add_on','access_credential')),
  request_code text not null
    check (char_length(trim(request_code)) between 1 and 80),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 160),
  quantity smallint not null
    check (quantity between 1 and 100),
  fulfillment_state text not null default 'requested'
    check (fulfillment_state = 'requested'),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint reservation_check_in_requests_check_in_fk
    foreign key (organization_id,campground_id,check_in_id)
    references public.reservation_check_ins(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint reservation_check_in_requests_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create index reservation_check_in_requests_check_in_fk_idx
  on public.reservation_check_in_requests(
    organization_id,
    campground_id,
    check_in_id
  );

create index reservation_check_in_requests_reservation_fk_idx
  on public.reservation_check_in_requests(
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_check_in_requests_created_by_fk_idx
  on public.reservation_check_in_requests(created_by_user_id);

create or replace function icamp_private.guard_front_desk_check_in_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Front desk check-in evidence is append-only';
end;
$$;

create trigger reservation_check_ins_append_only
before update or delete on public.reservation_check_ins
for each row execute function icamp_private.guard_front_desk_check_in_evidence();

create trigger reservation_check_in_requests_append_only
before update or delete on public.reservation_check_in_requests
for each row execute function icamp_private.guard_front_desk_check_in_evidence();

alter table public.reservation_check_ins enable row level security;
alter table public.reservation_check_ins force row level security;
alter table public.reservation_check_in_requests enable row level security;
alter table public.reservation_check_in_requests force row level security;

revoke all on
  public.reservation_check_ins,
  public.reservation_check_in_requests
from public;

do $build049_direct_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.reservation_check_ins, public.reservation_check_in_requests from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.reservation_check_ins, public.reservation_check_in_requests from authenticated';
  end if;
end
$build049_direct_roles$;

grant select,insert on
  public.reservation_check_ins,
  public.reservation_check_in_requests
to icamp_app;

create policy reservation_check_ins_read
on public.reservation_check_ins
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);

create policy reservation_check_ins_insert
on public.reservation_check_ins
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'reservation.modify')
  and checked_in_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy reservation_check_in_requests_read
on public.reservation_check_in_requests
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);

create policy reservation_check_in_requests_insert
on public.reservation_check_in_requests
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'reservation.modify')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.reservation_check_ins ci
    where ci.id = check_in_id
      and ci.organization_id = organization_id
      and ci.campground_id = campground_id
      and ci.reservation_id = reservation_id
  )
);

comment on table public.reservation_check_ins is
  'Build 049 immutable front-desk arrival evidence. Formal road-vehicle registration remains Build 053, visitor registration Build 055, access credential issuance Build 056/063, and fulfillment of rental/POS requests remains owned by their later domain builds.';

comment on table public.reservation_check_in_requests is
  'Build 049 append-only arrival handoff requests for rentals, store add-ons and access credential provisioning. Requested does not mean financially charged, issued or fulfilled.';

comment on column public.reservation_check_ins.saved_stay_snapshot is
  'Immutable snapshot of selected Build 048 saved vehicle/pet descriptions used during arrival verification; excludes plate/jurisdiction data and pet medical data.';

comment on column public.reservation_check_ins.balance_override_used is
  'True only when a reservation.override-authorized staff member deliberately checked in with a verified outstanding balance.';
