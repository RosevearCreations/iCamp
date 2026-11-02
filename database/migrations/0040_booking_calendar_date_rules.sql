-- iCamp Build 032
-- Booking Calendar & Date Rules.

create table public.campground_booking_rules (
  campground_id uuid primary key,
  organization_id uuid not null,
  check_in_time time without time zone not null default time '15:00',
  check_out_time time without time zone not null default time '11:00',
  minimum_booking_lead_days integer not null default 0
    check (minimum_booking_lead_days between 0 and 365),
  maximum_booking_lead_days integer not null default 365
    check (maximum_booking_lead_days between 1 and 1095),
  minimum_stay_nights integer not null default 1
    check (minimum_stay_nights between 1 and 365),
  maximum_stay_nights integer not null default 30
    check (maximum_stay_nights between 1 and 365),
  weekend_iso_days smallint[] not null default array[6, 7]::smallint[],
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_booking_rules_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_booking_rules_lead_window_check
    check (maximum_booking_lead_days >= minimum_booking_lead_days),
  constraint campground_booking_rules_stay_window_check
    check (maximum_stay_nights >= minimum_stay_nights),
  constraint campground_booking_rules_weekend_days_check
    check (
      cardinality(weekend_iso_days) between 1 and 7
      and weekend_iso_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    )
);

create table public.booking_calendar_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  period_kind text not null check (period_kind in ('holiday', 'season')),
  code text not null
    check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 120),
  starts_on date not null,
  ends_on date not null,
  minimum_stay_nights integer
    check (minimum_stay_nights is null or minimum_stay_nights between 1 and 365),
  maximum_stay_nights integer
    check (maximum_stay_nights is null or maximum_stay_nights between 1 and 365),
  notes text check (notes is null or char_length(notes) <= 1000),
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
  constraint booking_calendar_periods_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint booking_calendar_periods_dates_check
    check (ends_on >= starts_on),
  constraint booking_calendar_periods_stay_window_check
    check (
      minimum_stay_nights is null
      or maximum_stay_nights is null
      or maximum_stay_nights >= minimum_stay_nights
    ),
  constraint booking_calendar_periods_archive_shape_check
    check (
      (is_active and archived_at is null)
      or
      (not is_active and archived_at is not null)
    ),
  constraint booking_calendar_periods_scope_code_start_unique
    unique (campground_id, period_kind, code, starts_on)
);

create index campground_booking_rules_scope_fk_idx
  on public.campground_booking_rules (organization_id, campground_id);

create index campground_booking_rules_updated_by_fk_idx
  on public.campground_booking_rules (updated_by_user_id)
  where updated_by_user_id is not null;

create index booking_calendar_periods_scope_idx
  on public.booking_calendar_periods (
    organization_id,
    campground_id,
    period_kind,
    is_active,
    starts_on,
    ends_on
  );

create index booking_calendar_periods_created_by_fk_idx
  on public.booking_calendar_periods (created_by_user_id)
  where created_by_user_id is not null;

create index booking_calendar_periods_updated_by_fk_idx
  on public.booking_calendar_periods (updated_by_user_id)
  where updated_by_user_id is not null;

create or replace function icamp_private.guard_booking_calendar_period_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
    or old.campground_id is distinct from new.campground_id
    or old.period_kind is distinct from new.period_kind
    or old.code is distinct from new.code
    or old.display_name is distinct from new.display_name
    or old.starts_on is distinct from new.starts_on
    or old.ends_on is distinct from new.ends_on
    or old.minimum_stay_nights is distinct from new.minimum_stay_nights
    or old.maximum_stay_nights is distinct from new.maximum_stay_nights
    or old.notes is distinct from new.notes
    or old.created_by_user_id is distinct from new.created_by_user_id
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Booking calendar periods are append-preserved; archive and create a replacement instead';
  end if;

  if not old.is_active and new.is_active then
    raise exception 'Archived booking calendar periods cannot be reactivated';
  end if;

  if old.is_active and not new.is_active then
    if new.archived_at is null or new.updated_by_user_id is null then
      raise exception 'Archiving a booking calendar period requires actor and timestamp evidence';
    end if;
  elsif old.is_active is distinct from new.is_active
    or old.archived_at is distinct from new.archived_at
  then
    raise exception 'Invalid booking calendar period archive transition';
  end if;

  return new;
end;
$$;

create or replace function icamp_private.prevent_booking_season_overlap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.period_kind <> 'season' or not new.is_active then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('icamp-booking-season:' || new.campground_id::text, 0)
  );

  if exists (
    select 1
    from public.booking_calendar_periods existing
    where existing.id <> new.id
      and existing.campground_id = new.campground_id
      and existing.period_kind = 'season'
      and existing.is_active
      and daterange(existing.starts_on, existing.ends_on + 1, '[)')
          && daterange(new.starts_on, new.ends_on + 1, '[)')
  ) then
    raise exception 'Active booking seasons cannot overlap';
  end if;

  return new;
end;
$$;

create trigger campground_booking_rules_touch_row
before update on public.campground_booking_rules
for each row execute function icamp_private.touch_row();

create trigger booking_calendar_periods_guard_mutation
before update on public.booking_calendar_periods
for each row execute function icamp_private.guard_booking_calendar_period_mutation();

create trigger booking_calendar_periods_no_overlapping_seasons
before insert or update of starts_on, ends_on, period_kind, is_active
on public.booking_calendar_periods
for each row execute function icamp_private.prevent_booking_season_overlap();

create trigger booking_calendar_periods_touch_row
before update on public.booking_calendar_periods
for each row execute function icamp_private.touch_row();

alter table public.campground_booking_rules enable row level security;
alter table public.campground_booking_rules force row level security;
alter table public.booking_calendar_periods enable row level security;
alter table public.booking_calendar_periods force row level security;

revoke all on public.campground_booking_rules from public;
revoke all on public.booking_calendar_periods from public;

do $build032_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.campground_booking_rules from anon';
    execute 'revoke all on public.booking_calendar_periods from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.campground_booking_rules from authenticated';
    execute 'revoke all on public.booking_calendar_periods from authenticated';
  end if;
end
$build032_permissions$;

grant select, insert, update on public.campground_booking_rules to icamp_app;
grant select, insert, update on public.booking_calendar_periods to icamp_app;

create policy campground_booking_rules_read
on public.campground_booking_rules
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  or icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'reservation.override')
);

create policy campground_booking_rules_insert
on public.campground_booking_rules
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy campground_booking_rules_update
on public.campground_booking_rules
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy booking_calendar_periods_read
on public.booking_calendar_periods
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  or icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'reservation.override')
);

create policy booking_calendar_periods_insert
on public.booking_calendar_periods
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy booking_calendar_periods_archive
on public.booking_calendar_periods
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.campground_booking_rules is
  'Build 032 campground booking-time, lead-window, stay-length and weekend rules.';

comment on table public.booking_calendar_periods is
  'Build 032 append-preserved holiday/season calendar periods consumed by later availability and pricing builds.';
