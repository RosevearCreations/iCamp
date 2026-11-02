-- Build 183: staff-attested retail catalog and private guest cart drafts.
-- No paid order, stock allocation, delivery dispatch or provider calls.

insert into icamp_private.role_permissions (role_id,permission_key)
select r.id,'inventory.manage' from icamp_private.roles r
where r.role_code='campground_manager' and r.role_kind='template'
on conflict (role_id,permission_key) do nothing;

create table icamp_private.store_catalog_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  sku text not null check (sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text not null check (char_length(trim(description)) between 10 and 1200),
  category text not null check (category in ('essentials','food','camping','firewood','souvenirs','other')),
  staff_reported_stock integer check (staff_reported_stock between 0 and 9999),
  stock_verified_at timestamptz,
  is_published boolean not null default false,
  reviewed_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  reviewed_at timestamptz,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version>=1),
  constraint store_product_campground_fk foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on update cascade on delete restrict,
  constraint store_product_scope_unique unique (organization_id,campground_id,id),
  constraint store_product_sku_unique unique (campground_id,sku),
  constraint store_product_stock_timestamp_check check ((staff_reported_stock is null)=(stock_verified_at is null)),
  constraint store_product_publish_check check (not is_published or reviewed_at is not null)
);
create index store_products_published_idx on icamp_private.store_catalog_products(campground_id,category,name)
  where is_published;
create trigger store_products_touch before update on icamp_private.store_catalog_products
  for each row execute function icamp_private.touch_row();

create table icamp_private.guest_store_cart_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  guest_user_id uuid not null references icamp_private.user_accounts(id) on update cascade on delete restrict,
  reservation_id uuid,
  fulfillment_preference text not null default 'office_pickup' check (fulfillment_preference in ('office_pickup','campsite_delivery')),
  requested_delivery_date date,
  delivery_note text not null default '' check (char_length(delivery_note)<=400),
  review_state text not null default 'draft' check (review_state in ('draft','submitted','reviewed','declined')),
  review_requested_at timestamptz,
  reviewed_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version>=1),
  constraint guest_store_cart_campground_fk foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on update cascade on delete restrict,
  constraint guest_store_cart_reservation_fk foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id) on update cascade on delete restrict,
  constraint guest_store_cart_scope_unique unique (organization_id,campground_id,id),
  constraint guest_store_cart_per_guest_unique unique (guest_user_id,campground_id),
  constraint guest_store_cart_delivery_check check (
    (fulfillment_preference='office_pickup' and requested_delivery_date is null)
    or (fulfillment_preference='campsite_delivery' and reservation_id is not null and requested_delivery_date is not null)
  ),
  constraint guest_store_cart_review_check check (
    (review_state='draft' and review_requested_at is null and reviewed_at is null)
    or (review_state='submitted' and review_requested_at is not null and reviewed_at is null)
    or (review_state in ('reviewed','declined') and review_requested_at is not null and reviewed_at is not null)
  )
);
create index guest_store_cart_review_idx on icamp_private.guest_store_cart_drafts(campground_id,review_state,updated_at desc)
  where review_state<>'draft';
create index guest_store_cart_reservation_fk_idx on icamp_private.guest_store_cart_drafts(organization_id,campground_id,reservation_id)
  where reservation_id is not null;

create table icamp_private.guest_store_cart_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  cart_id uuid not null,
  product_id uuid not null,
  quantity smallint not null check (quantity between 1 and 20),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version>=1),
  constraint guest_store_cart_line_cart_fk foreign key (organization_id,campground_id,cart_id)
    references icamp_private.guest_store_cart_drafts(organization_id,campground_id,id) on update cascade on delete cascade,
  constraint guest_store_cart_line_product_fk foreign key (organization_id,campground_id,product_id)
    references icamp_private.store_catalog_products(organization_id,campground_id,id) on update cascade on delete restrict,
  constraint guest_store_cart_line_unique unique (cart_id,product_id)
);
create index guest_store_cart_lines_product_fk_idx on icamp_private.guest_store_cart_lines(organization_id,campground_id,product_id);
create trigger guest_store_cart_lines_touch before update on icamp_private.guest_store_cart_lines
  for each row execute function icamp_private.touch_row();

create function icamp_private.guard_guest_store_cart()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if row(new.organization_id,new.campground_id,new.guest_user_id)
       is distinct from row(old.organization_id,old.campground_id,old.guest_user_id) then
      raise exception 'Store cart tenant and owner cannot change';
    end if;
  end if;
  if not exists (select 1 from icamp_private.user_accounts u
    where u.id=new.guest_user_id and u.account_type='guest' and u.account_state='active') then
    raise exception 'Only active guest accounts can save carts';
  end if;
  if new.reservation_id is not null and not exists (
    select 1 from public.reservations r where r.id=new.reservation_id
      and r.organization_id=new.organization_id and r.campground_id=new.campground_id
      and r.guest_user_id=new.guest_user_id and r.status in ('confirmed','checked_in')
  ) then
    raise exception 'Cart reservation ownership or state is not eligible';
  end if;
  if new.fulfillment_preference='campsite_delivery' and not exists (
    select 1 from public.reservations r
    join public.campgrounds c on c.id=r.campground_id
    where r.id=new.reservation_id and r.guest_user_id=new.guest_user_id
      and r.organization_id=new.organization_id and r.campground_id=new.campground_id
      and new.requested_delivery_date>=r.arrival_date
      and new.requested_delivery_date<r.departure_date
      and new.requested_delivery_date>=(statement_timestamp() at time zone c.timezone)::date
  ) then
    raise exception 'Campsite delivery preference must cover an eligible stay date';
  end if;
  if new.review_state='submitted' and not exists (
    select 1 from icamp_private.guest_store_cart_lines where cart_id=new.id
  ) then
    raise exception 'Cannot request staff review for an empty cart';
  end if;
  return new;
end $$;
create trigger guest_store_cart_guard before insert or update on icamp_private.guest_store_cart_drafts
  for each row execute function icamp_private.guard_guest_store_cart();
create trigger guest_store_cart_touch before update on icamp_private.guest_store_cart_drafts
  for each row execute function icamp_private.touch_row();

create function icamp_private.guard_guest_store_cart_line()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if row(new.organization_id,new.campground_id,new.cart_id,new.product_id)
       is distinct from row(old.organization_id,old.campground_id,old.cart_id,old.product_id) then
      raise exception 'Cart line item and tenant identity cannot change';
    end if;
  end if;
  if not exists (select 1 from icamp_private.store_catalog_products p
    where p.id=new.product_id and p.campground_id=new.campground_id
      and p.organization_id=new.organization_id and p.is_published) then
    raise exception 'Only published products may be added to cart drafts';
  end if;
  return new;
end $$;
create trigger guest_store_cart_line_guard before insert or update on icamp_private.guest_store_cart_lines
  for each row execute function icamp_private.guard_guest_store_cart_line();

revoke all on function icamp_private.guard_guest_store_cart() from public;
revoke all on function icamp_private.guard_guest_store_cart_line() from public;
alter table icamp_private.store_catalog_products enable row level security;
alter table icamp_private.store_catalog_products force row level security;
alter table icamp_private.guest_store_cart_drafts enable row level security;
alter table icamp_private.guest_store_cart_drafts force row level security;
alter table icamp_private.guest_store_cart_lines enable row level security;
alter table icamp_private.guest_store_cart_lines force row level security;
create policy store_products_no_direct_access on icamp_private.store_catalog_products
  for all to icamp_app using(false) with check(false);
create policy guest_store_carts_no_direct_access on icamp_private.guest_store_cart_drafts
  for all to icamp_app using(false) with check(false);
create policy guest_store_lines_no_direct_access on icamp_private.guest_store_cart_lines
  for all to icamp_app using(false) with check(false);
revoke all on icamp_private.store_catalog_products,icamp_private.guest_store_cart_drafts,icamp_private.guest_store_cart_lines from public;
do $store_untrusted_role_grants$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on icamp_private.store_catalog_products,icamp_private.guest_store_cart_drafts,icamp_private.guest_store_cart_lines from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on icamp_private.store_catalog_products,icamp_private.guest_store_cart_drafts,icamp_private.guest_store_cart_lines from authenticated';
  end if;
end $store_untrusted_role_grants$;

comment on table icamp_private.guest_store_cart_drafts is
  'Build183 private guest cart & optional staffed delivery-preference review; not an order, charge, stock hold or dispatch.';
