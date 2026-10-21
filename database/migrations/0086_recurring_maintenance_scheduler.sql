-- iCamp Build 067
-- Recurring Maintenance Scheduler.
--
-- Rich maintenance recurrence remains a maintenance-domain concern while durable
-- ticking/queueing reuses the Build 007 job scheduler. Each due occurrence
-- materializes a canonical Build 065 work order or immutable missed-occurrence
-- evidence.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values (
  'maintenance.schedule',
  'Create, activate and deactivate recurring maintenance schedules.',
  'elevated'
)
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join (
  values
    ('maintenance_main_foreman', 'maintenance.schedule'),
    ('campground_manager', 'maintenance.schedule'),
    ('owner_admin', 'maintenance.schedule')
) as grants(role_code, permission_key)
  on r.role_code = grants.role_code
 and r.role_kind = 'template'
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict do nothing;

create table public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  category_id uuid not null,
  priority_policy_id uuid not null,
  section_id uuid,
  asset_id uuid,
  accommodation_id uuid,
  location_description text
    check (
      location_description is null
      or char_length(trim(location_description)) between 1 and 240
    ),
  title text not null
    check (char_length(trim(title)) between 3 and 160),
  description text
    check (description is null or char_length(description) <= 4000),
  recurrence_kind text not null
    check (
      recurrence_kind in (
        'hourly',
        'every_n_hours',
        'daily',
        'weekly',
        'monthly',
        'seasonal',
        'custom'
      )
    ),
  interval_value integer,
  weekday smallint,
  month_day smallint,
  season_month smallint,
  season_day smallint,
  first_occurrence_local timestamp without time zone not null,
  next_occurrence_at timestamptz not null,
  ends_at timestamptz,
  missed_after_minutes integer not null default 1440
    check (missed_after_minutes between 0 and 10080),
  catch_up_mode text not null default 'create_late'
    check (catch_up_mode in ('create_late','mark_missed')),
  is_active boolean not null default true,
  created_by_user_id uuid not null
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
  constraint maintenance_schedules_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint maintenance_schedules_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_schedules_category_fk
    foreign key (organization_id, campground_id, category_id)
    references public.maintenance_categories(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_schedules_priority_fk
    foreign key (organization_id, campground_id, priority_policy_id)
    references public.maintenance_priority_policies(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint maintenance_schedules_section_fk
    foreign key (organization_id, campground_id, section_id)
    references public.campground_sections(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_schedules_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_schedules_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_schedules_location_check
    check (
      section_id is not null
      or asset_id is not null
      or accommodation_id is not null
      or location_description is not null
    ),
  constraint maintenance_schedules_end_check
    check (ends_at is null or ends_at >= next_occurrence_at),
  constraint maintenance_schedules_recurrence_shape_check
    check (
      (
        recurrence_kind = 'hourly'
        and interval_value = 1
        and weekday is null
        and month_day is null
        and season_month is null
        and season_day is null
      )
      or
      (
        recurrence_kind = 'every_n_hours'
        and interval_value between 2 and 168
        and weekday is null
        and month_day is null
        and season_month is null
        and season_day is null
      )
      or
      (
        recurrence_kind = 'daily'
        and interval_value = 1
        and weekday is null
        and month_day is null
        and season_month is null
        and season_day is null
      )
      or
      (
        recurrence_kind = 'weekly'
        and interval_value is null
        and weekday between 0 and 6
        and month_day is null
        and season_month is null
        and season_day is null
      )
      or
      (
        recurrence_kind = 'monthly'
        and interval_value is null
        and weekday is null
        and month_day between 1 and 31
        and season_month is null
        and season_day is null
      )
      or
      (
        recurrence_kind = 'seasonal'
        and interval_value is null
        and weekday is null
        and month_day is null
        and season_month between 1 and 12
        and season_day between 1 and 31
      )
      or
      (
        recurrence_kind = 'custom'
        and interval_value between 60 and 525600
        and weekday is null
        and month_day is null
        and season_month is null
        and season_day is null
      )
    )
);

create table public.maintenance_schedule_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  schedule_id uuid not null,
  scheduled_for timestamptz not null,
  state text not null
    check (state in ('materialized','missed','skipped')),
  work_order_id uuid,
  reason_code text
    check (
      reason_code is null
      or (
        reason_code ~ '^[a-z][a-z0-9_.-]{1,119}$'
        and char_length(reason_code) <= 120
      )
    ),
  processed_at timestamptz not null default statement_timestamp(),
  processed_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  constraint maintenance_schedule_occurrences_scope_unique
    unique (schedule_id, scheduled_for),
  constraint maintenance_schedule_occurrences_schedule_fk
    foreign key (organization_id, campground_id, schedule_id)
    references public.maintenance_schedules(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_schedule_occurrences_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_schedule_occurrences_state_check
    check (
      (
        state = 'materialized'
        and work_order_id is not null
        and reason_code is null
      )
      or
      (
        state in ('missed','skipped')
        and work_order_id is null
        and reason_code is not null
      )
    )
);

create index maintenance_schedules_scope_active_idx
  on public.maintenance_schedules(
    organization_id,
    campground_id,
    is_active,
    next_occurrence_at
  );

create index maintenance_schedules_category_scope_fk_idx
  on public.maintenance_schedules(
    organization_id,
    campground_id,
    category_id
  );

create index maintenance_schedules_priority_scope_fk_idx
  on public.maintenance_schedules(
    organization_id,
    campground_id,
    priority_policy_id
  );

create index maintenance_schedules_section_scope_fk_idx
  on public.maintenance_schedules(
    organization_id,
    campground_id,
    section_id
  )
  where section_id is not null;

create index maintenance_schedules_asset_scope_fk_idx
  on public.maintenance_schedules(
    organization_id,
    campground_id,
    asset_id
  )
  where asset_id is not null;

create index maintenance_schedules_accommodation_scope_fk_idx
  on public.maintenance_schedules(
    organization_id,
    campground_id,
    accommodation_id
  )
  where accommodation_id is not null;

create index maintenance_schedules_created_by_idx
  on public.maintenance_schedules(created_by_user_id);

create index maintenance_schedules_updated_by_idx
  on public.maintenance_schedules(updated_by_user_id);

create index maintenance_schedule_occurrences_scope_schedule_fk_idx
  on public.maintenance_schedule_occurrences(
    organization_id,
    campground_id,
    schedule_id
  );

create index maintenance_schedule_occurrences_scope_work_order_fk_idx
  on public.maintenance_schedule_occurrences(
    organization_id,
    campground_id,
    work_order_id
  )
  where work_order_id is not null;

create index maintenance_schedule_occurrences_history_idx
  on public.maintenance_schedule_occurrences(
    campground_id,
    schedule_id,
    scheduled_for desc
  );

create index maintenance_schedule_occurrences_processed_by_idx
  on public.maintenance_schedule_occurrences(processed_by_user_id)
  where processed_by_user_id is not null;

create trigger maintenance_schedules_touch
before update on public.maintenance_schedules
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.guard_maintenance_schedule_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id', true), '')::uuid;

  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.category_id is distinct from new.category_id
     or old.priority_policy_id is distinct from new.priority_policy_id
     or old.section_id is distinct from new.section_id
     or old.asset_id is distinct from new.asset_id
     or old.accommodation_id is distinct from new.accommodation_id
     or old.location_description is distinct from new.location_description
     or old.title is distinct from new.title
     or old.description is distinct from new.description
     or old.recurrence_kind is distinct from new.recurrence_kind
     or old.interval_value is distinct from new.interval_value
     or old.weekday is distinct from new.weekday
     or old.month_day is distinct from new.month_day
     or old.season_month is distinct from new.season_month
     or old.season_day is distinct from new.season_day
     or old.first_occurrence_local is distinct from new.first_occurrence_local
     or old.missed_after_minutes is distinct from new.missed_after_minutes
     or old.catch_up_mode is distinct from new.catch_up_mode
     or old.created_by_user_id is distinct from new.created_by_user_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Maintenance schedule definition is immutable; deactivate and create a replacement schedule';
  end if;

  if old.next_occurrence_at is distinct from new.next_occurrence_at
     and current_setting('icamp.maintenance_scheduler', true) is distinct from '1' then
    raise exception 'Only the maintenance scheduler may advance next occurrence';
  end if;

  if old.ends_at is distinct from new.ends_at then
    raise exception 'Maintenance schedule end boundary is immutable';
  end if;

  if old.is_active is distinct from new.is_active
     and not icamp_private.has_campground_permission(
       new.campground_id,
       'maintenance.schedule'
     ) then
    raise exception 'maintenance.schedule permission is required';
  end if;

  if new.updated_by_user_id is distinct from actor_id
     and current_setting('icamp.maintenance_scheduler', true) is distinct from '1' then
    raise exception 'updated_by_user_id must match the request actor';
  end if;

  return new;
end;
$$;

create trigger maintenance_schedules_guard_update
before update on public.maintenance_schedules
for each row execute function icamp_private.guard_maintenance_schedule_update();

create or replace function icamp_private.next_maintenance_occurrence(
  p_schedule_id uuid,
  p_after timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.maintenance_schedules%rowtype;
  timezone_name text;
  local_after timestamp without time zone;
  local_clock time without time zone;
  candidate_local timestamp without time zone;
  next_month timestamp without time zone;
  last_day integer;
  next_year integer;
  season_start date;
begin
  select ms, c.timezone
    into s, timezone_name
  from public.maintenance_schedules ms
  join public.campgrounds c
    on c.id = ms.campground_id
   and c.organization_id = ms.organization_id
  where ms.id = p_schedule_id;

  if not found then
    raise exception 'Maintenance schedule is unavailable';
  end if;

  local_after := p_after at time zone timezone_name;
  local_clock := s.first_occurrence_local::time;

  case s.recurrence_kind
    when 'hourly' then
      candidate_local := local_after + interval '1 hour';
    when 'every_n_hours' then
      candidate_local := local_after + make_interval(hours => s.interval_value);
    when 'daily' then
      candidate_local := (local_after::date + 1) + local_clock;
    when 'weekly' then
      candidate_local := (local_after::date + 7) + local_clock;
    when 'monthly' then
      next_month := date_trunc('month', local_after) + interval '1 month';
      last_day := extract(
        day from date_trunc('month', next_month) + interval '1 month - 1 day'
      )::integer;
      candidate_local :=
        next_month::date
        + (least(s.month_day::integer, last_day) - 1)
        + local_clock;
    when 'seasonal' then
      next_year := extract(year from local_after)::integer + 1;
      season_start := make_date(next_year, s.season_month::integer, 1);
      last_day := extract(
        day from date_trunc('month', season_start::timestamp)
          + interval '1 month - 1 day'
      )::integer;
      candidate_local :=
        season_start
        + (least(s.season_day::integer, last_day) - 1)
        + local_clock;
    when 'custom' then
      return p_after + make_interval(mins => s.interval_value);
    else
      raise exception 'Unsupported maintenance recurrence kind';
  end case;

  return candidate_local at time zone timezone_name;
end;
$$;

create or replace function icamp_private.sync_maintenance_job_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cadence integer;
  schedule_key_value text;
begin
  cadence := case new.recurrence_kind
    when 'hourly' then 3600
    when 'every_n_hours' then new.interval_value * 3600
    when 'daily' then 86400
    when 'weekly' then 604800
    when 'custom' then new.interval_value * 60
    else 31536000
  end;

  schedule_key_value := 'maintenance.schedule.' || new.id::text;

  insert into icamp_private.job_schedules (
    schedule_key,
    queue_name,
    job_type,
    organization_id,
    campground_id,
    payload,
    cadence_seconds,
    next_run_at,
    max_attempts,
    retry_base_seconds,
    active
  )
  values (
    schedule_key_value,
    'maintenance',
    'maintenance.schedule.materialize',
    new.organization_id,
    new.campground_id,
    jsonb_build_object('maintenanceScheduleId', new.id::text),
    cadence,
    new.next_occurrence_at,
    5,
    30,
    new.is_active
      and (new.ends_at is null or new.next_occurrence_at <= new.ends_at)
  )
  on conflict (schedule_key)
  do update set
    queue_name = excluded.queue_name,
    job_type = excluded.job_type,
    organization_id = excluded.organization_id,
    campground_id = excluded.campground_id,
    payload = excluded.payload,
    cadence_seconds = excluded.cadence_seconds,
    next_run_at = excluded.next_run_at,
    max_attempts = excluded.max_attempts,
    retry_base_seconds = excluded.retry_base_seconds,
    active = excluded.active,
    updated_at = statement_timestamp();

  return new;
end;
$$;

create trigger maintenance_schedules_sync_job_schedule
after insert or update of next_occurrence_at,is_active on public.maintenance_schedules
for each row execute function icamp_private.sync_maintenance_job_schedule();

alter table public.maintenance_schedules enable row level security;
alter table public.maintenance_schedules force row level security;
alter table public.maintenance_schedule_occurrences enable row level security;
alter table public.maintenance_schedule_occurrences force row level security;

revoke all on public.maintenance_schedules from public;
revoke all on public.maintenance_schedule_occurrences from public;

grant select,insert,update on public.maintenance_schedules to icamp_app;
grant select,insert on public.maintenance_schedule_occurrences to icamp_app;

do $revoke_data_api$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format(
        'revoke all on public.maintenance_schedules from %I',
        role_name
      );
      execute format(
        'revoke all on public.maintenance_schedule_occurrences from %I',
        role_name
      );
    end if;
  end loop;
end
$revoke_data_api$;

create policy maintenance_schedules_read
on public.maintenance_schedules
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
);

create policy maintenance_schedules_insert
on public.maintenance_schedules
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_schedules_update
on public.maintenance_schedules
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  and (
    updated_by_user_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
    or current_setting('icamp.maintenance_scheduler',true) = '1'
  )
);

create policy maintenance_schedule_occurrences_read
on public.maintenance_schedule_occurrences
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
);

create policy maintenance_schedule_occurrences_insert
on public.maintenance_schedule_occurrences
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  and processed_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.maintenance_schedules is
  'Build 067 rich campground recurrence definitions synchronized to the private Build 007 durable scheduler.';

comment on table public.maintenance_schedule_occurrences is
  'Build 067 immutable discrete recurrence history linking each materialized occurrence to a canonical Build 065 work order.';

comment on function icamp_private.next_maintenance_occurrence(uuid,timestamptz) is
  'Build 067 timezone-aware next-occurrence calculation for maintenance recurrence.';
