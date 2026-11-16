-- iCamp Build 258: tenant-scoped staff review of unavailable-site interest.
-- Does not add a reservation, hold, guest contact, automatic offer or delivery.
create table public.icamp_waitlist_interest258 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  arrival_date date not null,
  departure_date date not null,
  request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{12,100}$'),
  source_channel text not null default 'staff' check (source_channel = 'staff'),
  state text not null default 'review_only' check (state='review_only'),
  created_by_user_id uuid not null references icamp_private.user_accounts(id),
  created_at timestamptz not null default statement_timestamp(),
  constraint waitlist258_window check (departure_date > arrival_date),
  constraint waitlist258_max_stay check (departure_date-arrival_date <= 90),
  constraint waitlist258_accommodation_fk
    foreign key(organization_id,campground_id,accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on delete restrict,
  constraint waitlist258_campground_id_unique unique(campground_id,id),
  constraint waitlist258_request_key_unique unique(campground_id,request_key)
);
create index waitlist258_fifo_idx on public.icamp_waitlist_interest258
  (campground_id,arrival_date,created_at,id);

create table public.icamp_waitlist_review258 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  waitlist_id uuid not null,
  action text not null check (action in ('reviewed','cancelled')),
  performed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  result text not null default 'local_review_only'
    check(result='local_review_only'),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  foreign key (campground_id,waitlist_id)
    references public.icamp_waitlist_interest258(campground_id,id)
    on delete restrict,
  unique (waitlist_id,action)
);
create index waitlist258_review_recent on public.icamp_waitlist_review258
  (campground_id,waitlist_id,reviewed_at desc,id desc);

create function icamp_private.guard_waitlist_interest258()
returns trigger language plpgsql security definer set search_path='' as $$
declare availability record;
begin
  if new.created_by_user_id is distinct from
      nullif(current_setting('icamp.user_id',true),'')::uuid
    or not icamp_private.has_campground_permission(
      new.campground_id,'reservation.create')
  then raise exception 'Scoped reservation-create permission required'; end if;
  -- Same canonical lock as Build 035/036's hold/reservation writers;
  -- ensure a pending waitlist note cannot race into an authoritative offer.
  perform pg_advisory_xact_lock(
    hashtextextended('icamp-live-availability:' || new.accommodation_id::text,0));
  select a.* into availability
  from icamp_private.live_accommodation_availability(
    new.campground_id,new.arrival_date,new.departure_date) a
  where a.accommodation_id=new.accommodation_id limit 1;
  if not found then raise exception 'Canonical accommodation unavailable'; end if;
  if not (availability.reservation_blocked or availability.hold_blocked
     or availability.restriction_blocked or availability.turnover_blocked
     or availability.seasonal_blocked)
  then raise exception 'Only unavailable sites may enter waitlist review'; end if;
  new.state:='review_only';
  new.source_channel:='staff';
  new.created_at:=statement_timestamp();
  return new;
end;
$$;
create trigger icamp_waitlist258_intake_guard
before insert on public.icamp_waitlist_interest258
for each row execute function icamp_private.guard_waitlist_interest258();

create function icamp_private.guard_waitlist_review258()
returns trigger language plpgsql security definer set search_path='' as $$
declare original record;
begin
  if new.performed_by_user_id is distinct from
      nullif(current_setting('icamp.user_id',true),'')::uuid
    or not icamp_private.has_campground_permission(
      new.campground_id,'reservation.modify')
  then raise exception 'Current reservation-modify permission required'; end if;
  select organization_id,campground_id into original
    from public.icamp_waitlist_interest258
    where id=new.waitlist_id;
  if original.organization_id is distinct from new.organization_id
    or original.campground_id is distinct from new.campground_id
  then raise exception 'Cross-campground waitlist action denied'; end if;
  if exists (
    select 1 from public.icamp_waitlist_review258 r
    where r.waitlist_id=new.waitlist_id and r.action='cancelled'
  ) then raise exception 'Cancelled waitlist is immutable'; end if;
  new.reviewed_at:=statement_timestamp();
  new.result:='local_review_only';
  return new;
end;
$$;
create trigger icamp_waitlist258_review_guard
before insert on public.icamp_waitlist_review258
for each row execute function icamp_private.guard_waitlist_review258();

alter table public.icamp_waitlist_interest258 enable row level security;
alter table public.icamp_waitlist_interest258 force row level security;
alter table public.icamp_waitlist_review258 enable row level security;
alter table public.icamp_waitlist_review258 force row level security;
revoke all on public.icamp_waitlist_interest258 from public;
revoke all on public.icamp_waitlist_review258 from public;
do $direct_roles$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.icamp_waitlist_interest258 from anon;
    revoke all on public.icamp_waitlist_review258 from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.icamp_waitlist_interest258 from authenticated;
    revoke all on public.icamp_waitlist_review258 from authenticated;
  end if;
end $direct_roles$;
grant select,insert on public.icamp_waitlist_interest258 to icamp_app;
grant select,insert on public.icamp_waitlist_review258 to icamp_app;

create policy waitlist258_read on public.icamp_waitlist_interest258
for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.create')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);
create policy waitlist258_insert on public.icamp_waitlist_interest258
for insert to icamp_app with check (
  created_by_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and icamp_private.has_campground_permission(campground_id,'reservation.create')
);
create policy waitlist258_review_read on public.icamp_waitlist_review258
for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'reservation.modify')
);
create policy waitlist258_review_insert on public.icamp_waitlist_review258
for insert to icamp_app with check (
  performed_by_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and icamp_private.has_campground_permission(campground_id,'reservation.modify')
);
comment on table public.icamp_waitlist_interest258 is
 'Staff-reviewed interest in a currently unavailable accommodation. No guest PII, booking, hold, offer, capacity mutation, or automatic FIFO promotion.';
