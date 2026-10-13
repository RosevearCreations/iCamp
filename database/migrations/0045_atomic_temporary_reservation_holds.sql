-- iCamp Build 036
-- Atomic Temporary Reservation Holds.

alter table public.campgrounds
  add column temporary_hold_minutes integer not null default 15
  check (temporary_hold_minutes between 2 and 60);

create or replace function icamp_private.create_reservation_hold(
  p_campground_id uuid,
  p_accommodation_id uuid,
  p_arrival_date date,
  p_departure_date date,
  p_hold_key text
)
returns public.reservation_holds
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hold public.reservation_holds%rowtype;
  v_organization_id uuid;
  v_duration_minutes integer;
  v_actor_user_id uuid := nullif(current_setting('icamp.user_id', true), '')::uuid;
  v_normalized_key text := trim(p_hold_key);
begin
  if v_actor_user_id is null then
    raise exception 'ICAMP_HOLD_ACTOR_REQUIRED';
  end if;
  if p_departure_date <= p_arrival_date then
    raise exception 'ICAMP_HOLD_DATE_WINDOW_INVALID';
  end if;
  if char_length(v_normalized_key) < 8 or char_length(v_normalized_key) > 160 then
    raise exception 'ICAMP_HOLD_KEY_INVALID';
  end if;

  select c.organization_id, c.temporary_hold_minutes
  into v_organization_id, v_duration_minutes
  from public.campgrounds c
  where c.id = p_campground_id
    and c.lifecycle_state = 'active';

  if v_organization_id is null then
    raise exception 'ICAMP_HOLD_CAMPGROUND_UNAVAILABLE';
  end if;

  if not exists (
    select 1
    from public.accommodations a
    where a.id = p_accommodation_id
      and a.campground_id = p_campground_id
      and a.organization_id = v_organization_id
      and a.lifecycle_state = 'active'
  ) then
    raise exception 'ICAMP_HOLD_ACCOMMODATION_UNAVAILABLE';
  end if;

  -- A hold key is the idempotency boundary. Lock it before the inventory lock so
  -- concurrent retries with the same key cannot create divergent records.
  perform pg_advisory_xact_lock(
    hashtextextended('icamp-reservation-hold-key:' || p_campground_id::text || ':' || v_normalized_key, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('icamp-live-availability:' || p_accommodation_id::text, 0)
  );

  update public.reservation_holds
  set hold_state = 'expired',
      updated_by_user_id = v_actor_user_id
  where campground_id = p_campground_id
    and accommodation_id = p_accommodation_id
    and hold_state = 'active'
    and expires_at <= statement_timestamp();

  select h.*
  into v_hold
  from public.reservation_holds h
  where h.campground_id = p_campground_id
    and h.hold_key = v_normalized_key
  for update;

  if found then
    if v_hold.accommodation_id = p_accommodation_id
      and v_hold.arrival_date = p_arrival_date
      and v_hold.departure_date = p_departure_date
      and v_hold.hold_state = 'active'
      and v_hold.expires_at > statement_timestamp() then
      return v_hold;
    end if;
    raise exception 'ICAMP_HOLD_KEY_REUSED';
  end if;

  insert into public.reservation_holds (
    organization_id,
    campground_id,
    accommodation_id,
    arrival_date,
    departure_date,
    hold_state,
    expires_at,
    hold_key,
    created_by_user_id,
    updated_by_user_id
  )
  values (
    v_organization_id,
    p_campground_id,
    p_accommodation_id,
    p_arrival_date,
    p_departure_date,
    'active',
    statement_timestamp() + make_interval(mins => v_duration_minutes),
    v_normalized_key,
    v_actor_user_id,
    v_actor_user_id
  )
  returning * into v_hold;

  return v_hold;
end;
$$;

create or replace function icamp_private.release_reservation_hold(
  p_campground_id uuid,
  p_hold_id uuid,
  p_hold_key text
)
returns public.reservation_holds
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hold public.reservation_holds%rowtype;
  v_actor_user_id uuid := nullif(current_setting('icamp.user_id', true), '')::uuid;
begin
  if v_actor_user_id is null then
    raise exception 'ICAMP_HOLD_ACTOR_REQUIRED';
  end if;

  select h.*
  into v_hold
  from public.reservation_holds h
  where h.id = p_hold_id
    and h.campground_id = p_campground_id
    and h.hold_key = trim(p_hold_key)
  for update;

  if not found then
    raise exception 'ICAMP_HOLD_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('icamp-live-availability:' || v_hold.accommodation_id::text, 0)
  );

  if v_hold.hold_state = 'active' and v_hold.expires_at <= statement_timestamp() then
    update public.reservation_holds
    set hold_state = 'expired',
        updated_by_user_id = v_actor_user_id
    where id = v_hold.id
    returning * into v_hold;
    return v_hold;
  end if;

  if v_hold.hold_state = 'active' then
    update public.reservation_holds
    set hold_state = 'released',
        updated_by_user_id = v_actor_user_id
    where id = v_hold.id
    returning * into v_hold;
  end if;

  return v_hold;
end;
$$;

create or replace function icamp_private.expire_reservation_holds(
  p_campground_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_user_id uuid := nullif(current_setting('icamp.user_id', true), '')::uuid;
  v_expired_count integer;
begin
  if v_actor_user_id is null then
    raise exception 'ICAMP_HOLD_ACTOR_REQUIRED';
  end if;

  update public.reservation_holds
  set hold_state = 'expired',
      updated_by_user_id = v_actor_user_id
  where campground_id = p_campground_id
    and hold_state = 'active'
    and expires_at <= statement_timestamp();

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

grant insert, update on public.reservation_holds to icamp_app;
grant execute on function icamp_private.create_reservation_hold(uuid,uuid,date,date,text) to icamp_app;
grant execute on function icamp_private.release_reservation_hold(uuid,uuid,text) to icamp_app;
grant execute on function icamp_private.expire_reservation_holds(uuid) to icamp_app;

create policy reservation_holds_write on public.reservation_holds
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'reservation.create')
  and created_by_user_id = nullif((select current_setting('icamp.user_id', true)), '')::uuid
  and updated_by_user_id = nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy reservation_holds_update on public.reservation_holds
for update to icamp_app
using (icamp_private.has_campground_permission(campground_id,'reservation.create'))
with check (
  icamp_private.has_campground_permission(campground_id,'reservation.create')
  and updated_by_user_id = nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on column public.campgrounds.temporary_hold_minutes is
  'Build 036 configurable temporary reservation hold duration in minutes; bounded to 2-60 minutes.';
comment on table public.reservation_holds is
  'Atomic temporary booking inventory holds with campground-scoped idempotency keys, server expiry and explicit release lifecycle.';
comment on function icamp_private.create_reservation_hold(uuid,uuid,date,date,text) is
  'Build 036 atomic/idempotent temporary hold creation. Serializes idempotency key and accommodation inventory before insert.';
comment on function icamp_private.release_reservation_hold(uuid,uuid,text) is
  'Build 036 idempotent explicit temporary-hold release with expiry reconciliation.';
