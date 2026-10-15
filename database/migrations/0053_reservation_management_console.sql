-- iCamp Build 044
-- Reservation Management Console.

-- Keep live-availability revision signals correct when a reservation moves
-- between accommodations without changing dates/status.
create or replace function icamp_private.bump_reservation_move_availability_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $
begin
  if old.accommodation_id is distinct from new.accommodation_id then
    update public.accommodations
    set availability_revision = availability_revision + 1,
        updated_by_user_id = coalesce(new.updated_by_user_id, updated_by_user_id)
    where id in (old.accommodation_id, new.accommodation_id);
  end if;
  return null;
end;
$;

create trigger reservations_move_bump_availability_revision
after update of accommodation_id on public.reservations
for each row execute function icamp_private.bump_reservation_move_availability_revision();

create table public.reservation_management_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_display_name text not null
    check (char_length(trim(guest_display_name)) between 1 and 160),
  contact_email text
    check (
      contact_email is null
      or char_length(trim(contact_email)) between 3 and 254
    ),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  stay_subtotal_cents integer not null
    check (stay_subtotal_cents between 0 and 200000000),
  charge_total_cents integer not null
    check (charge_total_cents between 0 and 200000000),
  current_total_cents integer not null
    check (
      current_total_cents = stay_subtotal_cents + charge_total_cents
      and current_total_cents between 0 and 200000000
    ),
  charge_selections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(charge_selections) = 'array'),
  source_quote_kind text not null
    check (
      source_quote_kind in (
        'build041_checkout',
        'staff_create',
        'managed_revision'
      )
    ),
  financial_review_required boolean not null default false,
  financial_review_reason text
    check (
      financial_review_reason is null
      or char_length(financial_review_reason) between 1 and 500
    ),
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint reservation_management_state_reservation_unique
    unique (reservation_id),
  constraint reservation_management_state_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint reservation_management_state_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index reservation_management_state_scope_fk_idx
  on public.reservation_management_state (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_management_state_updated_by_fk_idx
  on public.reservation_management_state (updated_by_user_id)
  where updated_by_user_id is not null;

create table public.reservation_change_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  sequence_no integer not null check (sequence_no >= 1),
  change_kind text not null
    check (
      change_kind in (
        'create',
        'edit',
        'move',
        'extend',
        'shorten',
        'fees',
        'cancel'
      )
    ),
  source_channel text not null
    check (source_channel in ('web','staff','ivr','sms','system')),
  reason text not null
    check (char_length(trim(reason)) between 3 and 1000),
  before_snapshot jsonb
    check (
      before_snapshot is null
      or jsonb_typeof(before_snapshot) = 'object'
    ),
  after_snapshot jsonb not null
    check (jsonb_typeof(after_snapshot) = 'object'),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  previous_total_cents integer not null
    check (previous_total_cents between 0 and 200000000),
  revised_total_cents integer not null
    check (revised_total_cents between 0 and 200000000),
  delta_cents integer not null
    check (delta_cents between -200000000 and 200000000),
  captured_cents integer not null default 0
    check (captured_cents between 0 and 200000000),
  financial_review_required boolean not null default false,
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 16 and 240),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint reservation_change_history_sequence_unique
    unique (reservation_id, sequence_no),
  constraint reservation_change_history_idempotency_unique
    unique (campground_id, idempotency_key),
  constraint reservation_change_history_delta_check
    check (delta_cents = revised_total_cents - previous_total_cents),
  constraint reservation_change_history_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index reservation_change_history_scope_fk_idx
  on public.reservation_change_history (
    organization_id,
    campground_id,
    reservation_id
  );

create index reservation_change_history_timeline_idx
  on public.reservation_change_history (
    reservation_id,
    sequence_no desc
  );

create index reservation_change_history_actor_fk_idx
  on public.reservation_change_history (actor_user_id);

create trigger reservation_management_state_touch_row
before update on public.reservation_management_state
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.guard_reservation_change_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Reservation change history is append-only';
end;
$$;

create trigger reservation_change_history_append_only
before update or delete on public.reservation_change_history
for each row execute function icamp_private.guard_reservation_change_history();

alter table public.reservation_management_state enable row level security;
alter table public.reservation_management_state force row level security;
alter table public.reservation_change_history enable row level security;
alter table public.reservation_change_history force row level security;

revoke all on
  public.reservation_management_state,
  public.reservation_change_history
from public;

do $build044_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.reservation_management_state, public.reservation_change_history from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.reservation_management_state, public.reservation_change_history from authenticated';
  end if;
end
$build044_direct_roles$;

grant select, insert, update on public.reservation_management_state to icamp_app;
grant select, insert on public.reservation_change_history to icamp_app;

create policy reservation_management_state_read
on public.reservation_management_state
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'reservation.cancel')
);

create policy reservation_management_state_insert
on public.reservation_management_state
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id, 'reservation.create')
    or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  )
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy reservation_management_state_update
on public.reservation_management_state
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'reservation.cancel')
)
with check (
  (
    icamp_private.has_campground_permission(campground_id, 'reservation.modify')
    or icamp_private.has_campground_permission(campground_id, 'reservation.cancel')
  )
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy reservation_change_history_read
on public.reservation_change_history
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'reservation.cancel')
);

create policy reservation_change_history_insert
on public.reservation_change_history
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id, 'reservation.create')
    or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
    or icamp_private.has_campground_permission(campground_id, 'reservation.cancel')
  )
  and actor_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.reservation_management_state is
  'Build 044 current staff-managed reservation pricing/contact state. Build 041 checkout and Build 042 payment schedule evidence remain immutable.';
comment on table public.reservation_change_history is
  'Build 044 append-only reservation create/edit/move/extend/shorten/fee/cancel history with before/after snapshots and financial delta. Refund execution remains Build 045.';
