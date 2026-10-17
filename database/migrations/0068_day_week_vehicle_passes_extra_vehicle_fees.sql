-- iCamp Build 054
-- Day/Week Vehicle Passes & Extra-Vehicle Fees.

create table public.campground_vehicle_pass_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  day_pass_charge_id uuid
    references public.booking_charge_catalog(id)
    on update cascade
    on delete restrict,
  week_pass_charge_id uuid
    references public.booking_charge_catalog(id)
    on update cascade
    on delete restrict,
  extra_vehicle_charge_id uuid
    references public.booking_charge_catalog(id)
    on update cascade
    on delete restrict,
  included_stay_vehicle_count smallint not null default 1
    check (included_stay_vehicle_count between 0 and 20),
  parking_rule text not null default
    'Park only in designated areas or as directed by campground staff.'
    check (char_length(trim(parking_rule)) between 3 and 1000),
  access_rule text not null default
    'Vehicle access is limited to the pass validity window and campground operating rules.'
    check (char_length(trim(access_rule)) between 3 and 1000),
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_vehicle_pass_policies_scope_unique
    unique (organization_id,campground_id),
  constraint campground_vehicle_pass_policies_campground_unique
    unique (campground_id),
  constraint campground_vehicle_pass_policies_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict
);

create index campground_vehicle_pass_policies_day_charge_idx
  on public.campground_vehicle_pass_policies(day_pass_charge_id)
  where day_pass_charge_id is not null;

create index campground_vehicle_pass_policies_week_charge_idx
  on public.campground_vehicle_pass_policies(week_pass_charge_id)
  where week_pass_charge_id is not null;

create index campground_vehicle_pass_policies_extra_charge_idx
  on public.campground_vehicle_pass_policies(extra_vehicle_charge_id)
  where extra_vehicle_charge_id is not null;

create index campground_vehicle_pass_policies_updated_by_idx
  on public.campground_vehicle_pass_policies(updated_by_user_id)
  where updated_by_user_id is not null;

create or replace function icamp_private.validate_vehicle_pass_policy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  charge record;
begin
  if tg_op = 'UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id
      or old.created_at is distinct from new.created_at then
      raise exception 'Vehicle pass policy scope is immutable';
    end if;
  end if;

  if new.day_pass_charge_id is not null then
    select campground_id,charge_kind,pass_duration_days,pricing_basis,
           unit_price_cents,is_active
      into charge
    from public.booking_charge_catalog
    where id = new.day_pass_charge_id;

    if not found
      or charge.campground_id <> new.campground_id
      or charge.charge_kind <> 'pass'
      or charge.pass_duration_days <> 1
      or charge.pricing_basis = 'percent_of_stay'
      or charge.unit_price_cents is null
      or charge.is_active is not true then
      raise exception 'Day pass charge must be an active one-day campground pass with a fixed unit price';
    end if;
  end if;

  if new.week_pass_charge_id is not null then
    select campground_id,charge_kind,pass_duration_days,pricing_basis,
           unit_price_cents,is_active
      into charge
    from public.booking_charge_catalog
    where id = new.week_pass_charge_id;

    if not found
      or charge.campground_id <> new.campground_id
      or charge.charge_kind <> 'pass'
      or charge.pass_duration_days <> 7
      or charge.pricing_basis = 'percent_of_stay'
      or charge.unit_price_cents is null
      or charge.is_active is not true then
      raise exception 'Week pass charge must be an active seven-day campground pass with a fixed unit price';
    end if;
  end if;

  if new.extra_vehicle_charge_id is not null then
    select campground_id,charge_kind,pricing_basis,unit_price_cents,is_active
      into charge
    from public.booking_charge_catalog
    where id = new.extra_vehicle_charge_id;

    if not found
      or charge.campground_id <> new.campground_id
      or charge.charge_kind not in ('add_on','service_fee')
      or charge.pricing_basis <> 'per_unit'
      or charge.unit_price_cents is null
      or charge.is_active is not true then
      raise exception 'Extra-vehicle charge must be an active per-unit add-on or service fee';
    end if;
  end if;

  return new;
end;
$$;

create trigger campground_vehicle_pass_policy_validate
before insert or update on public.campground_vehicle_pass_policies
for each row execute function icamp_private.validate_vehicle_pass_policy();

create trigger campground_vehicle_pass_policy_touch
before update on public.campground_vehicle_pass_policies
for each row execute function icamp_private.touch_row();

create table public.vehicle_passes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  pass_number text not null
    check (pass_number ~ '^VP-[A-Z0-9]{8,40}$'),
  pass_kind text not null
    check (pass_kind in ('day','week','extra_vehicle')),
  reservation_id uuid,
  road_vehicle_registration_id uuid,
  host_accommodation_id uuid,
  source_charge_id uuid
    references public.booking_charge_catalog(id)
    on update cascade
    on delete restrict,
  plate_number text not null
    check (
      char_length(trim(plate_number)) between 1 and 24
      and plate_number = upper(plate_number)
    ),
  plate_jurisdiction text not null
    check (
      char_length(trim(plate_jurisdiction)) between 1 and 40
      and plate_jurisdiction = upper(plate_jurisdiction)
    ),
  vehicle_description text not null
    check (char_length(trim(vehicle_description)) between 2 and 240),
  driver_name text not null
    check (char_length(trim(driver_name)) between 2 and 160),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  fee_amount_cents integer not null default 0
    check (fee_amount_cents between 0 and 100000000),
  currency_code text not null default 'CAD'
    check (currency_code ~ '^[A-Z]{3}$'),
  payment_state text not null
    check (payment_state in ('not_required','unpaid','captured')),
  pass_status text not null
    check (pass_status in ('pending_payment','active','revoked')),
  parking_rule_snapshot text not null
    check (char_length(trim(parking_rule_snapshot)) between 3 and 1000),
  access_rule_snapshot text not null
    check (char_length(trim(access_rule_snapshot)) between 3 and 1000),
  revoked_at timestamptz,
  revocation_reason text
    check (
      revocation_reason is null
      or char_length(trim(revocation_reason)) between 3 and 500
    ),
  source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','system')),
  notes text
    check (notes is null or char_length(notes) <= 2000),
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 8 and 200),
  issued_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  updated_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint vehicle_passes_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint vehicle_passes_number_unique
    unique (campground_id,pass_number),
  constraint vehicle_passes_idempotency_unique
    unique (campground_id,idempotency_key),
  constraint vehicle_passes_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint vehicle_passes_registration_fk
    foreign key (organization_id,campground_id,road_vehicle_registration_id)
    references public.road_vehicle_registrations(
      organization_id,campground_id,id
    )
    on update cascade
    on delete restrict,
  constraint vehicle_passes_accommodation_fk
    foreign key (organization_id,campground_id,host_accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint vehicle_passes_validity_check
    check (valid_until > valid_from),
  constraint vehicle_passes_kind_shape_check
    check (
      (
        pass_kind in ('day','week')
        and reservation_id is null
        and road_vehicle_registration_id is null
        and host_accommodation_id is null
      )
      or
      (
        pass_kind = 'extra_vehicle'
        and reservation_id is not null
        and road_vehicle_registration_id is not null
        and host_accommodation_id is not null
      )
    ),
  constraint vehicle_passes_payment_shape_check
    check (
      (
        fee_amount_cents = 0
        and payment_state = 'not_required'
        and pass_status in ('active','revoked')
      )
      or
      (
        fee_amount_cents > 0
        and (
          (payment_state = 'unpaid' and pass_status in ('pending_payment','revoked'))
          or
          (payment_state = 'captured' and pass_status in ('active','revoked'))
        )
      )
    ),
  constraint vehicle_passes_revocation_shape_check
    check (
      (
        pass_status <> 'revoked'
        and revoked_at is null
        and revocation_reason is null
      )
      or
      (
        pass_status = 'revoked'
        and revoked_at is not null
        and revocation_reason is not null
      )
    )
);

create index vehicle_passes_list_idx
  on public.vehicle_passes(
    campground_id,
    pass_status,
    valid_until,
    created_at desc
  );

create index vehicle_passes_reservation_idx
  on public.vehicle_passes(
    organization_id,campground_id,reservation_id
  )
  where reservation_id is not null;

create index vehicle_passes_registration_idx
  on public.vehicle_passes(
    organization_id,campground_id,road_vehicle_registration_id
  )
  where road_vehicle_registration_id is not null;

create unique index vehicle_passes_open_extra_vehicle_uidx
  on public.vehicle_passes(road_vehicle_registration_id)
  where pass_kind = 'extra_vehicle'
    and pass_status in ('pending_payment','active');

create index vehicle_passes_accommodation_idx
  on public.vehicle_passes(
    organization_id,campground_id,host_accommodation_id
  )
  where host_accommodation_id is not null;

create index vehicle_passes_source_charge_idx
  on public.vehicle_passes(source_charge_id)
  where source_charge_id is not null;

create index vehicle_passes_issued_by_idx
  on public.vehicle_passes(issued_by_user_id);

create index vehicle_passes_updated_by_idx
  on public.vehicle_passes(updated_by_user_id);

create or replace function icamp_private.guard_vehicle_pass_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  registration_row record;
  reservation_row record;
begin
  if new.pass_kind = 'day'
    and new.valid_until - new.valid_from > interval '24 hours' then
    raise exception 'Day vehicle pass validity cannot exceed 24 hours';
  end if;

  if new.pass_kind = 'week'
    and new.valid_until - new.valid_from > interval '7 days' then
    raise exception 'Week vehicle pass validity cannot exceed 7 days';
  end if;

  if new.pass_kind = 'extra_vehicle' then
    select reservation_id,host_accommodation_id,registration_status,
           plate_number,plate_jurisdiction
      into registration_row
    from public.road_vehicle_registrations
    where organization_id = new.organization_id
      and campground_id = new.campground_id
      and id = new.road_vehicle_registration_id;

    if not found
      or registration_row.registration_status <> 'active'
      or registration_row.reservation_id is distinct from new.reservation_id
      or registration_row.host_accommodation_id is distinct from new.host_accommodation_id
      or registration_row.plate_number is distinct from new.plate_number
      or registration_row.plate_jurisdiction is distinct from new.plate_jurisdiction then
      raise exception 'Extra-vehicle pass must match an active stay-linked road vehicle registration';
    end if;

    select accommodation_id,status,arrival_date,departure_date
      into reservation_row
    from public.reservations
    where organization_id = new.organization_id
      and campground_id = new.campground_id
      and id = new.reservation_id;

    if not found
      or reservation_row.status not in ('pending','confirmed','checked_in')
      or reservation_row.accommodation_id is distinct from new.host_accommodation_id then
      raise exception 'Extra-vehicle pass reservation is unavailable';
    end if;

    if new.valid_from::date < reservation_row.arrival_date
      or new.valid_until::date > reservation_row.departure_date + 1 then
      raise exception 'Extra-vehicle pass validity must stay within the reservation window';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id
      or old.pass_number is distinct from new.pass_number
      or old.pass_kind is distinct from new.pass_kind
      or old.reservation_id is distinct from new.reservation_id
      or old.road_vehicle_registration_id is distinct from new.road_vehicle_registration_id
      or old.host_accommodation_id is distinct from new.host_accommodation_id
      or old.source_charge_id is distinct from new.source_charge_id
      or old.plate_number is distinct from new.plate_number
      or old.plate_jurisdiction is distinct from new.plate_jurisdiction
      or old.vehicle_description is distinct from new.vehicle_description
      or old.driver_name is distinct from new.driver_name
      or old.valid_from is distinct from new.valid_from
      or old.valid_until is distinct from new.valid_until
      or old.fee_amount_cents is distinct from new.fee_amount_cents
      or old.currency_code is distinct from new.currency_code
      or old.parking_rule_snapshot is distinct from new.parking_rule_snapshot
      or old.access_rule_snapshot is distinct from new.access_rule_snapshot
      or old.source_channel is distinct from new.source_channel
      or old.idempotency_key is distinct from new.idempotency_key
      or old.issued_by_user_id is distinct from new.issued_by_user_id
      or old.created_at is distinct from new.created_at then
      raise exception 'Vehicle pass identity, validity, fee and rule snapshot are immutable';
    end if;

    if current_user = 'icamp_app'
      and old.payment_state is distinct from new.payment_state then
      raise exception 'Vehicle pass payment state is trusted-server managed';
    end if;

    if old.payment_state = 'captured'
      and new.payment_state is distinct from old.payment_state then
      raise exception 'Captured vehicle pass payment cannot be reversed by Build 054';
    end if;

    if old.pass_status = 'revoked'
      and new.pass_status is distinct from old.pass_status then
      raise exception 'Revoked vehicle pass cannot be reactivated';
    end if;

    if new.pass_status = 'active'
      and new.fee_amount_cents > 0
      and new.payment_state <> 'captured' then
      raise exception 'Paid vehicle pass cannot activate before capture';
    end if;
  end if;

  return new;
end;
$$;

create trigger vehicle_passes_guard_mutation
before insert or update on public.vehicle_passes
for each row execute function icamp_private.guard_vehicle_pass_mutation();

create trigger vehicle_passes_touch_row
before update on public.vehicle_passes
for each row execute function icamp_private.touch_row();

create table public.vehicle_pass_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  vehicle_pass_id uuid not null,
  event_kind text not null
    check (event_kind in ('issued','payment_captured','revoked')),
  prior_status text
    check (
      prior_status is null
      or prior_status in ('pending_payment','active','revoked')
    ),
  new_status text not null
    check (new_status in ('pending_payment','active','revoked')),
  reason text
    check (reason is null or char_length(trim(reason)) between 3 and 500),
  source_channel text not null
    check (source_channel in ('web','staff','ivr','sms','system')),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint vehicle_pass_events_pass_fk
    foreign key (organization_id,campground_id,vehicle_pass_id)
    references public.vehicle_passes(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create index vehicle_pass_events_pass_idx
  on public.vehicle_pass_events(
    organization_id,campground_id,vehicle_pass_id,occurred_at desc
  );

create index vehicle_pass_events_actor_idx
  on public.vehicle_pass_events(actor_user_id,occurred_at desc);

create or replace function icamp_private.prevent_vehicle_pass_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Vehicle pass events are append-only';
end;
$$;

create trigger vehicle_pass_events_append_only
before update or delete on public.vehicle_pass_events
for each row execute function icamp_private.prevent_vehicle_pass_event_mutation();

create table public.vehicle_pass_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  vehicle_pass_id uuid not null,
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_payment_reference text,
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 16 and 240),
  amount_cents integer not null
    check (amount_cents between 1 and 100000000),
  currency_code text not null
    check (currency_code ~ '^[A-Z]{3}$'),
  payment_state text not null default 'created'
    check (
      payment_state in (
        'created','submitted','authorized','captured','failed','cancelled'
      )
    ),
  last_error_code text,
  authorized_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint vehicle_pass_payments_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint vehicle_pass_payments_pass_fk
    foreign key (organization_id,campground_id,vehicle_pass_id)
    references public.vehicle_passes(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint vehicle_pass_payments_idempotency_unique
    unique (campground_id,idempotency_key)
);

create trigger vehicle_pass_payments_touch_row
before update on public.vehicle_pass_payments
for each row execute function icamp_private.touch_row();

create unique index vehicle_pass_payments_provider_reference_uidx
  on public.vehicle_pass_payments(provider_key,provider_payment_reference)
  where provider_payment_reference is not null;

create index vehicle_pass_payments_pass_state_idx
  on public.vehicle_pass_payments(vehicle_pass_id,payment_state,created_at desc);

create index vehicle_pass_payments_created_by_idx
  on public.vehicle_pass_payments(created_by_user_id,created_at desc);

create table icamp_private.vehicle_pass_payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_event_id text not null
    check (char_length(trim(provider_event_id)) between 1 and 240),
  payment_id uuid not null
    references public.vehicle_pass_payments(id)
    on update cascade
    on delete restrict,
  event_type text not null
    check (
      event_type in (
        'payment.authorized','payment.captured',
        'payment.failed','payment.cancelled'
      )
    ),
  event_status text not null
    check (char_length(trim(event_status)) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  constraint vehicle_pass_payment_provider_event_unique
    unique (provider_key,provider_event_id)
);

create index vehicle_pass_payment_provider_events_payment_idx
  on icamp_private.vehicle_pass_payment_provider_events(payment_id,occurred_at desc);

alter table public.campground_vehicle_pass_policies enable row level security;
alter table public.campground_vehicle_pass_policies force row level security;
alter table public.vehicle_passes enable row level security;
alter table public.vehicle_passes force row level security;
alter table public.vehicle_pass_events enable row level security;
alter table public.vehicle_pass_events force row level security;
alter table public.vehicle_pass_payments enable row level security;
alter table public.vehicle_pass_payments force row level security;

revoke all on
  public.campground_vehicle_pass_policies,
  public.vehicle_passes,
  public.vehicle_pass_events,
  public.vehicle_pass_payments
from public;

revoke all on icamp_private.vehicle_pass_payment_provider_events from public;

do $build054_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.campground_vehicle_pass_policies, public.vehicle_passes, public.vehicle_pass_events, public.vehicle_pass_payments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.campground_vehicle_pass_policies, public.vehicle_passes, public.vehicle_pass_events, public.vehicle_pass_payments from authenticated';
  end if;
end
$build054_direct_roles$;

grant select,insert,update on public.campground_vehicle_pass_policies to icamp_app;
grant select,insert,update on public.vehicle_passes to icamp_app;
grant select,insert on public.vehicle_pass_events to icamp_app;
grant select on public.vehicle_pass_payments to icamp_app;

drop policy if exists booking_charge_catalog_read on public.booking_charge_catalog;
create policy booking_charge_catalog_read
on public.booking_charge_catalog
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
  or icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'vehicle.pass.issue')
);

drop policy if exists reservations_read on public.reservations;
create policy reservations_read
on public.reservations
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
  or icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
);

drop policy if exists road_vehicle_registrations_read
on public.road_vehicle_registrations;
create policy road_vehicle_registrations_read
on public.road_vehicle_registrations
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.read')
  or icamp_private.has_campground_permission(campground_id,'vehicle.register')
  or icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
);

create policy campground_vehicle_pass_policies_read
on public.campground_vehicle_pass_policies
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.read')
  or icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  or icamp_private.has_campground_permission(campground_id,'campground.configuration')
  or icamp_private.has_campground_permission(campground_id,'pricing.manage')
);

create policy campground_vehicle_pass_policies_insert
on public.campground_vehicle_pass_policies
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
  and icamp_private.has_campground_permission(campground_id,'pricing.manage')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy campground_vehicle_pass_policies_update
on public.campground_vehicle_pass_policies
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
  and icamp_private.has_campground_permission(campground_id,'pricing.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
  and icamp_private.has_campground_permission(campground_id,'pricing.manage')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy vehicle_passes_read
on public.vehicle_passes
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.read')
  or icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  or icamp_private.has_campground_permission(campground_id,'payment.read')
);

create policy vehicle_passes_insert
on public.vehicle_passes
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  and issued_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id = issued_by_user_id
);

create policy vehicle_passes_update
on public.vehicle_passes
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
)
with check (
  icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy vehicle_pass_events_read
on public.vehicle_pass_events
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.read')
  or icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  or icamp_private.has_campground_permission(campground_id,'payment.read')
);

create policy vehicle_pass_events_insert
on public.vehicle_pass_events
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  and actor_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy vehicle_pass_payments_read
on public.vehicle_pass_payments
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  or icamp_private.has_campground_permission(campground_id,'payment.read')
);

comment on table public.campground_vehicle_pass_policies is
  'Build 054 links canonical Build 040 pass/extra-vehicle charges to campground vehicle parking/access policy.';
comment on table public.vehicle_passes is
  'Build 054 operational day/week non-stay and stay-linked extra-vehicle passes with immutable fee/rule snapshots.';
comment on table public.vehicle_pass_events is
  'Build 054 append-only vehicle pass lifecycle evidence.';
comment on table public.vehicle_pass_payments is
  'Build 054 provider-neutral vehicle pass payment attempts; raw payment credentials are excluded.';
comment on table icamp_private.vehicle_pass_payment_provider_events is
  'Build 054 normalized vehicle-pass provider payment evidence; raw webhook bodies and payment credentials are excluded.';
comment on column public.vehicle_passes.access_rule_snapshot is
  'Human-readable Build 054 access rule only. Build 056+ owns credential issuance and Build 060 owns enforceable access zones/schedules.';
