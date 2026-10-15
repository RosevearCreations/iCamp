-- iCamp Build 042
-- Deposits, Balances & Payment Provider Adapter.

create table public.campground_payment_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  deposit_mode text not null default 'full'
    check (deposit_mode in ('full','fixed','percentage')),
  deposit_fixed_cents integer
    check (deposit_fixed_cents between 1 and 100000000),
  deposit_percentage_basis_points integer
    check (deposit_percentage_basis_points between 1 and 10000),
  security_deposit_cents integer not null default 0
    check (security_deposit_cents between 0 and 100000000),
  security_deposit_due_stage text not null default 'with_deposit'
    check (
      security_deposit_due_stage in (
        'with_deposit',
        'with_balance',
        'on_arrival'
      )
    ),
  balance_due_mode text not null default 'at_booking'
    check (
      balance_due_mode in (
        'at_booking',
        'days_before_arrival',
        'on_arrival'
      )
    ),
  balance_due_days_before_arrival smallint
    check (balance_due_days_before_arrival between 1 and 365),
  currency_code text not null default 'CAD'
    check (currency_code ~ '^[A-Z]{3}$'),
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_payment_policies_scope_unique
    unique (organization_id, campground_id),
  constraint campground_payment_policies_campground_unique
    unique (campground_id),
  constraint campground_payment_policies_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_payment_policies_deposit_shape_check
    check (
      (deposit_mode = 'full'
        and deposit_fixed_cents is null
        and deposit_percentage_basis_points is null)
      or
      (deposit_mode = 'fixed'
        and deposit_fixed_cents is not null
        and deposit_percentage_basis_points is null)
      or
      (deposit_mode = 'percentage'
        and deposit_fixed_cents is null
        and deposit_percentage_basis_points is not null)
    ),
  constraint campground_payment_policies_balance_shape_check
    check (
      (balance_due_mode = 'days_before_arrival'
        and balance_due_days_before_arrival is not null)
      or
      (balance_due_mode <> 'days_before_arrival'
        and balance_due_days_before_arrival is null)
    )
);

create trigger campground_payment_policies_touch_row
before update on public.campground_payment_policies
for each row execute function icamp_private.touch_row();

create index campground_payment_policies_updated_by_idx
  on public.campground_payment_policies (updated_by_user_id)
  where updated_by_user_id is not null;

create table public.reservation_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  payment_policy_id uuid
    references public.campground_payment_policies(id)
    on update cascade
    on delete restrict,
  policy_snapshot jsonb not null,
  booking_date date not null,
  arrival_date date not null,
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  reservation_total_cents integer not null
    check (reservation_total_cents between 0 and 100000000),
  booking_deposit_cents integer not null
    check (booking_deposit_cents between 0 and 100000000),
  reservation_balance_cents integer not null
    check (reservation_balance_cents between 0 and 100000000),
  security_deposit_cents integer not null
    check (security_deposit_cents between 0 and 100000000),
  security_deposit_due_stage text not null
    check (
      security_deposit_due_stage in (
        'with_deposit',
        'with_balance',
        'on_arrival'
      )
    ),
  balance_due_mode text not null
    check (
      balance_due_mode in (
        'at_booking',
        'days_before_arrival',
        'on_arrival'
      )
    ),
  balance_due_date date not null,
  booking_due_cents integer not null
    check (booking_due_cents between 0 and 200000000),
  total_payable_cents integer not null
    check (total_payable_cents between 0 and 200000000),
  created_at timestamptz not null default statement_timestamp(),
  constraint reservation_payment_schedules_reservation_unique
    unique (reservation_id),
  constraint reservation_payment_schedules_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint reservation_payment_schedules_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint reservation_payment_schedules_total_check
    check (
      reservation_total_cents =
        booking_deposit_cents + reservation_balance_cents
      and total_payable_cents =
        reservation_total_cents + security_deposit_cents
      and booking_due_cents <= total_payable_cents
    )
);

create index reservation_payment_schedules_guest_idx
  on public.reservation_payment_schedules (guest_user_id, created_at desc);

create index reservation_payment_schedules_policy_idx
  on public.reservation_payment_schedules (payment_policy_id)
  where payment_policy_id is not null;

create table public.reservation_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  payment_schedule_id uuid not null,
  guest_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_payment_reference text,
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 16 and 240),
  payment_purpose text not null
    check (
      payment_purpose in (
        'booking_due',
        'balance',
        'security_deposit'
      )
    ),
  amount_cents integer not null
    check (amount_cents between 1 and 200000000),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  payment_state text not null default 'created'
    check (
      payment_state in (
        'created',
        'submitted',
        'authorized',
        'captured',
        'failed',
        'cancelled'
      )
    ),
  last_error_code text,
  authorized_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint reservation_payments_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint reservation_payments_schedule_fk
    foreign key (organization_id, campground_id, payment_schedule_id)
    references public.reservation_payment_schedules(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint reservation_payments_idempotency_unique
    unique (campground_id, idempotency_key)
);

create trigger reservation_payments_touch_row
before update on public.reservation_payments
for each row execute function icamp_private.touch_row();

create unique index reservation_payments_provider_reference_uidx
  on public.reservation_payments (provider_key, provider_payment_reference)
  where provider_payment_reference is not null;

create index reservation_payments_reservation_state_idx
  on public.reservation_payments (
    reservation_id,
    payment_state,
    created_at desc
  );

create index reservation_payments_guest_idx
  on public.reservation_payments (guest_user_id, created_at desc);

create table icamp_private.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_event_id text not null
    check (char_length(trim(provider_event_id)) between 1 and 240),
  payment_id uuid not null
    references public.reservation_payments(id)
    on update cascade
    on delete restrict,
  event_type text not null
    check (
      event_type in (
        'payment.authorized',
        'payment.captured',
        'payment.failed',
        'payment.cancelled'
      )
    ),
  event_status text not null
    check (char_length(trim(event_status)) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  constraint payment_provider_events_provider_event_unique
    unique (provider_key, provider_event_id)
);

create index payment_provider_events_payment_time_idx
  on icamp_private.payment_provider_events (payment_id, occurred_at desc);

alter table public.campground_payment_policies enable row level security;
alter table public.campground_payment_policies force row level security;
alter table public.reservation_payment_schedules enable row level security;
alter table public.reservation_payment_schedules force row level security;
alter table public.reservation_payments enable row level security;
alter table public.reservation_payments force row level security;

revoke all on
  public.campground_payment_policies,
  public.reservation_payment_schedules,
  public.reservation_payments
from public;

revoke all on icamp_private.payment_provider_events from public;

do $build042_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.campground_payment_policies, public.reservation_payment_schedules, public.reservation_payments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.campground_payment_policies, public.reservation_payment_schedules, public.reservation_payments from authenticated';
  end if;
end
$build042_direct_roles$;

grant select, insert, update on public.campground_payment_policies to icamp_app;
grant select on public.reservation_payment_schedules, public.reservation_payments to icamp_app;

create policy campground_payment_policies_read
on public.campground_payment_policies
for select
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'reservation.read'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'reservation.modify'
  )
);

create policy campground_payment_policies_insert
on public.campground_payment_policies
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
);

create policy campground_payment_policies_update
on public.campground_payment_policies
for update
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
)
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
);

create policy reservation_payment_schedules_read
on public.reservation_payment_schedules
for select
to icamp_app
using (
  guest_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  or icamp_private.has_campground_permission(
    campground_id,
    'reservation.read'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'reservation.modify'
  )
);

create policy reservation_payments_read
on public.reservation_payments
for select
to icamp_app
using (
  guest_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  or icamp_private.has_campground_permission(
    campground_id,
    'reservation.read'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'reservation.modify'
  )
);

comment on table public.campground_payment_policies is
  'Build 042 campground deposit, security-deposit and balance-due configuration. Provider credentials are never stored here.';
comment on table public.reservation_payment_schedules is
  'Immutable Build 042 payment-policy snapshot derived from the Build 041 accepted reservation quote.';
comment on table public.reservation_payments is
  'Build 042 provider-neutral payment attempts. Sensitive payment credentials are never stored.';
comment on table icamp_private.payment_provider_events is
  'Build 042 verified provider-event idempotency ledger; raw webhook bodies and payment credentials are excluded.';
