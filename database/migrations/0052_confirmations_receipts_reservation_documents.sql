-- iCamp Build 043
-- Confirmations, Receipts & Reservation Documents.

create table public.reservation_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  payment_schedule_id uuid not null,
  confirmation_number text not null
    check (confirmation_number ~ '^IC-[A-Z0-9]{8,24}$'),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  reservation_total_cents integer not null
    check (reservation_total_cents >= 0),
  booking_due_cents integer not null
    check (booking_due_cents >= 0),
  captured_at_confirmation_cents integer not null
    check (captured_at_confirmation_cents >= 0),
  security_deposit_cents integer not null
    check (security_deposit_cents >= 0),
  balance_due_date date not null,
  document_snapshot jsonb not null
    check (jsonb_typeof(document_snapshot) = 'object'),
  confirmed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint reservation_confirmations_reservation_unique
    unique (reservation_id),
  constraint reservation_confirmations_number_unique
    unique (campground_id, confirmation_number),
  constraint reservation_confirmations_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint reservation_confirmations_schedule_fk
    foreign key (organization_id, campground_id, payment_schedule_id)
    references public.reservation_payment_schedules(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict
);

create index reservation_confirmations_scope_fk_idx
  on public.reservation_confirmations (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_confirmations_schedule_fk_idx
  on public.reservation_confirmations (
    organization_id,
    campground_id,
    payment_schedule_id
  );

create index reservation_confirmations_guest_idx
  on public.reservation_confirmations (guest_user_id, confirmed_at desc);

create table public.reservation_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  confirmation_id uuid not null
    references public.reservation_confirmations(id)
    on update cascade
    on delete restrict,
  invoice_number text not null
    check (invoice_number ~ '^INV-[A-Z0-9]{8,24}$'),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  reservation_amount_cents integer not null
    check (reservation_amount_cents >= 0),
  security_deposit_cents integer not null
    check (security_deposit_cents >= 0),
  total_payable_cents integer not null
    check (
      total_payable_cents =
        reservation_amount_cents + security_deposit_cents
    ),
  document_snapshot jsonb not null
    check (jsonb_typeof(document_snapshot) = 'object'),
  issued_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint reservation_invoices_reservation_unique
    unique (reservation_id),
  constraint reservation_invoices_number_unique
    unique (campground_id, invoice_number),
  constraint reservation_invoices_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index reservation_invoices_scope_fk_idx
  on public.reservation_invoices (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_invoices_guest_idx
  on public.reservation_invoices (guest_user_id, issued_at desc);

create index reservation_invoices_confirmation_fk_idx
  on public.reservation_invoices (confirmation_id);

create table public.reservation_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  payment_id uuid not null
    references public.reservation_payments(id)
    on update cascade
    on delete restrict,
  receipt_number text not null
    check (receipt_number ~ '^RCT-[A-Z0-9]{8,24}$'),
  payment_purpose text not null
    check (
      payment_purpose in (
        'booking_due',
        'balance',
        'security_deposit'
      )
    ),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  amount_cents integer not null
    check (amount_cents > 0),
  document_snapshot jsonb not null
    check (jsonb_typeof(document_snapshot) = 'object'),
  issued_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint reservation_receipts_payment_unique
    unique (payment_id),
  constraint reservation_receipts_number_unique
    unique (campground_id, receipt_number),
  constraint reservation_receipts_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index reservation_receipts_scope_fk_idx
  on public.reservation_receipts (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_receipts_guest_idx
  on public.reservation_receipts (guest_user_id, issued_at desc);

alter table public.reservation_confirmations enable row level security;
alter table public.reservation_confirmations force row level security;
alter table public.reservation_invoices enable row level security;
alter table public.reservation_invoices force row level security;
alter table public.reservation_receipts enable row level security;
alter table public.reservation_receipts force row level security;

revoke all on
  public.reservation_confirmations,
  public.reservation_invoices,
  public.reservation_receipts
from public;

do $build043_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.reservation_confirmations, public.reservation_invoices, public.reservation_receipts from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.reservation_confirmations, public.reservation_invoices, public.reservation_receipts from authenticated';
  end if;
end
$build043_direct_roles$;

grant select on
  public.reservation_confirmations,
  public.reservation_invoices,
  public.reservation_receipts
to icamp_app;

create policy reservation_confirmations_read
on public.reservation_confirmations
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

create policy reservation_invoices_read
on public.reservation_invoices
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

create policy reservation_receipts_read
on public.reservation_receipts
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

comment on table public.reservation_confirmations is
  'Immutable Build 043 reservation confirmation evidence created only after the Build 042 booking-time payment obligation is satisfied.';
comment on table public.reservation_invoices is
  'Immutable Build 043 reservation invoice snapshot derived from the accepted Build 041 quote and Build 042 payment schedule.';
comment on table public.reservation_receipts is
  'Immutable Build 043 receipt evidence; one receipt per captured Build 042 payment attempt.';
