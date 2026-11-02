-- iCamp Build 040
-- Add-Ons, Passes and Service Fees.

create table public.booking_charge_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  scope_kind text not null
    check (scope_kind in ('campground', 'accommodation_type', 'accommodation')),
  accommodation_kind text
    check (
      accommodation_kind is null
      or accommodation_kind in ('campsite', 'rental_cottage')
    ),
  accommodation_id uuid,
  charge_kind text not null
    check (charge_kind in ('add_on', 'pass', 'service_fee')),
  application_mode text not null default 'optional'
    check (application_mode in ('optional', 'automatic')),
  code text not null
    check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 120),
  description text
    check (description is null or char_length(description) <= 1000),
  currency_code text not null default 'CAD'
    check (currency_code ~ '^[A-Z]{3}$'),
  pricing_basis text not null
    check (
      pricing_basis in (
        'per_stay',
        'per_night',
        'per_unit',
        'percent_of_stay'
      )
    ),
  unit_price_cents integer
    check (unit_price_cents is null or unit_price_cents >= 0),
  percentage_basis_points integer
    check (
      percentage_basis_points is null
      or percentage_basis_points between 0 and 10000
    ),
  unit_label text
    check (unit_label is null or char_length(trim(unit_label)) between 1 and 40),
  pass_duration_days smallint
    check (pass_duration_days is null or pass_duration_days between 1 and 365),
  minimum_quantity smallint not null default 1
    check (minimum_quantity between 1 and 100),
  maximum_quantity smallint not null default 1
    check (maximum_quantity between 1 and 100),
  tax_category_code text
    check (
      tax_category_code is null
      or tax_category_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  fee_category_code text
    check (
      fee_category_code is null
      or fee_category_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  starts_on date,
  ends_on date,
  is_public boolean not null default true,
  is_active boolean not null default true,
  archived_at timestamptz,
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
  constraint booking_charge_catalog_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint booking_charge_catalog_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint booking_charge_catalog_scope_shape_check
    check (
      (
        scope_kind = 'campground'
        and accommodation_kind is null
        and accommodation_id is null
      )
      or
      (
        scope_kind = 'accommodation_type'
        and accommodation_kind is not null
        and accommodation_id is null
      )
      or
      (
        scope_kind = 'accommodation'
        and accommodation_kind is null
        and accommodation_id is not null
      )
    ),
  constraint booking_charge_catalog_price_shape_check
    check (
      (
        pricing_basis = 'percent_of_stay'
        and unit_price_cents is null
        and percentage_basis_points is not null
        and minimum_quantity = 1
        and maximum_quantity = 1
      )
      or
      (
        pricing_basis <> 'percent_of_stay'
        and unit_price_cents is not null
        and percentage_basis_points is null
      )
    ),
  constraint booking_charge_catalog_pass_shape_check
    check (
      (charge_kind = 'pass' and pass_duration_days is not null)
      or
      (charge_kind <> 'pass' and pass_duration_days is null)
    ),
  constraint booking_charge_catalog_automatic_shape_check
    check (
      application_mode = 'optional'
      or (
        application_mode = 'automatic'
        and charge_kind = 'service_fee'
        and minimum_quantity = 1
        and maximum_quantity = 1
      )
    ),
  constraint booking_charge_catalog_quantity_window_check
    check (maximum_quantity >= minimum_quantity),
  constraint booking_charge_catalog_date_window_check
    check (
      starts_on is null
      or ends_on is null
      or ends_on >= starts_on
    ),
  constraint booking_charge_catalog_archive_shape_check
    check (
      (is_active and archived_at is null)
      or
      (not is_active and archived_at is not null)
    ),
  constraint booking_charge_catalog_scope_code_unique
    unique (campground_id, code)
);

create index booking_charge_catalog_campground_fk_idx
  on public.booking_charge_catalog (organization_id, campground_id);

create index booking_charge_catalog_accommodation_fk_idx
  on public.booking_charge_catalog (
    organization_id,
    campground_id,
    accommodation_id
  )
  where accommodation_id is not null;

create index booking_charge_catalog_public_lookup_idx
  on public.booking_charge_catalog (
    campground_id,
    is_active,
    is_public,
    charge_kind,
    scope_kind,
    accommodation_kind,
    accommodation_id
  );

create index booking_charge_catalog_created_by_fk_idx
  on public.booking_charge_catalog (created_by_user_id)
  where created_by_user_id is not null;

create index booking_charge_catalog_updated_by_fk_idx
  on public.booking_charge_catalog (updated_by_user_id)
  where updated_by_user_id is not null;

create or replace function icamp_private.guard_booking_charge_catalog_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
    or old.campground_id is distinct from new.campground_id
    or old.scope_kind is distinct from new.scope_kind
    or old.accommodation_kind is distinct from new.accommodation_kind
    or old.accommodation_id is distinct from new.accommodation_id
    or old.code is distinct from new.code
    or old.created_by_user_id is distinct from new.created_by_user_id
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Booking charge identity and scope are immutable';
  end if;

  if not old.is_active and new.is_active then
    raise exception 'Archived booking charges cannot be reactivated';
  end if;

  if old.is_active and not new.is_active then
    if new.archived_at is null or new.updated_by_user_id is null then
      raise exception 'Archiving a booking charge requires actor and timestamp evidence';
    end if;
  elsif old.is_active is distinct from new.is_active
    or old.archived_at is distinct from new.archived_at
  then
    raise exception 'Invalid booking charge archive transition';
  end if;

  return new;
end;
$$;

create trigger booking_charge_catalog_guard_mutation
before update on public.booking_charge_catalog
for each row execute function icamp_private.guard_booking_charge_catalog_mutation();

create trigger booking_charge_catalog_touch_row
before update on public.booking_charge_catalog
for each row execute function icamp_private.touch_row();

alter table public.booking_charge_catalog enable row level security;
alter table public.booking_charge_catalog force row level security;

revoke all on public.booking_charge_catalog from public;

do $build040_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.booking_charge_catalog from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.booking_charge_catalog from authenticated';
  end if;
end
$build040_permissions$;

grant select, insert, update on public.booking_charge_catalog to icamp_app;

create policy booking_charge_catalog_read
on public.booking_charge_catalog
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
  or icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);

create policy booking_charge_catalog_insert
on public.booking_charge_catalog
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  and (
    updated_by_user_id is null
    or updated_by_user_id =
      nullif((select current_setting('icamp.user_id', true)), '')::uuid
  )
);

create policy booking_charge_catalog_update
on public.booking_charge_catalog
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'pricing.manage')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.booking_charge_catalog is
  'Build 040 campground-scoped add-ons, visitor passes and service fees consumed by server-authoritative booking quotes.';

comment on column public.booking_charge_catalog.tax_category_code is
  'Stable tax-classification hook for later configurable tax calculation; Build 040 does not calculate tax.';

comment on column public.booking_charge_catalog.fee_category_code is
  'Stable fee-classification hook for later financial configuration and reporting.';

comment on column public.booking_charge_catalog.application_mode is
  'Optional items require an explicit later checkout selection; automatic service fees are included whenever applicable.';
