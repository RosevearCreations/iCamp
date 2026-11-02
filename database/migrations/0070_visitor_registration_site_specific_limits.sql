-- iCamp Build 055
-- Visitor Registration & Site-Specific Limits.

create table public.campground_visitor_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  day_visit_charge_id uuid
    references public.booking_charge_catalog(id)
    on update cascade
    on delete restrict,
  week_visit_charge_id uuid
    references public.booking_charge_catalog(id)
    on update cascade
    on delete restrict,
  identity_verification_mode text not null default 'host_attested'
    check (identity_verification_mode in ('none','host_attested','staff_visual')),
  contact_requirement text not null default 'either'
    check (contact_requirement in ('none','phone','email','either','both')),
  visitor_rule text not null default
    'Visitors must remain within their registered host site and approved visit window unless campground staff direct otherwise.'
    check (char_length(trim(visitor_rule)) between 3 and 1000),
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_visitor_policies_scope_unique
    unique (organization_id,campground_id),
  constraint campground_visitor_policies_campground_unique
    unique (campground_id),
  constraint campground_visitor_policies_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict
);

create index campground_visitor_policies_day_charge_idx
  on public.campground_visitor_policies(day_visit_charge_id)
  where day_visit_charge_id is not null;

create index campground_visitor_policies_week_charge_idx
  on public.campground_visitor_policies(week_visit_charge_id)
  where week_visit_charge_id is not null;

create index campground_visitor_policies_updated_by_idx
  on public.campground_visitor_policies(updated_by_user_id)
  where updated_by_user_id is not null;

create or replace function icamp_private.validate_visitor_policy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  charge record;
begin
  if tg_op = 'UPDATE' and (
    old.organization_id is distinct from new.organization_id
    or old.campground_id is distinct from new.campground_id
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'Visitor policy scope is immutable';
  end if;

  if new.day_visit_charge_id is not null then
    select campground_id,charge_kind,pass_duration_days,pricing_basis,
           unit_price_cents,is_active
      into charge
    from public.booking_charge_catalog
    where id = new.day_visit_charge_id;

    if not found
      or charge.campground_id <> new.campground_id
      or charge.charge_kind <> 'pass'
      or charge.pass_duration_days <> 1
      or charge.pricing_basis = 'percent_of_stay'
      or charge.unit_price_cents is null
      or charge.is_active is not true then
      raise exception 'Day visitor charge must be an active one-day pass with a fixed unit price';
    end if;
  end if;

  if new.week_visit_charge_id is not null then
    select campground_id,charge_kind,pass_duration_days,pricing_basis,
           unit_price_cents,is_active
      into charge
    from public.booking_charge_catalog
    where id = new.week_visit_charge_id;

    if not found
      or charge.campground_id <> new.campground_id
      or charge.charge_kind <> 'pass'
      or charge.pass_duration_days <> 7
      or charge.pricing_basis = 'percent_of_stay'
      or charge.unit_price_cents is null
      or charge.is_active is not true then
      raise exception 'Week visitor charge must be an active seven-day pass with a fixed unit price';
    end if;
  end if;

  return new;
end;
$$;

create trigger campground_visitor_policy_validate
before insert or update on public.campground_visitor_policies
for each row execute function icamp_private.validate_visitor_policy();

create trigger campground_visitor_policy_touch
before update on public.campground_visitor_policies
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.resolve_visitor_limit(
  p_campground_id uuid,
  p_accommodation_id uuid
)
returns table (
  max_visitors smallint,
  rule_id uuid,
  scope_kind text,
  size_band boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with target as (
    select
      a.id,
      a.campground_id,
      a.section_id,
      a.accommodation_kind,
      case
        when cs.site_length_meters is not null
          and cs.site_width_meters is not null
          and cs.site_length_meters > 0
          and cs.site_width_meters > 0
        then cs.site_length_meters * cs.site_width_meters
        else null
      end as site_area_m2
    from public.accommodations a
    left join public.campsites cs
      on cs.organization_id = a.organization_id
     and cs.campground_id = a.campground_id
     and cs.accommodation_id = a.id
    where a.campground_id = p_campground_id
      and a.id = p_accommodation_id
      and a.lifecycle_state <> 'archived'
    limit 1
  ),
  candidates as (
    select
      r.max_visitors,
      r.id as rule_id,
      r.scope_kind,
      (r.minimum_site_area_m2 is not null or r.maximum_site_area_m2 is not null)
        as size_band,
      case r.scope_kind
        when 'campground' then 10
        when 'accommodation_type' then 20
        when 'section' then 30
        when 'accommodation' then 40
        else 0
      end as scope_weight
    from target t
    join public.capacity_limit_rules r
      on r.campground_id = t.campground_id
     and r.is_active
     and r.max_visitors is not null
    where (
        r.scope_kind = 'campground'
        or (r.scope_kind = 'accommodation_type'
          and r.accommodation_kind = t.accommodation_kind)
        or (r.scope_kind = 'section' and r.section_id = t.section_id)
        or (r.scope_kind = 'accommodation' and r.accommodation_id = t.id)
      )
      and (
        (
          r.minimum_site_area_m2 is null
          and r.maximum_site_area_m2 is null
        )
        or (
          t.site_area_m2 is not null
          and (
            r.minimum_site_area_m2 is null
            or t.site_area_m2 >= r.minimum_site_area_m2
          )
          and (
            r.maximum_site_area_m2 is null
            or t.site_area_m2 <= r.maximum_site_area_m2
          )
        )
      )
  )
  select c.max_visitors,c.rule_id,c.scope_kind,c.size_band
  from candidates c
  order by c.scope_weight desc,c.size_band desc
  limit 1;
$$;

revoke all on function icamp_private.resolve_visitor_limit(uuid,uuid) from public;
grant execute on function icamp_private.resolve_visitor_limit(uuid,uuid) to icamp_app;

create table public.visitor_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  visitor_number text not null
    check (visitor_number ~ '^VR-[A-Z0-9]{8,40}$'),
  reservation_id uuid not null,
  host_accommodation_id uuid not null,
  host_accommodation_label text not null
    check (char_length(trim(host_accommodation_label)) between 1 and 240),
  visitor_name text not null
    check (char_length(trim(visitor_name)) between 2 and 160),
  contact_phone text
    check (contact_phone is null or char_length(trim(contact_phone)) between 7 and 40),
  contact_email text
    check (contact_email is null or char_length(trim(contact_email)) between 3 and 254),
  identity_verification_mode_snapshot text not null
    check (identity_verification_mode_snapshot in ('none','host_attested','staff_visual')),
  identity_verified_at timestamptz,
  identity_verified_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  contact_requirement_snapshot text not null
    check (contact_requirement_snapshot in ('none','phone','email','either','both')),
  visit_kind text not null
    check (visit_kind in ('day','week')),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  effective_max_visitors smallint
    check (effective_max_visitors is null or effective_max_visitors between 0 and 80),
  capacity_rule_id uuid
    references public.capacity_limit_rules(id)
    on update cascade
    on delete restrict,
  capacity_rule_scope_snapshot text
    check (
      capacity_rule_scope_snapshot is null
      or capacity_rule_scope_snapshot in (
        'campground','section','accommodation_type','accommodation'
      )
    ),
  source_charge_id uuid
    references public.booking_charge_catalog(id)
    on update cascade
    on delete restrict,
  fee_amount_cents integer not null default 0
    check (fee_amount_cents between 0 and 100000000),
  currency_code text not null default 'CAD'
    check (currency_code ~ '^[A-Z]{3}$'),
  payment_state text not null
    check (payment_state in ('not_required','unpaid','captured')),
  registration_status text not null
    check (registration_status in ('pending_payment','active','revoked')),
  visitor_rule_snapshot text not null
    check (char_length(trim(visitor_rule_snapshot)) between 3 and 1000),
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
  registered_by_user_id uuid not null
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
  constraint visitor_registrations_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint visitor_registrations_number_unique
    unique (campground_id,visitor_number),
  constraint visitor_registrations_idempotency_unique
    unique (campground_id,idempotency_key),
  constraint visitor_registrations_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint visitor_registrations_accommodation_fk
    foreign key (organization_id,campground_id,host_accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint visitor_registrations_validity_check
    check (valid_until > valid_from),
  constraint visitor_registrations_capacity_rule_shape_check
    check (
      (capacity_rule_id is null and effective_max_visitors is null and capacity_rule_scope_snapshot is null)
      or
      (capacity_rule_id is not null and effective_max_visitors is not null and capacity_rule_scope_snapshot is not null)
    ),
  constraint visitor_registrations_identity_shape_check
    check (
      (
        identity_verification_mode_snapshot = 'none'
        and identity_verified_at is null
        and identity_verified_by_user_id is null
      )
      or
      (
        identity_verification_mode_snapshot <> 'none'
        and identity_verified_at is not null
        and identity_verified_by_user_id is not null
      )
    ),
  constraint visitor_registrations_contact_shape_check
    check (
      contact_requirement_snapshot = 'none'
      or (contact_requirement_snapshot = 'phone' and contact_phone is not null)
      or (contact_requirement_snapshot = 'email' and contact_email is not null)
      or (
        contact_requirement_snapshot = 'either'
        and (contact_phone is not null or contact_email is not null)
      )
      or (
        contact_requirement_snapshot = 'both'
        and contact_phone is not null
        and contact_email is not null
      )
    ),
  constraint visitor_registrations_payment_shape_check
    check (
      (
        fee_amount_cents = 0
        and payment_state = 'not_required'
        and registration_status in ('active','revoked')
      )
      or
      (
        fee_amount_cents > 0
        and (
          (payment_state = 'unpaid' and registration_status in ('pending_payment','revoked'))
          or
          (payment_state = 'captured' and registration_status in ('active','revoked'))
        )
      )
    ),
  constraint visitor_registrations_revocation_shape_check
    check (
      (
        registration_status <> 'revoked'
        and revoked_at is null
        and revocation_reason is null
      )
      or
      (
        registration_status = 'revoked'
        and revoked_at is not null
        and revocation_reason is not null
      )
    )
);

create index visitor_registrations_list_idx
  on public.visitor_registrations(
    campground_id,registration_status,valid_until,created_at desc
  );

create index visitor_registrations_reservation_idx
  on public.visitor_registrations(
    organization_id,campground_id,reservation_id
  );

create index visitor_registrations_accommodation_window_idx
  on public.visitor_registrations(
    campground_id,host_accommodation_id,valid_from,valid_until
  )
  where registration_status in ('pending_payment','active');

create index visitor_registrations_capacity_rule_idx
  on public.visitor_registrations(capacity_rule_id)
  where capacity_rule_id is not null;

create index visitor_registrations_source_charge_idx
  on public.visitor_registrations(source_charge_id)
  where source_charge_id is not null;

create index visitor_registrations_registered_by_idx
  on public.visitor_registrations(registered_by_user_id);

create index visitor_registrations_updated_by_idx
  on public.visitor_registrations(updated_by_user_id);

create index visitor_registrations_identity_verified_by_idx
  on public.visitor_registrations(identity_verified_by_user_id)
  where identity_verified_by_user_id is not null;

create or replace function icamp_private.guard_visitor_registration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reservation_row record;
  accommodation_row record;
  charge record;
  limit_row record;
  campground_time_zone text;
  overlap_count integer;
begin
  if new.visit_kind = 'day'
    and new.valid_until - new.valid_from > interval '24 hours' then
    raise exception 'Day visitor registration validity cannot exceed 24 hours';
  end if;

  if new.visit_kind = 'week'
    and new.valid_until - new.valid_from > interval '7 days' then
    raise exception 'Week visitor registration validity cannot exceed 7 days';
  end if;

  if tg_op = 'INSERT' then
    select time_zone
      into campground_time_zone
    from public.campgrounds
    where id = new.campground_id;

    select accommodation_id,status,arrival_date,departure_date
      into reservation_row
    from public.reservations
    where organization_id = new.organization_id
      and campground_id = new.campground_id
      and id = new.reservation_id;

    if not found
      or reservation_row.status not in ('pending','confirmed','checked_in')
      or reservation_row.accommodation_id is distinct from new.host_accommodation_id then
      raise exception 'Visitor registration requires an active matching host reservation';
    end if;

    select code,display_name
      into accommodation_row
    from public.accommodations
    where organization_id = new.organization_id
      and campground_id = new.campground_id
      and id = new.host_accommodation_id;

    if not found
      or new.host_accommodation_label is distinct from
        (accommodation_row.code || ' · ' || accommodation_row.display_name) then
      raise exception 'Visitor host accommodation snapshot is invalid';
    end if;

    if (new.valid_from at time zone campground_time_zone)::date
         < reservation_row.arrival_date
      or (new.valid_until at time zone campground_time_zone)::date
         > reservation_row.departure_date then
      raise exception 'Visitor validity must stay within the host reservation window';
    end if;

    select *
      into limit_row
    from icamp_private.resolve_visitor_limit(
      new.campground_id,new.host_accommodation_id
    );

    if found then
      if new.effective_max_visitors is distinct from limit_row.max_visitors
        or new.capacity_rule_id is distinct from limit_row.rule_id
        or new.capacity_rule_scope_snapshot is distinct from limit_row.scope_kind then
        raise exception 'Visitor capacity snapshot must match the current effective site-specific rule';
      end if;
    elsif new.effective_max_visitors is not null
      or new.capacity_rule_id is not null
      or new.capacity_rule_scope_snapshot is not null then
      raise exception 'Visitor capacity snapshot cannot invent an unconfigured limit';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'icamp-visitor-capacity:' ||
        new.campground_id::text || ':' ||
        new.host_accommodation_id::text,
        0
      )
    );

    if new.effective_max_visitors is not null then
      select count(*)::integer
        into overlap_count
      from public.visitor_registrations v
      where v.campground_id = new.campground_id
        and v.host_accommodation_id = new.host_accommodation_id
        and v.registration_status in ('pending_payment','active')
        and not (
          v.valid_until <= new.valid_from
          or v.valid_from >= new.valid_until
        );

      if overlap_count >= new.effective_max_visitors then
        raise exception 'Visitor registration would exceed the effective site-specific visitor limit';
      end if;
    end if;
  end if;

  if new.source_charge_id is null then
    if new.fee_amount_cents <> 0 then
      raise exception 'Visitor fee requires a canonical source charge';
    end if;
  else
    select campground_id,charge_kind,pricing_basis,unit_price_cents,
           currency_code,pass_duration_days,is_active
      into charge
    from public.booking_charge_catalog
    where id = new.source_charge_id;

    if not found
      or charge.campground_id <> new.campground_id
      or charge.charge_kind <> 'pass'
      or charge.pricing_basis = 'percent_of_stay'
      or charge.unit_price_cents is distinct from new.fee_amount_cents
      or charge.currency_code is distinct from new.currency_code
      or charge.is_active is not true
      or (new.visit_kind = 'day' and charge.pass_duration_days <> 1)
      or (new.visit_kind = 'week' and charge.pass_duration_days <> 7) then
      raise exception 'Visitor fee snapshot must match the active canonical day/week pass charge';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id
      or old.visitor_number is distinct from new.visitor_number
      or old.reservation_id is distinct from new.reservation_id
      or old.host_accommodation_id is distinct from new.host_accommodation_id
      or old.host_accommodation_label is distinct from new.host_accommodation_label
      or old.visitor_name is distinct from new.visitor_name
      or old.contact_phone is distinct from new.contact_phone
      or old.contact_email is distinct from new.contact_email
      or old.identity_verification_mode_snapshot is distinct from new.identity_verification_mode_snapshot
      or old.identity_verified_at is distinct from new.identity_verified_at
      or old.identity_verified_by_user_id is distinct from new.identity_verified_by_user_id
      or old.contact_requirement_snapshot is distinct from new.contact_requirement_snapshot
      or old.visit_kind is distinct from new.visit_kind
      or old.valid_from is distinct from new.valid_from
      or old.valid_until is distinct from new.valid_until
      or old.effective_max_visitors is distinct from new.effective_max_visitors
      or old.capacity_rule_id is distinct from new.capacity_rule_id
      or old.capacity_rule_scope_snapshot is distinct from new.capacity_rule_scope_snapshot
      or old.source_charge_id is distinct from new.source_charge_id
      or old.fee_amount_cents is distinct from new.fee_amount_cents
      or old.currency_code is distinct from new.currency_code
      or old.visitor_rule_snapshot is distinct from new.visitor_rule_snapshot
      or old.source_channel is distinct from new.source_channel
      or old.notes is distinct from new.notes
      or old.idempotency_key is distinct from new.idempotency_key
      or old.registered_by_user_id is distinct from new.registered_by_user_id
      or old.created_at is distinct from new.created_at then
      raise exception 'Visitor identity, host, validity, capacity, fee and rule snapshots are immutable';
    end if;

    if current_user = 'icamp_app'
      and old.payment_state is distinct from new.payment_state then
      raise exception 'Visitor registration payment state is trusted-server managed';
    end if;

    if old.payment_state = 'captured'
      and new.payment_state is distinct from old.payment_state then
      raise exception 'Captured visitor registration payment cannot be reversed by Build 055';
    end if;

    if old.registration_status = 'revoked'
      and new.registration_status is distinct from old.registration_status then
      raise exception 'Revoked visitor registration cannot be reactivated';
    end if;

    if new.registration_status = 'active'
      and new.fee_amount_cents > 0
      and new.payment_state <> 'captured' then
      raise exception 'Paid visitor registration cannot activate before capture';
    end if;
  end if;

  return new;
end;
$$;

create trigger visitor_registrations_guard
before insert or update on public.visitor_registrations
for each row execute function icamp_private.guard_visitor_registration();

create trigger visitor_registrations_touch
before update on public.visitor_registrations
for each row execute function icamp_private.touch_row();

create table public.visitor_registration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  visitor_registration_id uuid not null,
  event_kind text not null
    check (event_kind in ('registered','payment_captured','revoked')),
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
  constraint visitor_registration_events_registration_fk
    foreign key (organization_id,campground_id,visitor_registration_id)
    references public.visitor_registrations(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create index visitor_registration_events_registration_idx
  on public.visitor_registration_events(
    organization_id,campground_id,visitor_registration_id,occurred_at desc
  );

create index visitor_registration_events_actor_idx
  on public.visitor_registration_events(actor_user_id,occurred_at desc);

create or replace function icamp_private.prevent_visitor_registration_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Visitor registration events are append-only';
end;
$$;

create trigger visitor_registration_events_append_only
before update or delete on public.visitor_registration_events
for each row execute function icamp_private.prevent_visitor_registration_event_mutation();

create table public.visitor_registration_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  visitor_registration_id uuid not null,
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
  constraint visitor_registration_payments_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint visitor_registration_payments_registration_fk
    foreign key (organization_id,campground_id,visitor_registration_id)
    references public.visitor_registrations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint visitor_registration_payments_idempotency_unique
    unique (campground_id,idempotency_key)
);

create trigger visitor_registration_payments_touch
before update on public.visitor_registration_payments
for each row execute function icamp_private.touch_row();

create unique index visitor_registration_payments_provider_reference_uidx
  on public.visitor_registration_payments(provider_key,provider_payment_reference)
  where provider_payment_reference is not null;

create index visitor_registration_payments_registration_state_idx
  on public.visitor_registration_payments(
    visitor_registration_id,payment_state,created_at desc
  );

create index visitor_registration_payments_scope_registration_fk_idx
  on public.visitor_registration_payments(
    organization_id,campground_id,visitor_registration_id
  );

create index visitor_registration_payments_created_by_idx
  on public.visitor_registration_payments(created_by_user_id,created_at desc);

create table icamp_private.visitor_registration_payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_event_id text not null
    check (char_length(trim(provider_event_id)) between 1 and 240),
  payment_id uuid not null
    references public.visitor_registration_payments(id)
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
  constraint visitor_registration_payment_provider_event_unique
    unique (provider_key,provider_event_id)
);

create index visitor_registration_payment_provider_events_payment_idx
  on icamp_private.visitor_registration_payment_provider_events(
    payment_id,occurred_at desc
  );

alter table public.campground_visitor_policies enable row level security;
alter table public.campground_visitor_policies force row level security;
alter table public.visitor_registrations enable row level security;
alter table public.visitor_registrations force row level security;
alter table public.visitor_registration_events enable row level security;
alter table public.visitor_registration_events force row level security;
alter table public.visitor_registration_payments enable row level security;
alter table public.visitor_registration_payments force row level security;

revoke all on
  public.campground_visitor_policies,
  public.visitor_registrations,
  public.visitor_registration_events,
  public.visitor_registration_payments
from public;

revoke all on icamp_private.visitor_registration_payment_provider_events from public;

do $build055_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.campground_visitor_policies, public.visitor_registrations, public.visitor_registration_events, public.visitor_registration_payments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.campground_visitor_policies, public.visitor_registrations, public.visitor_registration_events, public.visitor_registration_payments from authenticated';
  end if;
end
$build055_direct_roles$;

grant select,insert,update on public.campground_visitor_policies to icamp_app;
grant select,insert,update on public.visitor_registrations to icamp_app;
grant select,insert on public.visitor_registration_events to icamp_app;
grant select on public.visitor_registration_payments to icamp_app;

drop policy if exists capacity_limit_rules_read on public.capacity_limit_rules;
create policy capacity_limit_rules_read
on public.capacity_limit_rules
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
  or icamp_private.has_campground_permission(campground_id,'accommodation.read')
  or icamp_private.has_campground_permission(campground_id,'accommodation.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
  or icamp_private.has_campground_permission(campground_id,'reservation.override')
  or icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
);

drop policy if exists booking_charge_catalog_read on public.booking_charge_catalog;
create policy booking_charge_catalog_read
on public.booking_charge_catalog
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'pricing.manage')
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
  or icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
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
  or icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
);

alter policy accommodations_read
on public.accommodations
using (
  icamp_private.has_campground_permission(campground_id,'accommodation.read')
  or icamp_private.has_campground_permission(campground_id,'accommodation.manage')
  or icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
  or icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
);

alter policy campsites_read
on public.campsites
using (
  icamp_private.has_campground_permission(campground_id,'accommodation.read')
  or icamp_private.has_campground_permission(campground_id,'accommodation.manage')
  or icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
);

alter policy rental_cottages_read
on public.rental_cottages
using (
  icamp_private.has_campground_permission(campground_id,'accommodation.read')
  or icamp_private.has_campground_permission(campground_id,'accommodation.manage')
  or icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
);

alter policy permanent_units_read
on public.permanent_units
using (
  icamp_private.has_campground_permission(campground_id,'accommodation.read')
  or icamp_private.has_campground_permission(campground_id,'accommodation.manage')
  or icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
);

create policy campground_visitor_policies_read
on public.campground_visitor_policies
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
  or icamp_private.has_campground_permission(campground_id,'campground.configuration')
  or icamp_private.has_campground_permission(campground_id,'pricing.manage')
);

create policy campground_visitor_policies_insert
on public.campground_visitor_policies
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'campground.configuration')
  and icamp_private.has_campground_permission(campground_id,'pricing.manage')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy campground_visitor_policies_update
on public.campground_visitor_policies
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

create policy visitor_registrations_read
on public.visitor_registrations
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
  or icamp_private.has_campground_permission(campground_id,'payment.read')
);

create policy visitor_registrations_insert
on public.visitor_registrations
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'visitor.register')
  and registered_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id = registered_by_user_id
);

create policy visitor_registrations_update
on public.visitor_registrations
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'visitor.register')
)
with check (
  icamp_private.has_campground_permission(campground_id,'visitor.register')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy visitor_registration_events_read
on public.visitor_registration_events
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
  or icamp_private.has_campground_permission(campground_id,'payment.read')
);

create policy visitor_registration_events_insert
on public.visitor_registration_events
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'visitor.register')
  and actor_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy visitor_registration_payments_read
on public.visitor_registration_payments
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'visitor.register')
  or icamp_private.has_campground_permission(campground_id,'payment.read')
);

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,'visitor.register'
from icamp_private.roles r
where r.role_kind='template'
  and r.role_code in ('security','campground_manager')
on conflict do nothing;

comment on table public.campground_visitor_policies is
  'Build 055 campground visitor identity/contact configuration, rule text and canonical day/week fee references.';
comment on table public.visitor_registrations is
  'Build 055 formal reservation-hosted visitor registrations with immutable identity/contact policy, capacity, fee and validity snapshots.';
comment on table public.visitor_registration_events is
  'Build 055 append-only visitor registration lifecycle evidence.';
comment on table public.visitor_registration_payments is
  'Build 055 provider-neutral visitor fee payment attempts; raw payment credentials are excluded.';
comment on table icamp_private.visitor_registration_payment_provider_events is
  'Build 055 normalized visitor payment provider evidence; raw webhook bodies and payment credentials are excluded.';
comment on column public.visitor_registrations.identity_verification_mode_snapshot is
  'Verification method evidence only. Government ID numbers/images are not stored by Build 055.';
comment on column public.visitor_registrations.visitor_rule_snapshot is
  'Human-readable visitor rule. Build 056+ owns credential issuance and Build 060 owns enforceable access rules.';
