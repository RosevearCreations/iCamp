-- Build 182: source-asset rental planning, never financial or fulfilled allocation.
-- One physical asset = one provisional planning slot. No invented stock totals.

insert into icamp_private.role_permissions (role_id,permission_key)
select r.id,'rental.manage' from icamp_private.roles r
where r.role_code='campground_manager' and r.role_kind='template'
on conflict (role_id,permission_key) do nothing;

create table icamp_private.rental_planning_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  asset_id uuid not null,
  description text not null check (char_length(trim(description)) between 10 and 1200),
  accessibility_note text not null default '' check (char_length(accessibility_note) <= 500),
  return_guidance text not null default '' check (char_length(return_guidance) <= 500),
  max_days smallint not null default 7 check (max_days between 1 and 14),
  is_published boolean not null default false,
  accepting_requests boolean not null default false,
  reviewed_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  reviewed_at timestamptz,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint rental_offer_asset_fk foreign key (organization_id,campground_id,asset_id)
    references public.operational_assets(organization_id,campground_id,id) on update cascade on delete restrict,
  constraint rental_offer_scope_unique unique (organization_id,campground_id,id),
  constraint rental_offer_asset_unique unique (asset_id),
  constraint rental_offer_publication_check check (not is_published or reviewed_at is not null),
  constraint rental_offer_intake_check check (not accepting_requests or is_published)
);

create index rental_offers_public_idx on icamp_private.rental_planning_offers(campground_id,id)
  where is_published;

create function icamp_private.guard_rental_offer()
returns trigger language plpgsql security invoker set search_path='' as $$
declare asset_ok boolean;
begin
  if tg_op='UPDATE' then
    if row(new.organization_id,new.campground_id,new.asset_id)
       is distinct from row(old.organization_id,old.campground_id,old.asset_id) then
      raise exception 'Rental offer source asset scope is immutable';
    end if;
  end if;
  if new.is_published or new.accepting_requests then
    select exists (
      select 1 from public.operational_assets a
      join public.campgrounds c on c.id=a.campground_id
      left join public.operational_equipment eq on eq.asset_id=a.id
      left join public.operational_facilities f on f.asset_id=a.id
      where a.id=new.asset_id and a.organization_id=new.organization_id
        and a.campground_id=new.campground_id and a.lifecycle_state='active'
        and a.operating_state='operational' and c.lifecycle_state='active'
        and ((a.asset_class='equipment' and eq.equipment_type in ('watercraft','cart','other'))
          or (a.asset_class='facility' and f.facility_type in ('sports_field','hall','other')))
    ) into asset_ok;
    if not asset_ok then
      raise exception 'Source asset is not eligible and operational for public rental planning';
    end if;
  end if;
  return new;
end $$;

create trigger rental_offer_guard before insert or update on icamp_private.rental_planning_offers
  for each row execute function icamp_private.guard_rental_offer();
create trigger rental_offer_touch before update on icamp_private.rental_planning_offers
  for each row execute function icamp_private.touch_row();

create table icamp_private.rental_planning_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  offer_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null references icamp_private.user_accounts(id) on update cascade on delete restrict,
  client_request_id uuid not null,
  start_date date not null,
  end_date date not null,
  guest_note text not null default '' check (char_length(guest_note) <= 400),
  status text not null default 'pending' check (status in ('pending','reviewed','declined','withdrawn')),
  reviewed_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint rental_request_offer_fk foreign key (organization_id,campground_id,offer_id)
    references icamp_private.rental_planning_offers(organization_id,campground_id,id) on update cascade on delete restrict,
  constraint rental_request_reservation_fk foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id) on update cascade on delete restrict,
  constraint rental_request_window_check check (end_date>=start_date and end_date < start_date+14),
  constraint rental_request_replay_unique unique (offer_id,client_request_id),
  constraint rental_request_review_check check (
    (status in ('pending','withdrawn') and reviewed_at is null)
    or (status in ('reviewed','declined') and reviewed_at is not null)
  )
);

create unique index rental_request_one_active_per_stay_idx
  on icamp_private.rental_planning_requests(offer_id,reservation_id)
  where status in ('pending','reviewed');
create index rental_requests_overlap_idx
  on icamp_private.rental_planning_requests(offer_id,start_date,end_date)
  where status in ('pending','reviewed');
create index rental_requests_guest_idx
  on icamp_private.rental_planning_requests(guest_user_id,created_at desc);
create index rental_requests_reservation_fk_idx
  on icamp_private.rental_planning_requests(organization_id,campground_id,reservation_id);

create function icamp_private.guard_rental_planning_request()
returns trigger language plpgsql security invoker set search_path='' as $$
declare selected_offer record;
begin
  select o.*,a.lifecycle_state,a.operating_state,a.asset_class,
    eq.equipment_type,f.facility_type,c.lifecycle_state campground_state,
    (statement_timestamp() at time zone c.timezone)::date local_date
  into selected_offer
  from icamp_private.rental_planning_offers o
  join public.operational_assets a on a.id=o.asset_id
  join public.campgrounds c on c.id=o.campground_id
  left join public.operational_equipment eq on eq.asset_id=a.id
  left join public.operational_facilities f on f.asset_id=a.id
  where o.id=new.offer_id and o.organization_id=new.organization_id
    and o.campground_id=new.campground_id
  for update of o;
  if not found or not selected_offer.is_published or not selected_offer.accepting_requests
    or selected_offer.lifecycle_state<>'active' or selected_offer.operating_state<>'operational'
    or selected_offer.campground_state<>'active'
    or not ((selected_offer.asset_class='equipment' and selected_offer.equipment_type in ('watercraft','cart','other'))
      or (selected_offer.asset_class='facility' and selected_offer.facility_type in ('sports_field','hall','other'))) then
    raise exception 'Rental planning offer is unavailable';
  end if;
  if new.start_date < selected_offer.local_date
     or new.end_date >= new.start_date+selected_offer.max_days then
    raise exception 'Rental planning dates are outside the allowed window';
  end if;
  if not exists (
    select 1 from public.reservations r
    join icamp_private.user_accounts u on u.id=r.guest_user_id
    where r.id=new.reservation_id and r.organization_id=new.organization_id
      and r.campground_id=new.campground_id and r.guest_user_id=new.guest_user_id
      and r.status in ('confirmed','checked_in')
      and r.arrival_date<=new.start_date and r.departure_date>=new.end_date
      and u.account_type='guest' and u.account_state='active'
  ) then
    raise exception 'An eligible guest-owned stay is required';
  end if;
  if exists (
    select 1 from icamp_private.rental_planning_requests rr
    where rr.offer_id=new.offer_id and rr.status in ('pending','reviewed')
      and rr.start_date<=new.end_date and rr.end_date>=new.start_date
  ) then
    raise exception 'Rental planning slot already requested for these dates';
  end if;
  if new.status<>'pending' or new.reviewed_at is not null then
    raise exception 'New rental planning requests start pending';
  end if;
  return new;
end $$;

create trigger rental_request_window_ownership_guard
  before insert on icamp_private.rental_planning_requests
  for each row execute function icamp_private.guard_rental_planning_request();

create function icamp_private.guard_rental_planning_transition()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if row(old.organization_id,old.campground_id,old.offer_id,old.reservation_id,
       old.guest_user_id,old.client_request_id,old.start_date,old.end_date,old.guest_note)
     is distinct from
     row(new.organization_id,new.campground_id,new.offer_id,new.reservation_id,
       new.guest_user_id,new.client_request_id,new.start_date,new.end_date,new.guest_note) then
    raise exception 'Rental planning request evidence is immutable';
  end if;
  if old.status not in ('pending','reviewed') or (
    new.status<>old.status and not (
      (old.status='pending' and new.status in ('reviewed','declined','withdrawn'))
      or (old.status='reviewed' and new.status in ('declined','withdrawn'))
    )
  ) then
    raise exception 'Rental planning request transition is not allowed';
  end if;
  return new;
end $$;

create trigger rental_request_transition_guard before update on icamp_private.rental_planning_requests
  for each row execute function icamp_private.guard_rental_planning_transition();
create trigger rental_request_touch before update on icamp_private.rental_planning_requests
  for each row execute function icamp_private.touch_row();

revoke all on function icamp_private.guard_rental_offer() from public;
revoke all on function icamp_private.guard_rental_planning_request() from public;
revoke all on function icamp_private.guard_rental_planning_transition() from public;
alter table icamp_private.rental_planning_offers enable row level security;
alter table icamp_private.rental_planning_offers force row level security;
alter table icamp_private.rental_planning_requests enable row level security;
alter table icamp_private.rental_planning_requests force row level security;
create policy rental_offers_no_direct_access on icamp_private.rental_planning_offers
  for all to icamp_app using(false) with check(false);
create policy rental_requests_no_direct_access on icamp_private.rental_planning_requests
  for all to icamp_app using(false) with check(false);
revoke all on icamp_private.rental_planning_offers,icamp_private.rental_planning_requests from public;
do $no_direct_client_rental_access$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on icamp_private.rental_planning_offers,icamp_private.rental_planning_requests from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on icamp_private.rental_planning_offers,icamp_private.rental_planning_requests from authenticated';
  end if;
end $no_direct_client_rental_access$;

comment on table icamp_private.rental_planning_requests is
  'Build182 reservation-linked provisional plans; no charged/held/issued rental allocation or outbound message.';
