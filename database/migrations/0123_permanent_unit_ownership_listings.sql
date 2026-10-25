-- Build 091: ownership-backed permanent-unit listings and private buyer inquiries.
-- The movable/owned unit is distinct from the campground's land or site rights.

alter table public.permanent_units
 add constraint permanent_units_ownership_scope_unique
 unique(organization_id,campground_id,accommodation_id);

create table public.permanent_unit_ownership_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 accommodation_id uuid not null,
 event_kind text not null check(event_kind in ('owner_recorded','ownership_corrected','ownership_ended')),
 owner_display_name text not null check(char_length(trim(owner_display_name)) between 3 and 160),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 notes text not null check(char_length(trim(notes)) between 12 and 1200),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,accommodation_id)
  references public.permanent_units(organization_id,campground_id,accommodation_id)
);
create index permanent_unit_ownership_scope_idx on public.permanent_unit_ownership_events
 (campground_id,accommodation_id,recorded_at desc,id desc);
create index permanent_unit_ownership_actor_fk_idx on public.permanent_unit_ownership_events(recorded_by_user_id);

create table public.permanent_unit_sale_listings (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 accommodation_id uuid not null,
 ownership_event_id uuid not null,
 listing_status text not null default 'draft' check(listing_status in ('draft','approved','withdrawn')),
 headline text not null check(char_length(trim(headline)) between 8 and 160),
 description text not null check(char_length(trim(description)) between 20 and 2500),
 asking_price_cents bigint not null check(asking_price_cents between 0 and 100000000000),
 currency_code text not null default 'CAD' check(currency_code ~ '^[A-Z]{3}$'),
 approval_note text check(approval_note is null or char_length(trim(approval_note)) between 12 and 1200),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 approved_by_user_id uuid references icamp_private.user_accounts(id),
 created_at timestamptz not null default clock_timestamp(),
 reviewed_at timestamptz,
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,accommodation_id)
  references public.permanent_units(organization_id,campground_id,accommodation_id),
 foreign key(organization_id,campground_id,ownership_event_id)
  references public.permanent_unit_ownership_events(organization_id,campground_id,id),
 check ((listing_status='draft' and reviewed_at is null and approved_by_user_id is null)
   or (listing_status<>'draft' and reviewed_at is not null and approved_by_user_id is not null))
);
create unique index permanent_unit_one_approved_listing_idx on public.permanent_unit_sale_listings(accommodation_id,ownership_event_id)
 where listing_status='approved';
create index permanent_unit_sale_listings_scope_idx on public.permanent_unit_sale_listings(campground_id,listing_status,created_at desc);
create index permanent_unit_sale_listings_ownership_fk_idx on public.permanent_unit_sale_listings(organization_id,campground_id,ownership_event_id);
create index permanent_unit_sale_listings_creator_fk_idx on public.permanent_unit_sale_listings(created_by_user_id);
create index permanent_unit_sale_listings_approver_fk_idx on public.permanent_unit_sale_listings(approved_by_user_id);

create table public.permanent_unit_buyer_inquiries (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 listing_id uuid not null,
 buyer_display_name text not null check(char_length(trim(buyer_display_name)) between 3 and 160),
 contact_reference text not null check(char_length(trim(contact_reference)) between 8 and 400),
 inquiry_note text not null check(char_length(trim(inquiry_note)) between 12 and 1200),
 inquiry_state text not null default 'new' check(inquiry_state in ('new','reviewing','closed')),
 received_by_user_id uuid not null references icamp_private.user_accounts(id),
 received_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,listing_id)
  references public.permanent_unit_sale_listings(organization_id,campground_id,id)
);
create index permanent_unit_inquiries_scope_idx on public.permanent_unit_buyer_inquiries(campground_id,listing_id,received_at desc);
create index permanent_unit_inquiries_receiver_fk_idx on public.permanent_unit_buyer_inquiries(received_by_user_id);

create or replace function icamp_private.permanent_unit_listing_validate()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare current_owner record;
begin
 if tg_op='UPDATE' then
  if old.listing_status<>'draft' or new.id<>old.id or new.organization_id<>old.organization_id
    or new.campground_id<>old.campground_id or new.accommodation_id<>old.accommodation_id
    or new.ownership_event_id<>old.ownership_event_id or new.headline<>old.headline
    or new.description<>old.description or new.asking_price_cents<>old.asking_price_cents
    or new.currency_code<>old.currency_code or new.created_by_user_id<>old.created_by_user_id
    or new.created_at<>old.created_at or new.listing_status='draft' then
   raise exception 'Only a draft listing may receive one immutable review decision';
  end if;
  if new.approved_by_user_id is distinct from nullif((select current_setting('icamp.user_id',true)),'')::uuid then
   raise exception 'Listing reviewer must match authenticated actor';
  end if;
 end if;
 select e.id,e.event_kind into current_owner
 from public.permanent_unit_ownership_events e
 where e.campground_id=new.campground_id and e.accommodation_id=new.accommodation_id
 order by e.recorded_at desc,e.id desc limit 1;
 if current_owner.id is null or current_owner.event_kind='ownership_ended'
    or current_owner.id<>new.ownership_event_id then
   raise exception 'Listing requires the latest active ownership evidence';
 end if;
 if new.listing_status='approved' then
   if new.approved_by_user_id=new.created_by_user_id then
     raise exception 'Listing approval must be independent';
   end if;
   if not exists(select 1 from public.accommodations a
      join public.campgrounds c on c.id=a.campground_id
      where a.id=new.accommodation_id and a.lifecycle_state='active' and c.lifecycle_state='active') then
     raise exception 'Inactive campground or accommodation cannot publish a listing';
   end if;
 end if;
 return new;
end $$;
create trigger permanent_unit_listing_validate before insert or update on public.permanent_unit_sale_listings
 for each row execute function icamp_private.permanent_unit_listing_validate();

create or replace function icamp_private.permanent_unit_inquiry_validate()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if not exists(select 1 from public.permanent_unit_sale_listings l
   where l.id=new.listing_id and l.campground_id=new.campground_id and l.listing_status='approved'
   and l.ownership_event_id=(select e.id from public.permanent_unit_ownership_events e
      where e.accommodation_id=l.accommodation_id order by e.recorded_at desc,e.id desc limit 1)) then
   raise exception 'Buyer inquiries require an approved listing';
 end if;
 return new;
end $$;
create trigger permanent_unit_inquiry_validate before insert on public.permanent_unit_buyer_inquiries
 for each row execute function icamp_private.permanent_unit_inquiry_validate();

create trigger permanent_unit_ownership_immutable before update or delete on public.permanent_unit_ownership_events
 for each row execute function icamp_private.winterization_append_only();
create trigger permanent_unit_inquiries_immutable before update or delete on public.permanent_unit_buyer_inquiries
 for each row execute function icamp_private.winterization_append_only();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_ownership_events','permanent_unit_sale_listings','permanent_unit_buyer_inquiries'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public',tab);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then
    execute format('revoke all on public.%I from %I',tab,role_name);
   end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',tab);
 end loop;
end $roles$;
grant update on public.permanent_unit_sale_listings to icamp_app;

create policy permanent_unit_ownership_events_read on public.permanent_unit_ownership_events for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage'));
create policy permanent_unit_ownership_events_insert on public.permanent_unit_ownership_events for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy permanent_unit_sale_listings_read on public.permanent_unit_sale_listings for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage'));
create policy permanent_unit_sale_listings_insert on public.permanent_unit_sale_listings for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy permanent_unit_sale_listings_update on public.permanent_unit_sale_listings for update to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage'))
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage'));
create policy permanent_unit_buyer_inquiries_read on public.permanent_unit_buyer_inquiries for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage'));
create policy permanent_unit_buyer_inquiries_insert on public.permanent_unit_buyer_inquiries for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  and received_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);

revoke all on function icamp_private.permanent_unit_listing_validate() from public;
revoke all on function icamp_private.permanent_unit_inquiry_validate() from public;
