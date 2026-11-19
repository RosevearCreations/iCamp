-- iCamp Build 265: separate guest safety acknowledgment, staff custody ledger,
-- independently reviewed supervised on-site evidence, and campground support.
-- No payment, insurance certification, customer ticket, animal handover,
-- physical-host reboot authority, or unverified remote service activation.
create table icamp_private.rental_safety_ack265 (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null unique
    references icamp_private.rental_allocations264(id) on delete restrict,
  organization_id uuid not null,
  campground_id uuid not null,
  guest_user_id uuid not null references icamp_private.user_accounts(id),
  version_sha256 text not null check (version_sha256 ~ '^[a-f0-9]{64}$'),
  safety_review_confirmed boolean not null check (safety_review_confirmed),
  terms_review_confirmed boolean not null check (terms_review_confirmed),
  acknowledged_at timestamptz not null default statement_timestamp()
);
create index rental_safety_ack265_scope_idx
  on icamp_private.rental_safety_ack265(campground_id,acknowledged_at desc);

create function icamp_private.guard_rental_safety265()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  current_actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
  allocation_record record;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Safety acknowledgment is append-only';
  end if;
  select a.organization_id,a.campground_id,a.guest_user_id,a.status,
         c.lifecycle_state campground_state
    into allocation_record
    from icamp_private.rental_allocations264 a
    join public.campgrounds c on c.id=a.campground_id
   where a.id=new.allocation_id
     for share of a;
  if not found or current_actor is null or current_actor<>new.guest_user_id
    or current_actor<>allocation_record.guest_user_id
    or allocation_record.status<>'reserved_for_staff_collection'
    or allocation_record.campground_state<>'active'
    or new.organization_id<>allocation_record.organization_id
    or new.campground_id<>allocation_record.campground_id
  then raise exception 'Only original eligible guest may acknowledge own equipment safety information'; end if;
  return new;
end $$;
create trigger rental_safety265_guard
 before insert or update or delete on icamp_private.rental_safety_ack265
 for each row execute function icamp_private.guard_rental_safety265();

create table icamp_private.rental_custody_events265 (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references icamp_private.rental_allocations264(id) on delete restrict,
  organization_id uuid not null,
  campground_id uuid not null,
  event_kind text not null check (event_kind in ('staff_observed_pickup','staff_observed_return')),
  evidence_reference text not null check (char_length(trim(evidence_reference)) between 12 and 160),
  condition_note text not null check (char_length(trim(condition_note)) between 30 and 650),
  actor_user_id uuid not null references icamp_private.user_accounts(id),
  recorded_at timestamptz not null default statement_timestamp(),
  unique (allocation_id,event_kind)
);
create index rental_custody265_scope_idx
  on icamp_private.rental_custody_events265(campground_id,recorded_at desc);

create function icamp_private.guard_rental_custody265()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  current_actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
  record_alloc record;
  previous_kind text;
begin
  if tg_op<>'INSERT' then raise exception 'Custody evidence is immutable'; end if;
  if current_actor is null or current_actor<>new.actor_user_id or
    not icamp_private.has_campground_permission(new.campground_id,'rental.manage')
  then raise exception 'Authorized campground rental staff required'; end if;
  select a.organization_id,a.campground_id,a.status,a.start_date,a.end_date,
         source.asset_class,source.lifecycle_state,source.operating_state,
         (statement_timestamp() at time zone c.timezone)::date local_day
   into record_alloc
    from icamp_private.rental_allocations264 a
    join icamp_private.rental_planning_offers o on o.id=a.offer_id
    join public.operational_assets source on source.id=o.asset_id
    join public.campgrounds c on c.id=a.campground_id
   where a.id=new.allocation_id for update of a;
  if not found or new.organization_id<>record_alloc.organization_id
    or new.campground_id<>record_alloc.campground_id
    or record_alloc.asset_class<>'equipment' then
    raise exception 'Original campground equipment allocation required'; end if;
  select e.event_kind into previous_kind
    from icamp_private.rental_custody_events265 e
   where e.allocation_id=new.allocation_id
   order by e.recorded_at desc,e.id desc limit 1;
  if new.event_kind='staff_observed_pickup' then
    if record_alloc.status<>'reserved_for_staff_collection'
      or record_alloc.lifecycle_state<>'active'
      or record_alloc.operating_state<>'operational'
      or record_alloc.local_day<record_alloc.start_date
      or record_alloc.local_day>record_alloc.end_date
      or previous_kind is not null
      or not exists(select 1 from icamp_private.rental_safety_ack265 s
        where s.allocation_id=new.allocation_id)
    then raise exception 'Pickup requires current source item, guest safety acknowledgment and eligible dates'; end if;
  else
    if previous_kind is distinct from 'staff_observed_pickup' then
      raise exception 'Return must follow an original pickup observation'; end if;
  end if;
  return new;
end $$;
create trigger rental_custody265_guard
 before insert or update or delete on icamp_private.rental_custody_events265
 for each row execute function icamp_private.guard_rental_custody265();

-- Administrative cancellation cannot silently erase an observed checkout.
create function icamp_private.guard_rental_cancellation265()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='cancelled' and old.status='reserved_for_staff_collection'
    and exists (
      select 1 from icamp_private.rental_custody_events265 p
       where p.allocation_id=old.id and p.event_kind='staff_observed_pickup'
    )
    and not exists (
      select 1 from icamp_private.rental_custody_events265 r
       where r.allocation_id=old.id and r.event_kind='staff_observed_return'
    )
  then raise exception 'Staff-observed pickup has not been returned; reconcile custody first'; end if;
  return new;
end $$;
create trigger rental_cancellation265_guard
 before update on icamp_private.rental_allocations264
 for each row execute function icamp_private.guard_rental_cancellation265();

-- A witness packet is an independently signed-off staff OBSERVATION only.
-- It is not a legal provider, animal welfare, insurance or live customer pilot certificate.
create table icamp_private.rental_supervision_witness265 (
  id uuid primary key default gen_random_uuid(),
  pilot_review_id uuid not null unique
    references icamp_private.rental_pilot_reviews264(id) on delete restrict,
  organization_id uuid not null,
  campground_id uuid not null,
  site_reference text not null check (char_length(trim(site_reference)) between 8 and 140),
  supervision_reference text not null check (char_length(trim(supervision_reference)) between 12 and 140),
  safety_restrictions text not null check (char_length(trim(safety_restrictions)) between 30 and 650),
  witnessed_by_user_id uuid not null references icamp_private.user_accounts(id),
  witnessed_at timestamptz not null default statement_timestamp()
);
create index rental_supervision265_scope on
  icamp_private.rental_supervision_witness265(campground_id,witnessed_at desc);
create function icamp_private.guard_rental_supervision265()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
        source record;
begin
 if tg_op<>'INSERT' then raise exception 'Original independent witness is append-only'; end if;
 if actor is null or actor<>new.witnessed_by_user_id
  or not icamp_private.has_campground_permission(new.campground_id,'rental.manage')
  or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
 then raise exception 'Qualified independent staff review authority required'; end if;
 select p.organization_id,p.campground_id,p.reviewer_user_id,
   p.outcome,s.planned_by_user_id,s.status
 into source from icamp_private.rental_pilot_reviews264 p
 join icamp_private.rental_sessions263 s on s.id=p.session_id
 where p.id=new.pilot_review_id for share of p;
 if not found or source.organization_id<>new.organization_id
   or source.campground_id<>new.campground_id
   or source.reviewer_user_id=actor
   or source.planned_by_user_id=actor
   or source.outcome<>'accepted_for_internal_pilot'
   or source.status<>'planned'
 then raise exception 'Separately reviewed original active internal pilot required'; end if;
 return new;
end $$;
create trigger rental_supervision265_guard
 before insert or update or delete on icamp_private.rental_supervision_witness265
 for each row execute function icamp_private.guard_rental_supervision265();

-- Independently scoped campground operator-to-platform support case.
-- Text is only visible to assigned campground operators and MFA Sysop staff,
-- never to other campgrounds, public status or cross-app aggregate telemetry.
create table icamp_private.campground_support265 (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 category text not null check(category in
   ('software_locked','performance','traffic','guest_complaint','rental_change',
    'event_change','site_change','feature_request','billing_question','other')),
 severity text not null check(severity in ('routine','priority','critical')),
 title text not null check(char_length(trim(title)) between 8 and 140),
 description text not null check(char_length(trim(description)) between 20 and 1400),
 status text not null default 'open'
   check(status in ('open','triaged','resolved')),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_by_user_id uuid references icamp_private.user_accounts(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 version integer not null default 1 check(version>=1),
 foreign key(organization_id,campground_id)
   references public.campgrounds(organization_id,id) on delete restrict
);
create index campground_support265_scope on
 icamp_private.campground_support265(campground_id,created_at desc);
create index campground_support265_status on
 icamp_private.campground_support265(status,created_at desc);

create function icamp_private.guard_campground_support265()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op='INSERT' then
  if actor is null or actor<>new.actor_user_id
    or not icamp_private.has_campground_permission(new.campground_id,'campground.operations.manage')
  then raise exception 'Campground manager required for support submission'; end if;
  new.status:='open';new.version:=1;new.reviewed_by_user_id:=null;new.reviewed_at:=null;
  return new;
 elsif tg_op='UPDATE' then
  if actor is null or not icamp_private.has_campground_permission(new.campground_id,'campground.operations.manage')
    or row(new.id,new.organization_id,new.campground_id,new.category,new.severity,
         new.title,new.description,new.actor_user_id,new.created_at)
      is distinct from
       row(old.id,old.organization_id,old.campground_id,old.category,old.severity,
         old.title,old.description,old.actor_user_id,old.created_at)
    or old.status='resolved'
    or new.status not in ('triaged','resolved')
    or (new.status='triaged' and old.status<>'open')
    or (new.status='resolved' and old.status not in ('open','triaged'))
    or new.version<>old.version
  then raise exception 'Only authorized status transition on original support case'; end if;
  new.version:=old.version+1;
  new.reviewed_by_user_id:=actor;
  new.reviewed_at:=statement_timestamp();
  return new;
 end if;
 raise exception 'Support case deletion is disabled';
end $$;
create trigger campground_support265_guard
 before insert or update or delete on icamp_private.campground_support265
 for each row execute function icamp_private.guard_campground_support265();

-- Direct app client roles cannot access any of these case/custody records.
do $tables$
declare tab text;
begin
 foreach tab in array array[
 'rental_safety_ack265','rental_custody_events265',
 'rental_supervision_witness265','campground_support265']
 loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',tab||'_deny_direct',tab);
 end loop;
end $tables$;
do $revoke$
begin
 if exists(select 1 from pg_roles where rolname='anon') then
  revoke all on icamp_private.rental_safety_ack265,
    icamp_private.rental_custody_events265,icamp_private.rental_supervision_witness265,
    icamp_private.campground_support265 from anon;
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then
  revoke all on icamp_private.rental_safety_ack265,
    icamp_private.rental_custody_events265,icamp_private.rental_supervision_witness265,
    icamp_private.campground_support265 from authenticated;
 end if;
end $revoke$;
