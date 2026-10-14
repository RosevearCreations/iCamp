-- iCamp Build 041
-- Reservation Checkout.

alter table public.reservation_holds
  add column checkout_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null;

create index reservation_holds_checkout_user_fk_idx
  on public.reservation_holds (checkout_user_id)
  where checkout_user_id is not null;

create unique index reservation_holds_active_guest_window_uidx
  on public.reservation_holds (
    campground_id,
    checkout_user_id,
    accommodation_id,
    arrival_date,
    departure_date
  )
  where checkout_user_id is not null
    and hold_state = 'active';

create or replace function icamp_private.guard_checkout_hold_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.checkout_user_id is distinct from new.checkout_user_id then
    raise exception 'Checkout hold ownership cannot be reassigned';
  end if;
  return new;
end;
$$;

create trigger reservation_holds_guard_checkout_owner
before update on public.reservation_holds
for each row execute function icamp_private.guard_checkout_hold_owner();

alter table public.reservations
  add column guest_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  add column originating_hold_id uuid
    references public.reservation_holds(id)
    on update cascade
    on delete restrict;

create index reservations_guest_user_fk_idx
  on public.reservations (guest_user_id)
  where guest_user_id is not null;

create unique index reservations_originating_hold_uidx
  on public.reservations (originating_hold_id)
  where originating_hold_id is not null;

create table public.reservation_checkout_details (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  primary_first_name text not null
    check (char_length(trim(primary_first_name)) between 1 and 80),
  primary_last_name text not null
    check (char_length(trim(primary_last_name)) between 1 and 80),
  contact_email text not null
    check (char_length(trim(contact_email)) between 3 and 254),
  contact_phone text not null
    check (char_length(trim(contact_phone)) between 7 and 40),
  occupant_count smallint not null
    check (occupant_count between 1 and 80),
  visitor_count smallint not null default 0
    check (visitor_count between 0 and 80),
  pet_count smallint not null default 0
    check (pet_count between 0 and 20),
  vehicle_count smallint not null default 0
    check (vehicle_count between 0 and 20),
  lodging_kind text not null
    check (lodging_kind in ('tent','rv','cottage')),
  compatibility_request jsonb not null default '{}'::jsonb,
  booking_rules_snapshot jsonb not null,
  pricing_snapshot jsonb not null,
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  stay_subtotal_cents integer not null
    check (stay_subtotal_cents >= 0),
  charge_total_cents integer not null
    check (charge_total_cents >= 0),
  quoted_total_cents integer not null
    check (quoted_total_cents >= 0),
  rules_acknowledged_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint reservation_checkout_details_total_check
    check (quoted_total_cents = stay_subtotal_cents + charge_total_cents),
  constraint reservation_checkout_details_reservation_unique
    unique (reservation_id),
  constraint reservation_checkout_details_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index reservation_checkout_details_scope_fk_idx
  on public.reservation_checkout_details (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_checkout_details_guest_user_fk_idx
  on public.reservation_checkout_details (guest_user_id);

create index reservation_checkout_details_campground_idx
  on public.reservation_checkout_details (campground_id, created_at desc);

create table public.reservation_charge_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  charge_catalog_id uuid
    references public.booking_charge_catalog(id)
    on update cascade
    on delete restrict,
  code text not null
    check (char_length(trim(code)) between 1 and 80),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 160),
  charge_kind text not null
    check (charge_kind in ('add_on','pass','service_fee')),
  application_mode text not null
    check (application_mode in ('optional','automatic')),
  quantity integer not null
    check (quantity between 1 and 1000),
  line_total_cents integer not null
    check (line_total_cents >= 0),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  tax_category_code text,
  fee_category_code text,
  created_at timestamptz not null default statement_timestamp(),
  constraint reservation_charge_lines_code_unique
    unique (reservation_id, code),
  constraint reservation_charge_lines_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index reservation_charge_lines_scope_fk_idx
  on public.reservation_charge_lines (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_charge_lines_guest_user_fk_idx
  on public.reservation_charge_lines (guest_user_id);

create index reservation_charge_lines_catalog_fk_idx
  on public.reservation_charge_lines (charge_catalog_id)
  where charge_catalog_id is not null;

alter table public.reservation_checkout_details enable row level security;
alter table public.reservation_checkout_details force row level security;
alter table public.reservation_charge_lines enable row level security;
alter table public.reservation_charge_lines force row level security;

revoke all on public.reservation_checkout_details, public.reservation_charge_lines from public;

do $build041_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.reservation_checkout_details, public.reservation_charge_lines from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.reservation_checkout_details, public.reservation_charge_lines from authenticated';
  end if;
end
$build041_direct_roles$;

grant select on public.reservation_checkout_details, public.reservation_charge_lines to icamp_app;

create policy reservation_checkout_details_read
on public.reservation_checkout_details
for select
to icamp_app
using (
  guest_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  or icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);

create policy reservation_charge_lines_read
on public.reservation_charge_lines
for select
to icamp_app
using (
  guest_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  or icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);

comment on column public.reservation_holds.checkout_user_id is
  'Build 041 signed-in guest owner for a public reservation-checkout hold. Staff-created holds remain null.';
comment on column public.reservations.guest_user_id is
  'Build 041 guest account that accepted the checkout quote. Reusable guest profiles remain Build 048.';
comment on column public.reservations.originating_hold_id is
  'Build 041 temporary hold atomically converted into this pending reservation; unique for idempotent checkout.';
comment on table public.reservation_checkout_details is
  'Immutable Build 041 checkout snapshot: contact, party counts, compatibility request, rule acknowledgement and final server-authoritative quote.';
comment on table public.reservation_charge_lines is
  'Immutable Build 041 add-on, pass and automatic service-fee line snapshots accepted with the reservation quote.';
