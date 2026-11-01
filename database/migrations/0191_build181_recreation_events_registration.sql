-- Build 181: campground-controlled recreation events and internal requests.
-- All times are local campground wall-clock values; no route, ticket or charge.
create table icamp_private.campground_recreation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  category text not null check (category in
    ('family','sports','nature','arts','community','other')),
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text not null check (char_length(trim(description)) between 10 and 2000),
  location_name text not null check (char_length(trim(location_name)) between 3 and 160),
  event_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  capacity_places integer check (capacity_places between 1 and 500),
  requires_registration boolean not null default false,
  accepting_requests boolean not null default false,
  accessibility_note text not null default '' check (char_length(accessibility_note) <= 500),
  age_guidance text not null default '' check (char_length(age_guidance) <= 240),
  is_published boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  reviewed_by_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  reviewed_at timestamptz,
  created_by_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint recreation_event_campground_fk foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade on delete restrict,
  constraint recreation_event_scope_id_unique unique (organization_id,campground_id,id),
  constraint recreation_event_time_check check (start_time < end_time),
  constraint recreation_event_publish_check check (
    not is_published or reviewed_at is not null
  ),
  constraint recreation_event_requests_check check (
    not accepting_requests or (
      is_published and status='scheduled' and requires_registration
      and capacity_places is not null
    )
  )
);

create index recreation_events_public_idx
  on icamp_private.campground_recreation_events
  (campground_id,event_date,start_time,id)
  where is_published;
create trigger recreation_events_touch_row before update
  on icamp_private.campground_recreation_events
  for each row execute function icamp_private.touch_row();

create table icamp_private.recreation_registration_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  event_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null references icamp_private.user_accounts(id)
    on update cascade on delete restrict,
  client_request_id uuid not null,
  party_size integer not null check (party_size between 1 and 20),
  guest_note text not null default '' check (char_length(guest_note) <= 400),
  status text not null default 'pending'
    check (status in ('pending','reviewed','declined','withdrawn')),
  reviewed_by_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint recreation_request_event_fk foreign key (organization_id,campground_id,event_id)
    references icamp_private.campground_recreation_events(organization_id,campground_id,id)
    on update cascade on delete restrict,
  constraint recreation_request_reservation_fk foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade on delete restrict,
  constraint recreation_request_scope_id_unique unique (organization_id,campground_id,id),
  constraint recreation_request_once_per_stay unique (event_id,reservation_id),
  constraint recreation_request_replay_unique unique (event_id,client_request_id),
  constraint recreation_request_review_check check (
    (status in ('pending','withdrawn') and reviewed_at is null)
    or (status in ('reviewed','declined') and reviewed_at is not null)
  )
);

create index recreation_requests_capacity_idx
  on icamp_private.recreation_registration_requests
  (event_id,status) include (party_size)
  where status in ('pending','reviewed');
create index recreation_requests_guest_idx
  on icamp_private.recreation_registration_requests(guest_user_id,created_at desc);
create index recreation_requests_reservation_fk_idx
  on icamp_private.recreation_registration_requests(organization_id,campground_id,reservation_id);

create function icamp_private.guard_recreation_request()
returns trigger language plpgsql security invoker set search_path='' as $$
declare selected_event record;
declare requested_count integer;
begin
  select * into selected_event
  from icamp_private.campground_recreation_events e
  where e.id=new.event_id and e.organization_id=new.organization_id
    and e.campground_id=new.campground_id
  for update;
  if not found or not selected_event.is_published or not selected_event.accepting_requests
     or selected_event.status<>'scheduled' or not selected_event.requires_registration
     or selected_event.capacity_places is null then
    raise exception 'Recreation request intake is not available';
  end if;
  if not exists (
    select 1 from public.campgrounds c
    where c.id=new.campground_id and c.lifecycle_state='active'
      and selected_event.event_date >= (statement_timestamp() at time zone c.timezone)::date
  ) then
    raise exception 'Event is no longer open for new requests';
  end if;
  if not exists (
    select 1 from public.reservations r
    join icamp_private.user_accounts u on u.id=r.guest_user_id
    where r.id=new.reservation_id and r.organization_id=new.organization_id
      and r.campground_id=new.campground_id
      and r.guest_user_id=new.guest_user_id
      and r.status in ('confirmed','checked_in')
      and selected_event.event_date >= r.arrival_date
      and selected_event.event_date < r.departure_date
      and u.account_type='guest' and u.account_state='active'
  ) then
    raise exception 'An eligible guest-owned reservation is required';
  end if;
  -- A repeated client request must be replay-safe after intake closes or fills.
  -- The server returns the prior row under the event lock; this trigger also
  -- avoids treating a unique-conflict retry as a new capacity allocation.
  if exists (
    select 1 from icamp_private.recreation_registration_requests
    where event_id=new.event_id and reservation_id=new.reservation_id
      and guest_user_id=new.guest_user_id
  ) then
    return new;
  end if;
  select coalesce(sum(party_size),0) into requested_count
  from icamp_private.recreation_registration_requests
  where event_id=new.event_id and status in ('pending','reviewed');
  if requested_count+new.party_size > selected_event.capacity_places then
    raise exception 'Not enough open recreation request slots';
  end if;
  if new.status <> 'pending' or new.reviewed_at is not null then
    raise exception 'New recreation requests must start pending';
  end if;
  return new;
end $$;

create trigger recreation_requests_capacity_and_ownership
  before insert on icamp_private.recreation_registration_requests
  for each row execute function icamp_private.guard_recreation_request();

create function icamp_private.guard_recreation_request_update()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if row(old.organization_id,old.campground_id,old.event_id,old.reservation_id,
         old.guest_user_id,old.client_request_id,old.party_size,old.guest_note)
     is distinct from
     row(new.organization_id,new.campground_id,new.event_id,new.reservation_id,
         new.guest_user_id,new.client_request_id,new.party_size,new.guest_note) then
    raise exception 'Recreation request identity and submitted evidence are immutable';
  end if;
  if old.status not in ('pending','reviewed') or (
    new.status <> old.status and not (
      (old.status='pending' and new.status in ('reviewed','declined','withdrawn'))
      or (old.status='reviewed' and new.status in ('declined','withdrawn'))
    )
  ) then
    raise exception 'Recreation request transition is not allowed';
  end if;
  return new;
end $$;

create trigger recreation_request_transition_guard before update
  on icamp_private.recreation_registration_requests
  for each row execute function icamp_private.guard_recreation_request_update();
create trigger recreation_requests_touch_row before update
  on icamp_private.recreation_registration_requests
  for each row execute function icamp_private.touch_row();

revoke all on function icamp_private.guard_recreation_request() from public;
revoke all on function icamp_private.guard_recreation_request_update() from public;
alter table icamp_private.campground_recreation_events enable row level security;
alter table icamp_private.campground_recreation_events force row level security;
alter table icamp_private.recreation_registration_requests enable row level security;
alter table icamp_private.recreation_registration_requests force row level security;
create policy recreation_events_no_direct_access
  on icamp_private.campground_recreation_events
  for all to icamp_app using(false) with check(false);
create policy recreation_requests_no_direct_access
  on icamp_private.recreation_registration_requests
  for all to icamp_app using(false) with check(false);
revoke all on icamp_private.campground_recreation_events,
  icamp_private.recreation_registration_requests from public;
do $build181_client_grants$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on icamp_private.campground_recreation_events,icamp_private.recreation_registration_requests from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on icamp_private.campground_recreation_events,icamp_private.recreation_registration_requests from authenticated';
  end if;
end $build181_client_grants$;

comment on table icamp_private.recreation_registration_requests is
  'Private campground-scoped registration requests. Pending/reviewed counts are provisional request capacity, never paid or confirmed admission.';
