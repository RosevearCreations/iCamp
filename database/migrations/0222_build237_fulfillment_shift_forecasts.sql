-- Build 237: explicit, tenant-owned planning assumptions for read-only
-- workload forecasts. Existing Build 190 shift and availability evidence is
-- authoritative; no assumed staff hours, payroll or dispatch are generated.
create table public.service_fulfillment_planning_settings (
  organization_id uuid not null,
  campground_id uuid not null,
  morning_start time not null,
  morning_end time not null,
  afternoon_start time not null,
  afternoon_end time not null,
  evening_start time not null,
  evening_end time not null,
  max_units_per_staff_window integer
    check (max_units_per_staff_window between 1 and 1000),
  updated_by_user_id uuid not null references icamp_private.user_accounts(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  primary key (organization_id, campground_id),
  foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id) on delete restrict,
  constraint service_fulfillment_planning_windows_valid check (
    morning_start >= time '04:00' and evening_end <= time '23:59'
    and morning_start < morning_end and morning_end <= afternoon_start
    and afternoon_start < afternoon_end and afternoon_end <= evening_start
    and evening_start < evening_end
  )
);

create function icamp_private.guard_service_fulfillment_planning_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and row(old.organization_id, old.campground_id,
    old.created_at) is distinct from row(new.organization_id,
    new.campground_id, new.created_at) then
    raise exception 'Fulfillment planning scope is immutable';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := statement_timestamp();
    new.row_version := 1;
  end if;
  if new.updated_by_user_id is distinct from
    nullif(pg_catalog.current_setting('icamp.user_id', true), '')::uuid
    or not icamp_private.has_campground_permission(new.campground_id, 'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id, 'schedule.manage')
    or not icamp_private.has_campground_permission(new.campground_id, 'reservation.modify') then
    raise exception 'Authorized campground schedule supervisor required';
  end if;
  return new;
end;
$$;
create trigger service_fulfillment_planning_settings_guard
before insert or update on public.service_fulfillment_planning_settings
for each row execute function icamp_private.guard_service_fulfillment_planning_settings();
create trigger service_fulfillment_planning_settings_touch
before update on public.service_fulfillment_planning_settings
for each row execute function icamp_private.touch_row();

alter table public.service_fulfillment_planning_settings enable row level security;
alter table public.service_fulfillment_planning_settings force row level security;
revoke all on public.service_fulfillment_planning_settings from public;
do $roles$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.service_fulfillment_planning_settings from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.service_fulfillment_planning_settings from authenticated;
  end if;
end $roles$;
grant select, insert, update on public.service_fulfillment_planning_settings to icamp_app;
create policy service_fulfillment_planning_settings_read
on public.service_fulfillment_planning_settings for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'staff.manage')
  and icamp_private.has_campground_permission(campground_id, 'schedule.manage')
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);
create policy service_fulfillment_planning_settings_insert
on public.service_fulfillment_planning_settings for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'staff.manage')
  and icamp_private.has_campground_permission(campground_id, 'schedule.manage')
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  and updated_by_user_id = icamp_private.request_user_id()
);
create policy service_fulfillment_planning_settings_update
on public.service_fulfillment_planning_settings for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'staff.manage')
  and icamp_private.has_campground_permission(campground_id, 'schedule.manage')
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'staff.manage')
  and icamp_private.has_campground_permission(campground_id, 'schedule.manage')
  and icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  and updated_by_user_id = icamp_private.request_user_id()
);
comment on table public.service_fulfillment_planning_settings is
  'Build 237 campground-owned local time windows and optional unit limits. Read-only forecasts reuse staff shift records without inventing worker availability or dispatch authority.';
