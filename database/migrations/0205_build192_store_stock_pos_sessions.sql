-- Build 192: authoritative, campground-scoped stock ledger and register evidence.
-- No payment processor, tender settlement, purchasing, or guest cart fulfillment.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values ('inventory.audit','Independently review physical stock counts and POS closing variances','elevated')
on conflict(permission_key) do nothing;
insert into icamp_private.role_permissions(role_id,permission_key)
select id,'inventory.audit' from icamp_private.roles
where role_kind='template' and lifecycle_state='active'
  and role_code in ('finance','campground_manager','owner_admin')
on conflict do nothing;

-- Build 183 deliberately denied direct catalog access to icamp_app. Extend only
-- staff-scoped SELECT for the stock workboard; guest/cart writes stay denied.
create policy store_products_staff_stock_read on icamp_private.store_catalog_products
 for select to icamp_app using(
  icamp_private.has_campground_permission(campground_id,'inventory.read')
  or icamp_private.has_campground_permission(campground_id,'inventory.manage')
  or icamp_private.has_campground_permission(campground_id,'inventory.audit'));
grant select on icamp_private.store_catalog_products to icamp_app;

create table icamp_private.store_stock_locations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 location_code text not null check(location_code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
 display_name text not null check(char_length(trim(display_name)) between 3 and 90),
 created_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 unique(campground_id,location_code),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id) on delete restrict
);
create index store_stock_locations_actor_idx on icamp_private.store_stock_locations(created_by_user_id);

create table icamp_private.store_stock_balances (
 organization_id uuid not null,
 campground_id uuid not null,
 product_id uuid not null,
 location_id uuid not null,
 quantity_on_hand integer not null default 0 check(quantity_on_hand between 0 and 999999),
 row_version bigint not null default 0 check(row_version>=0),
 updated_at timestamptz not null default statement_timestamp(),
 primary key(product_id,location_id),
 foreign key(organization_id,campground_id,product_id) references icamp_private.store_catalog_products(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,location_id) references icamp_private.store_stock_locations(organization_id,campground_id,id) on delete restrict
);
create index store_stock_balances_location_idx on icamp_private.store_stock_balances(organization_id,campground_id,location_id);

create table icamp_private.store_stock_reorder_rules (
 product_id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 reorder_point integer not null check(reorder_point between 0 and 999999),
 target_quantity integer not null check(target_quantity between 1 and 999999 and target_quantity>reorder_point),
 row_version bigint not null default 1 check(row_version>=1),
 updated_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 updated_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id,product_id) references icamp_private.store_catalog_products(organization_id,campground_id,id) on delete restrict
);
create index store_stock_reorder_rules_scope_idx on icamp_private.store_stock_reorder_rules(organization_id,campground_id);
create index store_stock_reorder_product_fk_idx on icamp_private.store_stock_reorder_rules(organization_id,campground_id,product_id);
create index store_stock_reorder_rules_actor_idx on icamp_private.store_stock_reorder_rules(updated_by_user_id);

create table icamp_private.store_pos_sessions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 register_code text not null check(register_code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
 opened_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 opened_at timestamptz not null default statement_timestamp(),
 opening_cash_cents integer not null check(opening_cash_cents between 0 and 100000000),
 status text not null default 'open' check(status in ('open','closed')),
 closed_by_user_id uuid references icamp_private.user_accounts(id) on delete restrict,
 closed_at timestamptz,
 observed_cash_cents integer check(observed_cash_cents between 0 and 100000000),
 expected_cash_cents integer check(expected_cash_cents between 0 and 100000000),
 closing_note text,
 row_version bigint not null default 1 check(row_version>=1),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id) on delete restrict,
 check((status='open' and closed_at is null and closed_by_user_id is null and observed_cash_cents is null and expected_cash_cents is null)
    or (status='closed' and closed_at is not null and closed_by_user_id is not null and observed_cash_cents is not null and expected_cash_cents is not null and char_length(trim(closing_note)) between 12 and 500))
);
create unique index store_pos_one_open_register_idx on icamp_private.store_pos_sessions(campground_id,register_code) where status='open';
create index store_pos_sessions_actor_idx on icamp_private.store_pos_sessions(opened_by_user_id);
create index store_pos_sessions_closed_actor_idx on icamp_private.store_pos_sessions(closed_by_user_id);
create index store_pos_sessions_camp_fk_idx on icamp_private.store_pos_sessions(organization_id,campground_id);

create table icamp_private.store_stock_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 product_id uuid not null,
 location_id uuid not null,
 kind text not null check(kind in ('opening_count','receipt','transfer_out','transfer_in','damage','return','pos_sale','count_adjustment')),
 quantity_change integer not null check(quantity_change between -999999 and 999999 and quantity_change<>0),
 quantity_before integer not null check(quantity_before>=0),
 quantity_after integer not null check(quantity_after>=0),
 transfer_group_id uuid,
 pos_session_id uuid,
 expected_cash_cents integer check(expected_cash_cents between 0 and 100000000),
 source_reference text not null check(char_length(trim(source_reference)) between 8 and 180),
 reason_note text not null check(char_length(trim(reason_note)) between 12 and 800),
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,product_id) references icamp_private.store_catalog_products(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,location_id) references icamp_private.store_stock_locations(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,pos_session_id) references icamp_private.store_pos_sessions(organization_id,campground_id,id) on delete restrict,
 check((kind='pos_sale' and pos_session_id is not null and expected_cash_cents is not null)
    or (kind<>'pos_sale' and pos_session_id is null and expected_cash_cents is null)),
 check((kind in ('opening_count','receipt','return','transfer_in') and quantity_change>0)
    or (kind in ('damage','pos_sale','transfer_out') and quantity_change<0)
    or kind='count_adjustment'),
 check((kind in ('transfer_out','transfer_in'))=(transfer_group_id is not null))
);
create index store_stock_events_scope_date_idx on icamp_private.store_stock_events(organization_id,campground_id,recorded_at desc);
create index store_stock_events_product_location_idx on icamp_private.store_stock_events(product_id,location_id,recorded_at desc);
create index store_stock_events_session_idx on icamp_private.store_stock_events(pos_session_id) where pos_session_id is not null;
create index store_stock_events_actor_idx on icamp_private.store_stock_events(actor_user_id);
create index store_stock_events_transfer_idx on icamp_private.store_stock_events(transfer_group_id) where transfer_group_id is not null;
create index store_stock_events_location_fk_idx on icamp_private.store_stock_events(organization_id,campground_id,location_id);
create index store_stock_events_product_fk_idx on icamp_private.store_stock_events(organization_id,campground_id,product_id);
create index store_stock_events_session_fk_idx on icamp_private.store_stock_events(organization_id,campground_id,pos_session_id);

create table icamp_private.store_stock_counts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 product_id uuid not null,
 location_id uuid not null,
 expected_quantity integer not null check(expected_quantity>=0),
 expected_version bigint not null check(expected_version>=1),
 observed_quantity integer not null check(observed_quantity between 0 and 999999),
 source_reference text not null check(char_length(trim(source_reference)) between 8 and 180),
 reason_note text not null check(char_length(trim(reason_note)) between 12 and 800),
 counted_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 counted_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,product_id) references icamp_private.store_catalog_products(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,location_id) references icamp_private.store_stock_locations(organization_id,campground_id,id) on delete restrict
);
create index store_stock_counts_scope_idx on icamp_private.store_stock_counts(organization_id,campground_id,counted_at desc);
create index store_stock_counts_actor_idx on icamp_private.store_stock_counts(counted_by_user_id);
create index store_stock_counts_product_fk_idx on icamp_private.store_stock_counts(organization_id,campground_id,product_id);
create index store_stock_counts_location_fk_idx on icamp_private.store_stock_counts(organization_id,campground_id,location_id);

create table icamp_private.store_stock_count_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 count_id uuid not null unique,
 decision text not null check(decision in ('accept','reject')),
 reason_note text not null check(char_length(trim(reason_note)) between 12 and 800),
 adjustment_event_id uuid,
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 reviewed_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id,count_id) references icamp_private.store_stock_counts(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,adjustment_event_id) references icamp_private.store_stock_events(organization_id,campground_id,id) on delete restrict,
 check((decision='reject' and adjustment_event_id is null) or decision='accept')
);
create index store_stock_review_actor_idx on icamp_private.store_stock_count_reviews(reviewed_by_user_id);
create index store_stock_review_adjustment_idx on icamp_private.store_stock_count_reviews(organization_id,campground_id,adjustment_event_id);
create index store_stock_review_count_fk_idx on icamp_private.store_stock_count_reviews(organization_id,campground_id,count_id);

create table icamp_private.store_pos_session_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 session_id uuid not null unique,
 disposition text not null check(disposition in ('accepted','exception_open')),
 reason_note text not null check(char_length(trim(reason_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 reviewed_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id,session_id) references icamp_private.store_pos_sessions(organization_id,campground_id,id) on delete restrict
);
create index store_pos_review_actor_idx on icamp_private.store_pos_session_reviews(reviewed_by_user_id);
create index store_pos_review_session_fk_idx on icamp_private.store_pos_session_reviews(organization_id,campground_id,session_id);

-- All private table reads are permission-scoped. No guest, anon, or service API grants.
do $stock_rls$
declare t text;
begin
 foreach t in array array['store_stock_locations','store_stock_balances','store_stock_reorder_rules','store_pos_sessions','store_stock_events','store_stock_counts','store_stock_count_reviews','store_pos_session_reviews'] loop
  execute format('alter table icamp_private.%I enable row level security',t);
  execute format('alter table icamp_private.%I force row level security',t);
  execute format('revoke all on icamp_private.%I from public',t);
  if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on icamp_private.%I from anon',t);end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on icamp_private.%I from authenticated',t);end if;
  execute format('grant select on icamp_private.%I to icamp_app',t);
  execute format('create policy %I on icamp_private.%I for select to icamp_app using (icamp_private.has_campground_permission(campground_id,''inventory.read'') or icamp_private.has_campground_permission(campground_id,''inventory.manage'') or icamp_private.has_campground_permission(campground_id,''inventory.audit''))',t||'_read',t);
 end loop;
end $stock_rls$;
grant insert on icamp_private.store_stock_locations,icamp_private.store_pos_sessions,icamp_private.store_stock_counts,icamp_private.store_pos_session_reviews to icamp_app;
grant insert,update on icamp_private.store_stock_reorder_rules to icamp_app;
create policy store_stock_reorder_create on icamp_private.store_stock_reorder_rules for insert to icamp_app with check(
 updated_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid and icamp_private.has_campground_permission(campground_id,'inventory.manage'));
create policy store_stock_reorder_update on icamp_private.store_stock_reorder_rules for update to icamp_app using(
 icamp_private.has_campground_permission(campground_id,'inventory.manage')) with check(
 updated_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid and icamp_private.has_campground_permission(campground_id,'inventory.manage'));
create policy store_stock_location_create on icamp_private.store_stock_locations for insert to icamp_app with check(
 created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid and icamp_private.has_campground_permission(campground_id,'inventory.manage'));
create policy store_pos_session_create on icamp_private.store_pos_sessions for insert to icamp_app with check(
 opened_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid and icamp_private.has_campground_permission(campground_id,'inventory.manage'));
create policy store_stock_count_create on icamp_private.store_stock_counts for insert to icamp_app with check(
 counted_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid and icamp_private.has_campground_permission(campground_id,'inventory.manage'));
create policy store_pos_review_create on icamp_private.store_pos_session_reviews for insert to icamp_app with check(
 reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid and icamp_private.has_campground_permission(campground_id,'inventory.audit'));

create function icamp_private.store_guard_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Immutable store source evidence cannot be changed or deleted'; end $$;
revoke all on function icamp_private.store_guard_immutable() from public;
do $immut$
declare t text;
begin
 foreach t in array array['store_stock_locations','store_stock_events','store_stock_counts','store_stock_count_reviews','store_pos_session_reviews'] loop
  execute format('create trigger %I before update or delete on icamp_private.%I for each row execute function icamp_private.store_guard_immutable()',t||'_immutable',t);
 end loop;
end $immut$;

-- Derive physical-count expected balance from the authoritative locked ledger.
create function icamp_private.store_count_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare b record;
begin
 if new.counted_by_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid
   or not icamp_private.has_campground_permission(new.campground_id,'inventory.manage') then
   raise exception 'Count requires an authorized campground inventory manager'; end if;
 select quantity_on_hand,row_version into b from icamp_private.store_stock_balances
   where campground_id=new.campground_id and organization_id=new.organization_id
     and product_id=new.product_id and location_id=new.location_id for update;
 if not found or b.row_version=0 then raise exception 'Initialize a verified stock ledger before submitting a count'; end if;
 new.expected_quantity:=b.quantity_on_hand;
 new.expected_version:=b.row_version;
 return new;
end $$;
create trigger store_count_snapshot before insert on icamp_private.store_stock_counts
for each row execute function icamp_private.store_count_guard();

-- A review must be independent of session opening and closing; it never settles money.
create function icamp_private.store_pos_review_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare s record;
begin
 if new.reviewed_by_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid
   or not icamp_private.has_campground_permission(new.campground_id,'inventory.audit') then
   raise exception 'Independent POS review permission required'; end if;
 select status,opened_by_user_id,closed_by_user_id,expected_cash_cents,observed_cash_cents into s
  from icamp_private.store_pos_sessions where id=new.session_id and organization_id=new.organization_id
    and campground_id=new.campground_id;
 if not found or s.status<>'closed' or new.reviewed_by_user_id in (s.opened_by_user_id,s.closed_by_user_id) then
   raise exception 'POS close requires a different authorized reviewer'; end if;
 if s.expected_cash_cents<>s.observed_cash_cents and new.disposition='accepted' then
   raise exception 'Unresolved till variance must remain an open exception'; end if;
 return new;
end $$;
create trigger store_pos_review_guard before insert on icamp_private.store_pos_session_reviews
for each row execute function icamp_private.store_pos_review_guard();

create function icamp_private.store_pos_open_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.opened_by_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid
   or not icamp_private.has_campground_permission(new.campground_id,'inventory.manage')
   or new.status<>'open' or new.row_version<>1 or new.closed_at is not null
   or new.closed_by_user_id is not null or new.expected_cash_cents is not null
   or new.observed_cash_cents is not null or new.closing_note is not null then
   raise exception 'Only a clean authorized POS opening can be inserted'; end if;
 return new;
end $$;
create trigger store_pos_open_guard before insert on icamp_private.store_pos_sessions
for each row execute function icamp_private.store_pos_open_guard();

-- A single advisory lock per campground/product serializes all physical location
-- operations and protects against negative stock even with simultaneous registers.
create function icamp_private.post_store_stock_operation(
 p_camp uuid,p_event uuid,p_product uuid,p_location uuid,p_kind text,
 p_quantity integer,p_expected_version bigint,p_source text,p_note text,
 p_target_location uuid default null,p_target_version bigint default null,
 p_session uuid default null,p_expected_cash_cents integer default null)
returns table(event_id uuid,created boolean)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
 org uuid; b record; dest record; delta integer; prior record; sess record; movement_kind text;
begin
 movement_kind:=case when p_kind='transfer' then 'transfer_out' else p_kind end;
 if actor is null or not icamp_private.has_campground_permission(p_camp,'inventory.manage') then
   raise exception 'Inventory management permission required'; end if;
 if p_quantity not between 1 and 9999 or p_expected_version is null or p_expected_version<0
   or char_length(trim(coalesce(p_source,''))) not between 8 and 180
   or char_length(trim(coalesce(p_note,''))) not between 12 and 800 then
   raise exception 'Invalid quantity, stock version or source-backed reason'; end if;
 if p_kind not in ('opening_count','receipt','transfer','damage','return','pos_sale') then
   raise exception 'Unsupported stock operation'; end if;
 select organization_id into org from public.campgrounds where id=p_camp and lifecycle_state='active';
 if org is null or not exists(select 1 from icamp_private.store_catalog_products where id=p_product and campground_id=p_camp and organization_id=org)
   or not exists(select 1 from icamp_private.store_stock_locations where id=p_location and campground_id=p_camp and organization_id=org) then
   raise exception 'Product or stock location outside authorized campground'; end if;
 if p_kind='transfer' and (p_target_location is null or p_target_location=p_location or p_target_version is null
   or not exists(select 1 from icamp_private.store_stock_locations where id=p_target_location and campground_id=p_camp and organization_id=org)) then
   raise exception 'Transfer requires a distinct authorized destination and version'; end if;
 if p_kind<>'transfer' and (p_target_location is not null or p_target_version is not null) then
   raise exception 'Destination belongs only to paired transfers'; end if;
 if p_kind='pos_sale' then
   if p_session is null or p_expected_cash_cents not between 1 and 100000000 then
     raise exception 'POS sale requires an open register and positive unsettled register amount'; end if;
   select * into sess from icamp_private.store_pos_sessions
     where id=p_session and campground_id=p_camp and organization_id=org for update;
   if not found or sess.status<>'open' then raise exception 'POS register is not open'; end if;
 elsif p_session is not null or p_expected_cash_cents is not null then
   raise exception 'Only POS sale may refer to a register amount';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_camp::text||p_product::text,192));
 select * into prior from icamp_private.store_stock_events where id=p_event;
 if found then
   if prior.campground_id<>p_camp or prior.product_id<>p_product or prior.location_id<>p_location
     or prior.kind<>movement_kind
     or abs(prior.quantity_change)<>p_quantity or prior.source_reference<>p_source
     or prior.reason_note<>p_note or prior.pos_session_id is distinct from p_session
     or prior.expected_cash_cents is distinct from p_expected_cash_cents then
     raise exception 'Stock operation idempotency key conflicts with another source'; end if;
   return query select p_event,false; return;
 end if;
 insert into icamp_private.store_stock_balances(organization_id,campground_id,product_id,location_id)
 values(org,p_camp,p_product,p_location) on conflict(product_id,location_id) do nothing;
 select quantity_on_hand,row_version into b from icamp_private.store_stock_balances
  where product_id=p_product and location_id=p_location for update;
 if b.row_version<>p_expected_version or (p_kind='opening_count' and b.row_version<>0) then
   raise exception 'Stock version changed; refresh and recount'; end if;
 if p_kind='transfer' then
   insert into icamp_private.store_stock_balances(organization_id,campground_id,product_id,location_id)
   values(org,p_camp,p_product,p_target_location) on conflict(product_id,location_id) do nothing;
   select quantity_on_hand,row_version into dest from icamp_private.store_stock_balances
    where product_id=p_product and location_id=p_target_location for update;
   if dest.row_version<>p_target_version then raise exception 'Destination stock version changed; refresh'; end if;
 end if;
 delta:=case when p_kind in ('damage','transfer','pos_sale') then -p_quantity else p_quantity end;
 if b.quantity_on_hand+delta<0 then raise exception 'Insufficient available stock; negative inventory blocked'; end if;
 if b.quantity_on_hand+delta>999999 or (p_kind='transfer' and dest.quantity_on_hand+p_quantity>999999) then
   raise exception 'Stock capacity exceeded'; end if;
 update icamp_private.store_stock_balances set quantity_on_hand=quantity_on_hand+delta,
   row_version=row_version+1,updated_at=statement_timestamp()
   where product_id=p_product and location_id=p_location;
 insert into icamp_private.store_stock_events(id,organization_id,campground_id,product_id,location_id,kind,
   quantity_change,quantity_before,quantity_after,transfer_group_id,pos_session_id,expected_cash_cents,
   source_reference,reason_note,actor_user_id)
 values(p_event,org,p_camp,p_product,p_location,
   movement_kind,delta,b.quantity_on_hand,b.quantity_on_hand+delta,
   case when p_kind='transfer' then p_event else null end,p_session,p_expected_cash_cents,p_source,p_note,actor);
 if p_kind='transfer' then
   update icamp_private.store_stock_balances set quantity_on_hand=quantity_on_hand+p_quantity,
     row_version=row_version+1,updated_at=statement_timestamp()
     where product_id=p_product and location_id=p_target_location;
   insert into icamp_private.store_stock_events(id,organization_id,campground_id,product_id,location_id,kind,
     quantity_change,quantity_before,quantity_after,transfer_group_id,source_reference,reason_note,actor_user_id)
   values(pg_catalog.gen_random_uuid(),org,p_camp,p_product,p_target_location,'transfer_in',p_quantity,
     dest.quantity_on_hand,dest.quantity_on_hand+p_quantity,p_event,p_source,p_note,actor);
 end if;
 return query select p_event,true;
end $$;

create function icamp_private.close_store_pos_session(p_camp uuid,p_session uuid,p_expected_version bigint,
 p_observed_cash_cents integer,p_note text)
returns table(session_id uuid,expected_cents bigint,variance_cents bigint)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
 s record; total bigint;
begin
 if actor is null or not icamp_private.has_campground_permission(p_camp,'inventory.manage') then
   raise exception 'POS session management permission required'; end if;
 if p_observed_cash_cents not between 0 and 100000000 or char_length(trim(coalesce(p_note,''))) not between 12 and 500 then
   raise exception 'Register closing observation and reason required'; end if;
 select * into s from icamp_private.store_pos_sessions where id=p_session and campground_id=p_camp for update;
 if not found or s.status<>'open' or s.row_version<>p_expected_version then
   raise exception 'Register session changed or already closed; refresh'; end if;
 select s.opening_cash_cents+coalesce(sum(e.expected_cash_cents),0) into total
 from icamp_private.store_stock_events e where e.pos_session_id=p_session;
 if total>100000000 then raise exception 'Register bookkeeping total exceeds supported range'; end if;
 update icamp_private.store_pos_sessions set status='closed',closed_by_user_id=actor,
   closed_at=statement_timestamp(),observed_cash_cents=p_observed_cash_cents,
   expected_cash_cents=total,closing_note=p_note,row_version=row_version+1 where id=p_session;
 return query select p_session,total,(p_observed_cash_cents::bigint-total);
end $$;

create function icamp_private.review_store_stock_count(p_camp uuid,p_count uuid,p_review uuid,
 p_decision text,p_note text,p_adjustment_event uuid)
returns table(review_id uuid,adjustment_id uuid)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
 c record; b record; delta integer; event_id uuid;
begin
 if actor is null or not icamp_private.has_campground_permission(p_camp,'inventory.audit') then
   raise exception 'Inventory independent audit permission required'; end if;
 if p_decision not in ('accept','reject') or char_length(trim(coalesce(p_note,''))) not between 12 and 800 then
   raise exception 'Review decision and independent reasoning are required'; end if;
 select * into c from icamp_private.store_stock_counts where id=p_count and campground_id=p_camp for update;
 if not found or c.counted_by_user_id=actor then raise exception 'Stock count must be independently reviewed'; end if;
 if exists(select 1 from icamp_private.store_stock_count_reviews where count_id=p_count) then
   raise exception 'Stock count already independently reviewed'; end if;
 event_id:=null;
 if p_decision='accept' then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_camp::text||c.product_id::text,192));
   select * into b from icamp_private.store_stock_balances where product_id=c.product_id and location_id=c.location_id for update;
   if not found or b.row_version<>c.expected_version or b.quantity_on_hand<>c.expected_quantity then
     raise exception 'Count evidence stale; a fresh physical count is required'; end if;
   delta:=c.observed_quantity-b.quantity_on_hand;
   if delta<>0 then
     if p_adjustment_event is null then raise exception 'Adjustment event ID required for variance'; end if;
     update icamp_private.store_stock_balances set quantity_on_hand=c.observed_quantity,
       row_version=row_version+1,updated_at=statement_timestamp()
       where product_id=c.product_id and location_id=c.location_id;
     insert into icamp_private.store_stock_events(id,organization_id,campground_id,product_id,location_id,kind,
       quantity_change,quantity_before,quantity_after,source_reference,reason_note,actor_user_id)
     values(p_adjustment_event,c.organization_id,p_camp,c.product_id,c.location_id,'count_adjustment',delta,
       b.quantity_on_hand,c.observed_quantity,c.source_reference,p_note,actor);
     event_id:=p_adjustment_event;
   end if;
 end if;
 insert into icamp_private.store_stock_count_reviews(id,organization_id,campground_id,count_id,decision,
   reason_note,adjustment_event_id,reviewed_by_user_id)
 values(p_review,c.organization_id,p_camp,p_count,p_decision,p_note,event_id,actor);
 return query select p_review,event_id;
end $$;

-- Definer operations are private, callable only through the authenticated app
-- database role and independently check the current actor's campground rights.
revoke all on function icamp_private.store_count_guard() from public;
revoke all on function icamp_private.store_pos_review_guard() from public;
revoke all on function icamp_private.store_pos_open_guard() from public;
revoke all on function icamp_private.post_store_stock_operation(uuid,uuid,uuid,uuid,text,integer,bigint,text,text,uuid,bigint,uuid,integer) from public;
revoke all on function icamp_private.close_store_pos_session(uuid,uuid,bigint,integer,text) from public;
revoke all on function icamp_private.review_store_stock_count(uuid,uuid,uuid,text,text,uuid) from public;
grant execute on function icamp_private.post_store_stock_operation(uuid,uuid,uuid,uuid,text,integer,bigint,text,text,uuid,bigint,uuid,integer) to icamp_app;
grant execute on function icamp_private.close_store_pos_session(uuid,uuid,bigint,integer,text) to icamp_app;
grant execute on function icamp_private.review_store_stock_count(uuid,uuid,uuid,text,text,uuid) to icamp_app;

comment on table icamp_private.store_stock_events is 'Build192 append-only internal physical stock evidence, not processor settlement or purchase execution.';
comment on table icamp_private.store_pos_sessions is 'Build192 register opening and manual expected-vs-observed cash bookkeeping. Actual payment processing remains HELD.';
