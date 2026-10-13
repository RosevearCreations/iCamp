-- iCamp Build 035
-- Server-Authoritative Live Availability.

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  arrival_date date not null,
  departure_date date not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','checked_in','completed','cancelled')),
  source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','import','system')),
  external_reference text,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint reservations_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint reservations_dates_check check (departure_date > arrival_date),
  constraint reservations_scope_id_unique unique (organization_id, campground_id, id)
);

create table public.reservation_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  arrival_date date not null,
  departure_date date not null,
  hold_state text not null default 'active'
    check (hold_state in ('active','released','expired','converted')),
  expires_at timestamptz not null,
  hold_key text not null check (char_length(trim(hold_key)) between 8 and 160),
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint reservation_holds_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint reservation_holds_dates_check check (departure_date > arrival_date),
  constraint reservation_holds_scope_key_unique unique (campground_id, hold_key)
);

create table public.seasonal_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  assignment_state text not null default 'active'
    check (assignment_state in ('active','ended','cancelled')),
  reference text,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint seasonal_assignments_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint seasonal_assignments_dates_check check (ends_on >= starts_on)
);

create index reservations_live_lookup_idx on public.reservations
  (campground_id, accommodation_id, arrival_date, departure_date)
  where status in ('pending','confirmed','checked_in');
create index reservation_holds_live_lookup_idx on public.reservation_holds
  (campground_id, accommodation_id, arrival_date, departure_date, expires_at)
  where hold_state = 'active';
create index seasonal_assignments_live_lookup_idx on public.seasonal_assignments
  (campground_id, accommodation_id, starts_on, ends_on)
  where assignment_state = 'active';

create trigger reservations_touch_row before update on public.reservations
for each row execute function icamp_private.touch_row();
create trigger reservation_holds_touch_row before update on public.reservation_holds
for each row execute function icamp_private.touch_row();
create trigger seasonal_assignments_touch_row before update on public.seasonal_assignments
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.bump_live_availability_revision()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  target_id uuid := coalesce(new.accommodation_id, old.accommodation_id);
  actor_id uuid := coalesce(new.updated_by_user_id, new.created_by_user_id, old.updated_by_user_id, old.created_by_user_id);
begin
  update public.accommodations
  set availability_revision = availability_revision + 1,
      updated_by_user_id = coalesce(actor_id, updated_by_user_id)
  where id = target_id;
  return null;
end;
$$;

create trigger reservations_bump_availability_revision
after insert or update of arrival_date, departure_date, status or delete on public.reservations
for each row execute function icamp_private.bump_live_availability_revision();
create trigger reservation_holds_bump_availability_revision
after insert or update of arrival_date, departure_date, hold_state, expires_at or delete on public.reservation_holds
for each row execute function icamp_private.bump_live_availability_revision();
create trigger seasonal_assignments_bump_availability_revision
after insert or update of starts_on, ends_on, assignment_state or delete on public.seasonal_assignments
for each row execute function icamp_private.bump_live_availability_revision();

create or replace function icamp_private.prevent_live_inventory_conflict()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  starts date;
  ends_exclusive date;
  active_row boolean;
  row_id uuid := new.id;
begin
  if tg_table_name = 'reservations' then
    starts := new.arrival_date;
    ends_exclusive := new.departure_date;
    active_row := new.status in ('pending','confirmed','checked_in');
  elsif tg_table_name = 'reservation_holds' then
    starts := new.arrival_date;
    ends_exclusive := new.departure_date;
    active_row := new.hold_state = 'active' and new.expires_at > statement_timestamp();
  else
    starts := new.starts_on;
    ends_exclusive := new.ends_on + 1;
    active_row := new.assignment_state = 'active';
  end if;

  if not active_row then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended('icamp-live-availability:' || new.accommodation_id::text, 0));

  if exists (
    select 1 from public.reservations r
    where r.accommodation_id = new.accommodation_id
      and r.id <> row_id
      and r.status in ('pending','confirmed','checked_in')
      and daterange(r.arrival_date, r.departure_date, '[)') && daterange(starts, ends_exclusive, '[)')
  ) then raise exception 'Accommodation conflicts with an active reservation'; end if;

  if exists (
    select 1 from public.reservation_holds h
    where h.accommodation_id = new.accommodation_id
      and h.id <> row_id
      and h.hold_state = 'active'
      and h.expires_at > statement_timestamp()
      and daterange(h.arrival_date, h.departure_date, '[)') && daterange(starts, ends_exclusive, '[)')
  ) then raise exception 'Accommodation conflicts with an active temporary hold'; end if;

  if exists (
    select 1 from public.seasonal_assignments s
    where s.accommodation_id = new.accommodation_id
      and s.id <> row_id
      and s.assignment_state = 'active'
      and daterange(s.starts_on, s.ends_on + 1, '[)') && daterange(starts, ends_exclusive, '[)')
  ) then raise exception 'Accommodation conflicts with an active seasonal assignment'; end if;

  if exists (
    select 1
    from public.management_restrictions m
    join public.accommodations a on a.id = new.accommodation_id
    where m.campground_id = new.campground_id
      and m.cancelled_at is null
      and (m.accommodation_id = new.accommodation_id or (m.target_kind = 'section' and m.section_id = a.section_id))
      and daterange(m.starts_on, m.ends_on + 1, '[)') && daterange(starts, ends_exclusive, '[)')
  ) then raise exception 'Accommodation conflicts with an active management closure or hold'; end if;

  if exists (
    select 1 from public.cottage_turnovers t
    where t.accommodation_id = new.accommodation_id
      and t.status in ('scheduled','in_progress','inspection','blocked')
      and t.scheduled_for::date >= starts
      and t.scheduled_for::date < ends_exclusive
  ) then raise exception 'Accommodation conflicts with unresolved cottage turnover work'; end if;

  return new;
end;
$$;

create trigger reservations_no_live_conflict
before insert or update of accommodation_id, arrival_date, departure_date, status on public.reservations
for each row execute function icamp_private.prevent_live_inventory_conflict();
create trigger reservation_holds_no_live_conflict
before insert or update of accommodation_id, arrival_date, departure_date, hold_state, expires_at on public.reservation_holds
for each row execute function icamp_private.prevent_live_inventory_conflict();
create trigger seasonal_assignments_no_live_conflict
before insert or update of accommodation_id, starts_on, ends_on, assignment_state on public.seasonal_assignments
for each row execute function icamp_private.prevent_live_inventory_conflict();

create or replace function icamp_private.live_accommodation_availability(
  p_campground_id uuid,
  p_arrival_date date,
  p_departure_date date
)
returns table (
  accommodation_id uuid,
  availability_revision bigint,
  reservation_blocked boolean,
  hold_blocked boolean,
  restriction_blocked boolean,
  turnover_blocked boolean,
  seasonal_blocked boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id,
    a.availability_revision,
    exists (
      select 1 from public.reservations r
      where r.accommodation_id = a.id
        and r.status in ('pending','confirmed','checked_in')
        and daterange(r.arrival_date, r.departure_date, '[)') && daterange(p_arrival_date, p_departure_date, '[)')
    ),
    exists (
      select 1 from public.reservation_holds h
      where h.accommodation_id = a.id and h.hold_state = 'active'
        and h.expires_at > statement_timestamp()
        and daterange(h.arrival_date, h.departure_date, '[)') && daterange(p_arrival_date, p_departure_date, '[)')
    ),
    exists (
      select 1 from public.management_restrictions m
      where m.campground_id = a.campground_id and m.cancelled_at is null
        and (m.accommodation_id = a.id or (m.target_kind = 'section' and m.section_id = a.section_id))
        and daterange(m.starts_on, m.ends_on + 1, '[)') && daterange(p_arrival_date, p_departure_date, '[)')
    ),
    exists (
      select 1 from public.cottage_turnovers t
      where t.accommodation_id = a.id
        and t.status in ('scheduled','in_progress','inspection','blocked')
        and t.scheduled_for::date >= p_arrival_date
        and t.scheduled_for::date < p_departure_date
    ),
    exists (
      select 1 from public.seasonal_assignments s
      where s.accommodation_id = a.id and s.assignment_state = 'active'
        and daterange(s.starts_on, s.ends_on + 1, '[)') && daterange(p_arrival_date, p_departure_date, '[)')
    )
  from public.accommodations a
  where a.campground_id = p_campground_id
    and a.lifecycle_state = 'active';
$$;

alter table public.reservations enable row level security;
alter table public.reservations force row level security;
alter table public.reservation_holds enable row level security;
alter table public.reservation_holds force row level security;
alter table public.seasonal_assignments enable row level security;
alter table public.seasonal_assignments force row level security;

revoke all on public.reservations, public.reservation_holds, public.seasonal_assignments from public;
do $build035_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.reservations, public.reservation_holds, public.seasonal_assignments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.reservations, public.reservation_holds, public.seasonal_assignments from authenticated';
  end if;
end
$build035_direct_roles$;

grant select, insert, update on public.reservations to icamp_app;
grant select on public.reservation_holds to icamp_app;
grant select, insert, update on public.seasonal_assignments to icamp_app;
grant execute on function icamp_private.live_accommodation_availability(uuid,date,date) to icamp_app;

create policy reservations_read on public.reservations for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);
create policy reservations_write on public.reservations for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'reservation.create')
  and created_by_user_id = nullif((select current_setting('icamp.user_id', true)), '')::uuid
);
create policy reservations_update on public.reservations for update to icamp_app
using (icamp_private.has_campground_permission(campground_id,'reservation.modify'))
with check (
  icamp_private.has_campground_permission(campground_id,'reservation.modify')
  and updated_by_user_id = nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy reservation_holds_read on public.reservation_holds for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
);
create policy seasonal_assignments_read on public.seasonal_assignments for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
);
create policy seasonal_assignments_write on public.seasonal_assignments for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
  and created_by_user_id = nullif((select current_setting('icamp.user_id', true)), '')::uuid
);
create policy seasonal_assignments_update on public.seasonal_assignments for update to icamp_app
using (icamp_private.has_campground_permission(campground_id,'campground.operations.manage'))
with check (
  icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
  and updated_by_user_id = nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.reservation_holds is
  'Build 035 availability source for temporary holds. Build 036 owns atomic hold creation, countdown, expiry/release and idempotency.';
comment on function icamp_private.live_accommodation_availability(uuid,date,date) is
  'Build 035 server-authoritative availability read model combining reservations, live holds, management restrictions, unresolved cottage turnover and seasonal assignments.';
