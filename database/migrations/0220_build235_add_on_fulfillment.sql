-- Build 235: campground-owned daily add-on limits and reservation-linked work.
-- An absent daily_capacity means unlimited; it is not an inferred stock count.
alter table public.booking_charge_catalog
  add column daily_capacity integer
    check (daily_capacity between 1 and 10000);

create table public.service_fulfillment_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  charge_line_id uuid not null unique
    references public.reservation_charge_lines(id) on delete restrict,
  charge_catalog_id uuid not null
    references public.booking_charge_catalog(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 1000),
  service_date date not null,
  service_window text not null default 'anytime'
    check (service_window in ('anytime','morning','afternoon','evening')),
  job_state text not null default 'queued'
    check (job_state in ('queued','scheduled','in_progress','blocked','completed')),
  staff_note text check (staff_note is null or char_length(staff_note) <= 500),
  completed_at timestamptz,
  updated_by_user_id uuid references icamp_private.user_accounts(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint service_fulfillment_jobs_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on delete restrict,
  constraint service_fulfillment_jobs_completion_shape
    check ((job_state = 'completed') = (completed_at is not null))
);

create index service_fulfillment_jobs_day_capacity_idx
  on public.service_fulfillment_jobs
    (charge_catalog_id, service_date, campground_id);
create index service_fulfillment_jobs_campground_queue_idx
  on public.service_fulfillment_jobs
    (campground_id, job_state, service_date, created_at);
create index service_fulfillment_jobs_reservation_idx
  on public.service_fulfillment_jobs (reservation_id);

-- Original accepted line snapshots remain immutable; historical active add-ons
-- are represented once. Cancelled/completed stays are not reopened as work.
insert into public.service_fulfillment_jobs (
  organization_id, campground_id, reservation_id, charge_line_id,
  charge_catalog_id, quantity, service_date
)
select l.organization_id, l.campground_id, l.reservation_id, l.id,
       l.charge_catalog_id, l.quantity, r.arrival_date
from public.reservation_charge_lines l
join public.reservations r on r.id = l.reservation_id
  and r.organization_id = l.organization_id
  and r.campground_id = l.campground_id
where l.charge_kind = 'add_on' and l.application_mode = 'optional'
  and l.charge_catalog_id is not null
  and r.status in ('pending','confirmed','checked_in')
on conflict (charge_line_id) do nothing;

-- Database guard is authoritative even when a writer bypasses the UI. Locking
-- the catalog row coordinates with capacity edits; the per-day advisory lock
-- serializes simultaneous checkouts and staff scheduling decisions.
create function icamp_private.guard_service_fulfillment_job()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  booking record;
  configured_capacity integer;
  reserved_quantity bigint;
begin
  if tg_op = 'UPDATE' then
    if row(old.organization_id, old.campground_id, old.reservation_id,
      old.charge_line_id, old.charge_catalog_id, old.quantity, old.created_at)
      is distinct from
      row(new.organization_id, new.campground_id, new.reservation_id,
      new.charge_line_id, new.charge_catalog_id, new.quantity, new.created_at)
    then
      raise exception 'Fulfillment scope and quoted quantities are immutable';
    end if;
    if not (
      (old.job_state = 'queued' and new.job_state in ('scheduled','blocked'))
      or (old.job_state = 'scheduled' and new.job_state in ('in_progress','blocked'))
      or (old.job_state = 'in_progress' and new.job_state in ('completed','blocked'))
      or (old.job_state = 'blocked' and new.job_state = 'scheduled')
    ) then
      raise exception 'Unsupported fulfillment state change';
    end if;
    if new.updated_by_user_id is null then
      raise exception 'Fulfillment updates require a staff actor';
    end if;
  end if;

  select r.arrival_date, r.departure_date, r.status into booking
  from public.reservations r
  where r.id = new.reservation_id
    and r.organization_id = new.organization_id
    and r.campground_id = new.campground_id;
  if not found or booking.status not in ('pending','confirmed','checked_in')
     or new.service_date < booking.arrival_date
     or new.service_date >= booking.departure_date then
    raise exception 'Fulfillment requires an active reservation date';
  end if;
  if not exists (
    select 1 from public.reservation_charge_lines l
    where l.id = new.charge_line_id
      and l.organization_id = new.organization_id
      and l.campground_id = new.campground_id
      and l.reservation_id = new.reservation_id
      and l.charge_catalog_id = new.charge_catalog_id
      and l.quantity = new.quantity
      and l.charge_kind = 'add_on' and l.application_mode = 'optional'
  ) then
    raise exception 'Fulfillment must match its accepted add-on line';
  end if;
  if new.job_state = 'completed' and new.completed_at is null then
    raise exception 'Completion needs a timestamp';
  end if;
  if new.job_state <> 'completed' and new.completed_at is not null then
    raise exception 'Completion timestamp is only valid for completed work';
  end if;

  select daily_capacity into configured_capacity
  from public.booking_charge_catalog
  where id = new.charge_catalog_id
    and organization_id = new.organization_id
    and campground_id = new.campground_id
    and charge_kind = 'add_on' and application_mode = 'optional'
  for share;
  if not found then raise exception 'Fulfillment service scope is invalid'; end if;
  if configured_capacity is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.charge_catalog_id::text || ':' || new.service_date::text, 0)
    );
    select coalesce(sum(j.quantity), 0) into reserved_quantity
    from public.service_fulfillment_jobs j
    join public.reservations r on r.id = j.reservation_id
    where j.charge_catalog_id = new.charge_catalog_id
      and j.campground_id = new.campground_id
      and j.service_date = new.service_date
      and j.id <> new.id
      and r.status in ('pending','confirmed','checked_in');
    if reserved_quantity + new.quantity > configured_capacity then
      raise exception 'ICAMP_SERVICE_CAPACITY_EXCEEDED';
    end if;
  end if;
  return new;
end;
$$;

create trigger service_fulfillment_jobs_guard
before insert or update on public.service_fulfillment_jobs
for each row execute function icamp_private.guard_service_fulfillment_job();

create function icamp_private.guard_service_daily_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  peak_quantity bigint;
begin
  if new.daily_capacity is not null and
     new.daily_capacity is distinct from old.daily_capacity then
    select coalesce(max(daily_quantity), 0) into peak_quantity from (
      select sum(j.quantity) as daily_quantity
      from public.service_fulfillment_jobs j
      join public.reservations r on r.id = j.reservation_id
      where j.charge_catalog_id = new.id
        and j.campground_id = new.campground_id
        and r.status in ('pending','confirmed','checked_in')
      group by j.service_date
    ) days;
    if peak_quantity > new.daily_capacity then
      raise exception 'Daily capacity cannot be lower than already reserved units';
    end if;
  end if;
  return new;
end;
$$;

create trigger booking_service_daily_capacity_guard
before update on public.booking_charge_catalog
for each row execute function icamp_private.guard_service_daily_capacity();

create trigger service_fulfillment_jobs_touch_row
before update on public.service_fulfillment_jobs
for each row execute function icamp_private.touch_row();

alter table public.service_fulfillment_jobs enable row level security;
alter table public.service_fulfillment_jobs force row level security;
revoke all on public.service_fulfillment_jobs from public;
do $build235_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.service_fulfillment_jobs from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.service_fulfillment_jobs from authenticated;
  end if;
end
$build235_roles$;

grant select, update on public.service_fulfillment_jobs to icamp_app;
create policy service_fulfillment_jobs_read
on public.service_fulfillment_jobs for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
);
create policy service_fulfillment_jobs_update
on public.service_fulfillment_jobs for update to icamp_app
using (icamp_private.has_campground_permission(campground_id, 'reservation.modify'))
with check (
  icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.service_fulfillment_jobs is
  'Build 235 campground-only staff queue. A job does not grant payment, communication, gate, or inventory-transfer authority.';
comment on column public.booking_charge_catalog.daily_capacity is
  'Optional shared units per service date across active reservations, separate from per-booking quantity. NULL is unbounded.';
