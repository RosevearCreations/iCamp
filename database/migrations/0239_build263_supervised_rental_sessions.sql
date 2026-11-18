-- Build 263: source-backed, staff-only proposed supervised activity sessions.
-- This does NOT allocate assets, accept guest bookings or create payments.
create table icamp_private.rental_sessions263 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  offer_id uuid not null,
  planned_day date not null,
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute between 1 and 1440),
  participant_limit smallint not null check (participant_limit between 1 and 30),
  activity_kind text not null check (activity_kind in
    ('guided_horse','paddling_instruction','kite_clinic','guided_nature','other_guided')),
  safety_brief text not null check (char_length(trim(safety_brief)) between 15 and 500),
  status text not null default 'planned' check (status in ('planned','cancelled')),
  planned_by_user_id uuid not null references icamp_private.user_accounts(id),
  cancelled_by_user_id uuid references icamp_private.user_accounts(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint rental_sessions263_valid_time check (end_minute > start_minute),
  constraint rental_sessions263_cancel_state check (
    (status='planned' and cancelled_by_user_id is null and cancelled_at is null)
    or (status='cancelled' and cancelled_by_user_id is not null and cancelled_at is not null)
  ),
  constraint rental_sessions263_offer_scope_fk
    foreign key (organization_id,campground_id,offer_id)
    references icamp_private.rental_planning_offers
      (organization_id,campground_id,id) on delete restrict
);
create index rental_sessions263_offer_window_idx
  on icamp_private.rental_sessions263 (offer_id,planned_day,start_minute,end_minute)
  where status='planned';
create index rental_sessions263_campground_day_idx
  on icamp_private.rental_sessions263 (campground_id,planned_day,id);

create function icamp_private.guard_rental_session263()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  original_offer record;
  request_actor uuid;
begin
  request_actor := nullif(current_setting('icamp.user_id',true),'')::uuid;
  if request_actor is null or
    not icamp_private.has_campground_permission(
      coalesce(new.campground_id,old.campground_id),'rental.manage')
  then
    raise exception 'Current campground rental manager required';
  end if;
  if tg_op='UPDATE' then
    if old.status<>'planned' or new.status<>'cancelled'
      or row(new.id,new.organization_id,new.campground_id,new.offer_id,
             new.planned_day,new.start_minute,new.end_minute,
             new.participant_limit,new.activity_kind,new.safety_brief,
             new.planned_by_user_id,new.created_at)
         is distinct from
         row(old.id,old.organization_id,old.campground_id,old.offer_id,
             old.planned_day,old.start_minute,old.end_minute,
             old.participant_limit,old.activity_kind,old.safety_brief,
             old.planned_by_user_id,old.created_at)
    then
      raise exception 'Only immutable session cancellation is permitted';
    end if;
    new.cancelled_by_user_id := request_actor;
    new.cancelled_at := statement_timestamp();
    return new;
  end if;
  if new.planned_by_user_id is distinct from request_actor
    or new.status<>'planned' or new.cancelled_at is not null
    or new.cancelled_by_user_id is not null then
    raise exception 'A new proposed session requires an authenticated manager';
  end if;
  select o.id,c.timezone,a.lifecycle_state,a.operating_state,
         c.lifecycle_state campground_state
  into original_offer
  from icamp_private.rental_planning_offers o
  join public.operational_assets a on a.id=o.asset_id
    and a.organization_id=o.organization_id and a.campground_id=o.campground_id
  join public.campgrounds c on c.id=o.campground_id
  where o.id=new.offer_id and o.organization_id=new.organization_id
    and o.campground_id=new.campground_id
  for update of o;
  if not found or original_offer.lifecycle_state<>'active'
    or original_offer.operating_state<>'operational'
    or original_offer.campground_state<>'active'
  then
    raise exception 'Proposed activity needs an actual operational campground source';
  end if;
  if new.planned_day < (statement_timestamp() at time zone original_offer.timezone)::date
    or new.planned_day > (statement_timestamp() at time zone original_offer.timezone)::date + 180
  then
    raise exception 'Proposed session must be in the next 180 campground-local days';
  end if;
  if exists (
    select 1 from icamp_private.rental_sessions263 s
    where s.offer_id=new.offer_id and s.planned_day=new.planned_day
      and s.status='planned'
      and s.start_minute<new.end_minute and s.end_minute>new.start_minute
  ) then
    raise exception 'A source asset already has an overlapping planned session';
  end if;
  return new;
end $$;
create trigger rental_session263_guard
  before insert or update on icamp_private.rental_sessions263
  for each row execute function icamp_private.guard_rental_session263();
revoke all on function icamp_private.guard_rental_session263() from public;
alter table icamp_private.rental_sessions263 enable row level security;
alter table icamp_private.rental_sessions263 force row level security;
create policy rental_sessions263_no_direct_client
  on icamp_private.rental_sessions263 for all to icamp_app
  using (false) with check (false);
revoke all on icamp_private.rental_sessions263 from public;
do $revoke$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on icamp_private.rental_sessions263 from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on icamp_private.rental_sessions263 from authenticated;
  end if;
end $revoke$;
comment on table icamp_private.rental_sessions263 is
  'Owner-managed proposed supervised activity times, bound to real equipment/facility; never guest booking, allocation, animal handover or payment.';
