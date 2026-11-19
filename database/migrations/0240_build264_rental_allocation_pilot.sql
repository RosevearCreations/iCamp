-- Build 264: one real source-asset allocation per reviewed, guest-owned stay.
-- Staff-authorized administrative reservation only: no collection, rental
-- issuance, payment, tax posting, animal handover or outbound message.
create table icamp_private.rental_allocations264 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  offer_id uuid not null,
  request_id uuid not null unique
    references icamp_private.rental_planning_requests(id) on delete restrict,
  reservation_id uuid not null,
  guest_user_id uuid not null references icamp_private.user_accounts(id),
  start_date date not null,
  end_date date not null,
  status text not null default 'reserved_for_staff_collection'
    check (status in ('reserved_for_staff_collection','cancelled')),
  staff_safety_review text not null
    check (char_length(trim(staff_safety_review)) between 20 and 500),
  approved_by_user_id uuid not null references icamp_private.user_accounts(id),
  approved_at timestamptz not null default statement_timestamp(),
  cancelled_by_user_id uuid references icamp_private.user_accounts(id),
  cancelled_at timestamptz,
  constraint rental_allocations264_valid_days check
    (end_date>=start_date and end_date<start_date+14),
  constraint rental_allocations264_cancel_state check (
    (status='reserved_for_staff_collection' and cancelled_by_user_id is null and cancelled_at is null)
    or (status='cancelled' and cancelled_by_user_id is not null and cancelled_at is not null)
  ),
  constraint rental_allocations264_offer_scope_fk
    foreign key (organization_id,campground_id,offer_id)
    references icamp_private.rental_planning_offers
      (organization_id,campground_id,id) on delete restrict
);
create index rental_allocations264_overlap_idx on icamp_private.rental_allocations264
  (offer_id,start_date,end_date) where status='reserved_for_staff_collection';
-- Original creation timestamp, immutable after insertion.
alter table icamp_private.rental_allocations264
  add column created_at timestamptz not null default statement_timestamp();
create index rental_allocations264_guest_idx on icamp_private.rental_allocations264
  (guest_user_id,created_at) where status='reserved_for_staff_collection';

create function icamp_private.guard_rental_allocation264()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  actor uuid;
  source_record record;
begin
  actor := nullif(current_setting('icamp.user_id',true),'')::uuid;
  if actor is null or not icamp_private.has_campground_permission(
    coalesce(new.campground_id,old.campground_id),'rental.manage')
  then raise exception 'Active campground rental manager required'; end if;
  if tg_op='UPDATE' then
    if old.status<>'reserved_for_staff_collection' or new.status<>'cancelled'
      or row(new.id,new.organization_id,new.campground_id,new.offer_id,
             new.request_id,new.reservation_id,new.guest_user_id,
             new.start_date,new.end_date,new.staff_safety_review,
             new.approved_by_user_id,new.approved_at,new.created_at)
        is distinct from
         row(old.id,old.organization_id,old.campground_id,old.offer_id,
             old.request_id,old.reservation_id,old.guest_user_id,
             old.start_date,old.end_date,old.staff_safety_review,
             old.approved_by_user_id,old.approved_at,old.created_at)
    then raise exception 'Only cancellation, never silent allocation mutation'; end if;
    new.cancelled_by_user_id := actor;
    new.cancelled_at := statement_timestamp();
    return new;
  end if;
  if new.approved_by_user_id is distinct from actor or
     new.status<>'reserved_for_staff_collection'
     or new.cancelled_by_user_id is not null or new.cancelled_at is not null
  then raise exception 'Staff allocation requires original authenticated approval'; end if;
  select r.organization_id,r.campground_id,r.offer_id,r.reservation_id,
         r.guest_user_id,r.start_date,r.end_date,r.status request_state,
         a.lifecycle_state asset_state,a.operating_state,a.asset_class,
         eq.equipment_type,c.lifecycle_state campground_state,
         o.is_published,o.accepting_requests,
         (statement_timestamp() at time zone c.timezone)::date local_date
  into source_record
  from icamp_private.rental_planning_requests r
  join icamp_private.rental_planning_offers o on o.id=r.offer_id
  join public.operational_assets a on a.id=o.asset_id
  left join public.operational_equipment eq on eq.asset_id=a.id
  join public.campgrounds c on c.id=r.campground_id
  where r.id=new.request_id
  for update of o;
  if not found or source_record.request_state<>'reviewed'
    or source_record.asset_state<>'active'
    or source_record.operating_state<>'operational'
    or source_record.asset_class<>'equipment'
    or source_record.equipment_type not in ('watercraft','cart','other')
    or source_record.campground_state<>'active'
    or not source_record.is_published or not source_record.accepting_requests
    or source_record.start_date < source_record.local_date
    or row(new.organization_id,new.campground_id,new.offer_id,new.reservation_id,
         new.guest_user_id,new.start_date,new.end_date)
       is distinct from
       row(source_record.organization_id,source_record.campground_id,
           source_record.offer_id,source_record.reservation_id,
           source_record.guest_user_id,source_record.start_date,source_record.end_date)
  then raise exception 'Only current, reviewed, eligible real guest rental source can be reserved'; end if;
  if not exists (
    select 1 from public.reservations stay
    where stay.id=new.reservation_id and stay.organization_id=new.organization_id
      and stay.campground_id=new.campground_id
      and stay.guest_user_id=new.guest_user_id
      and stay.status in ('confirmed','checked_in')
      and stay.arrival_date<=new.start_date and stay.departure_date>=new.end_date
  ) then raise exception 'Original guest stay is no longer eligible'; end if;
  if exists(
    select 1 from icamp_private.rental_allocations264 booked
    where booked.offer_id=new.offer_id and booked.status='reserved_for_staff_collection'
      and booked.start_date<=new.end_date and booked.end_date>=new.start_date
  ) then raise exception 'Source rental asset already reserved for overlapping dates'; end if;
  if exists(
    select 1 from icamp_private.rental_sessions263 s
    where s.offer_id=new.offer_id and s.status='planned'
      and s.planned_day between new.start_date and new.end_date
  ) then raise exception 'Source asset is in a proposed supervised activity; review calendar first'; end if;
  return new;
end $$;
create trigger rental_allocation264_guard
  before insert or update on icamp_private.rental_allocations264
  for each row execute function icamp_private.guard_rental_allocation264();

-- Independent supervised-session pilot review. Internal accept is an
-- authorized readiness review only, NEVER a guest-facing event sale.
create table icamp_private.rental_pilot_reviews264 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  session_id uuid not null unique
    references icamp_private.rental_sessions263(id) on delete restrict,
  outcome text not null check (outcome in ('hold','accepted_for_internal_pilot')),
  original_evidence_reference text not null
    check (char_length(trim(original_evidence_reference)) between 12 and 150),
  supervision_welfare_check text not null
    check (char_length(trim(supervision_welfare_check)) between 30 and 650),
  reviewer_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp()
);
create index rental_pilot264_campground_idx
  on icamp_private.rental_pilot_reviews264(campground_id,reviewed_at desc);

create function icamp_private.guard_rental_pilot264()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid;
        proposal record;
begin
  if tg_op<>'INSERT' then raise exception 'Pilot acceptance evidence is immutable'; end if;
  actor := nullif(current_setting('icamp.user_id',true),'')::uuid;
  if actor is null
    or not icamp_private.has_campground_permission(new.campground_id,'rental.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or actor is distinct from new.reviewer_user_id
  then raise exception 'Independent staff and rental review permission required'; end if;
  select s.organization_id,s.campground_id,s.planned_by_user_id,s.status,
         a.lifecycle_state asset_state,a.operating_state
    into proposal
    from icamp_private.rental_sessions263 s
    join icamp_private.rental_planning_offers o on o.id=s.offer_id
    join public.operational_assets a on a.id=o.asset_id
    where s.id=new.session_id
    for share of s;
  if not found or proposal.organization_id<>new.organization_id
    or proposal.campground_id<>new.campground_id
    or proposal.planned_by_user_id=actor
    or proposal.status<>'planned'
    or proposal.asset_state<>'active'
    or proposal.operating_state<>'operational'
  then raise exception 'Independent original supervised session and live asset required'; end if;
  return new;
end $$;
create trigger rental_pilot264_guard
  before insert or update or delete on icamp_private.rental_pilot_reviews264
  for each row execute function icamp_private.guard_rental_pilot264();

-- Protect the original reviewed request and 263 session calendar after
-- physical-source allocation: no unrelated state transitions may orphan it.
create function icamp_private.guard_allocated_request264()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.status='reviewed' and new.status in ('withdrawn','declined') and exists(
    select 1 from icamp_private.rental_allocations264 a
    where a.request_id=old.id and a.status='reserved_for_staff_collection'
  ) then raise exception 'Cancel the staff-approved allocation before altering the guest request'; end if;
  return new;
end $$;
create trigger rental_request_allocation264_guard before update
  on icamp_private.rental_planning_requests for each row
  execute function icamp_private.guard_allocated_request264();

create function icamp_private.guard_session_reserved264()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if exists (
    select 1 from icamp_private.rental_allocations264 a
    where a.offer_id=new.offer_id and a.status='reserved_for_staff_collection'
      and new.planned_day between a.start_date and a.end_date
  ) then raise exception 'Source asset has a current guest reservation for the proposed activity day'; end if;
  return new;
end $$;
create trigger rental_session264_reservation_guard before insert
  on icamp_private.rental_sessions263 for each row
  execute function icamp_private.guard_session_reserved264();

revoke all on function icamp_private.guard_allocated_request264() from public;
revoke all on function icamp_private.guard_session_reserved264() from public;
revoke all on function icamp_private.guard_rental_allocation264() from public;
revoke all on function icamp_private.guard_rental_pilot264() from public;
alter table icamp_private.rental_allocations264 enable row level security;
alter table icamp_private.rental_allocations264 force row level security;
alter table icamp_private.rental_pilot_reviews264 enable row level security;
alter table icamp_private.rental_pilot_reviews264 force row level security;
create policy rental_allocations264_no_direct_client
  on icamp_private.rental_allocations264 for all to icamp_app
  using(false) with check(false);
create policy rental_pilot264_no_direct_client
  on icamp_private.rental_pilot_reviews264 for all to icamp_app
  using(false) with check(false);
revoke all on icamp_private.rental_allocations264,
  icamp_private.rental_pilot_reviews264 from public;
do $revoke$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    revoke all on icamp_private.rental_allocations264,
      icamp_private.rental_pilot_reviews264 from anon;
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    revoke all on icamp_private.rental_allocations264,
      icamp_private.rental_pilot_reviews264 from authenticated;
  end if;
end $revoke$;
comment on table icamp_private.rental_allocations264 is
 'Staff-reserved source asset dates for one guest-owned stay, not an issued rental, paid charge or animal checkout.';
comment on table icamp_private.rental_pilot_reviews264 is
 'Independent, immutable supervised-session internal pilot evidence; no live event access, booking or payment.';
