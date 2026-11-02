-- Build 080: issued prepaid tag evidence and one-time pickup redemption.
-- A receipt reference is staff-attested evidence, never a fabricated provider capture.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values ('garbage.tags.sell','Issue paid garbage tags against verified sale receipts.','elevated'),
 ('garbage.tags.redeem','Redeem single-use garbage tags for a scoped pickup.','standard')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r
join (values
 ('owner_admin','garbage.tags.sell'),('owner_admin','garbage.tags.redeem'),
 ('campground_manager','garbage.tags.sell'),('campground_manager','garbage.tags.redeem'),
 ('front_desk','garbage.tags.sell'),('front_desk','garbage.tags.redeem'),
 ('maintenance_main_foreman','garbage.tags.redeem'),
 ('maintenance_foreman','garbage.tags.redeem'),
 ('maintenance_lead','garbage.tags.redeem')
) as grants(role_code,permission_key) on grants.role_code=r.role_code and r.role_kind='template'
join icamp_private.permission_catalog p on p.permission_key=grants.permission_key
on conflict do nothing;

create table public.garbage_paid_tags (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 sale_id uuid not null,
 tag_code text not null check(tag_code ~ '^GT-[A-F0-9]{24}$'),
 stream text not null check(stream in ('garbage','recycling','organics')),
 price_cents integer not null check(price_cents between 1 and 1000000),
 currency_code char(3) not null default 'CAD' check(currency_code='CAD'),
 receipt_reference text not null check(char_length(receipt_reference) between 4 and 120),
 accommodation_id uuid not null,
 reservation_id uuid,
 issued_by_user_id uuid not null references icamp_private.user_accounts(id),
 issued_at timestamptz not null default now(),
 redeemed_pickup_id uuid,
 redeemed_by_user_id uuid references icamp_private.user_accounts(id),
 redeemed_at timestamptz,
 unique(campground_id,sale_id),
 unique(tag_code),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id),
 foreign key(organization_id,campground_id,accommodation_id)
  references public.accommodations(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,reservation_id)
  references public.reservations(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,redeemed_pickup_id)
  references public.garbage_pickup_requests(organization_id,campground_id,id),
 constraint garbage_paid_tags_redemption_complete check (
  (redeemed_pickup_id is null and redeemed_by_user_id is null and redeemed_at is null)
  or (redeemed_pickup_id is not null and redeemed_by_user_id is not null and redeemed_at is not null)
 )
);
create unique index garbage_paid_tags_pickup_once_idx on public.garbage_paid_tags(redeemed_pickup_id)
 where redeemed_pickup_id is not null;
create index garbage_paid_tags_scope_time_idx on public.garbage_paid_tags(campground_id,issued_at desc);
create index garbage_paid_tags_accommodation_idx on public.garbage_paid_tags(organization_id,campground_id,accommodation_id);
create index garbage_paid_tags_reservation_idx on public.garbage_paid_tags(organization_id,campground_id,reservation_id);
create index garbage_paid_tags_issuer_idx on public.garbage_paid_tags(issued_by_user_id);
create index garbage_paid_tags_redeemer_idx on public.garbage_paid_tags(redeemed_by_user_id) where redeemed_by_user_id is not null;

create function icamp_private.guard_garbage_tag_update() returns trigger
 language plpgsql set search_path = '' as $$
begin
 if old.redeemed_at is not null then raise exception 'Redeemed tag is immutable'; end if;
 if (new.id,new.organization_id,new.campground_id,new.sale_id,new.tag_code,
  new.stream,new.price_cents,new.currency_code,new.receipt_reference,
  new.accommodation_id,new.reservation_id,new.issued_by_user_id,new.issued_at)
  is distinct from
  (old.id,old.organization_id,old.campground_id,old.sale_id,old.tag_code,
  old.stream,old.price_cents,old.currency_code,old.receipt_reference,
  old.accommodation_id,old.reservation_id,old.issued_by_user_id,old.issued_at)
 then raise exception 'Issued sale evidence is immutable'; end if;
 if new.redeemed_at is null then raise exception 'Only redemption may update a tag'; end if;
 return new;
end $$;
create trigger garbage_tag_redemption_guard before update on public.garbage_paid_tags
 for each row execute function icamp_private.guard_garbage_tag_update();
create function icamp_private.reject_garbage_tag_delete() returns trigger
 language plpgsql set search_path = '' as $$
begin raise exception 'Paid tag evidence cannot be deleted'; end $$;
create trigger garbage_tag_delete_guard before delete on public.garbage_paid_tags
 for each row execute function icamp_private.reject_garbage_tag_delete();

alter table public.garbage_paid_tags enable row level security;
alter table public.garbage_paid_tags force row level security;
revoke all on public.garbage_paid_tags from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.garbage_paid_tags from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert,update on public.garbage_paid_tags to icamp_app;
create policy garbage_tag_read on public.garbage_paid_tags for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'garbage.read')
 or icamp_private.has_campground_permission(campground_id,'garbage.tags.sell')
 or icamp_private.has_campground_permission(campground_id,'garbage.tags.redeem')
);
create policy garbage_tag_issue on public.garbage_paid_tags for insert to icamp_app with check (
 icamp_private.has_campground_permission(campground_id,'garbage.tags.sell')
 and issued_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and redeemed_pickup_id is null
);
create policy garbage_tag_redeem on public.garbage_paid_tags for update to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'garbage.tags.redeem')
) with check (
 icamp_private.has_campground_permission(campground_id,'garbage.tags.redeem')
 and redeemed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
);
-- Reuse one SELECT policy for site visibility, preserving advisor performance.
alter policy accommodations_read on public.accommodations using (
 icamp_private.has_campground_permission(campground_id,'accommodation.read')
 or icamp_private.has_campground_permission(campground_id,'accommodation.manage')
 or icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
 or icamp_private.has_campground_permission(campground_id,'visitor.read')
 or icamp_private.has_campground_permission(campground_id,'visitor.register')
 or icamp_private.has_campground_permission(campground_id,'garbage.read')
 or icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
 or icamp_private.has_campground_permission(campground_id,'garbage.tags.sell')
 or icamp_private.has_campground_permission(campground_id,'garbage.tags.redeem')
);
