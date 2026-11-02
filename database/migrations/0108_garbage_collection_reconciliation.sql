-- Build 081: route manifests, append-only collection proof and POS receipt review.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values
 ('garbage.routes.manage','Plan garbage collection routes and attest site pickup evidence.','standard'),
 ('garbage.finance.reconcile','Review paid-tag receipt evidence without posting financial captures.','elevated')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r
join (values
 ('owner_admin','garbage.routes.manage'),('campground_manager','garbage.routes.manage'),
 ('maintenance_main_foreman','garbage.routes.manage'),('maintenance_foreman','garbage.routes.manage'),
 ('maintenance_lead','garbage.routes.manage'),
 ('owner_admin','garbage.finance.reconcile'),('campground_manager','garbage.finance.reconcile')
) as grants(role_code,permission_key) on grants.role_code=r.role_code and r.role_kind='template'
join icamp_private.permission_catalog p on p.permission_key=grants.permission_key
on conflict do nothing;

create table public.garbage_collection_routes (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 client_route_id uuid not null,
 name text not null check(char_length(name) between 3 and 120),
 stream text not null check(stream in ('garbage','recycling','organics')),
 service_date date not null,
 route_note text check(route_note is null or char_length(route_note)<=1000),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default now(),
 unique(campground_id,client_route_id),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id)
);
create index garbage_collection_routes_scope_date_idx on public.garbage_collection_routes(campground_id,service_date desc);
create index garbage_collection_routes_creator_idx on public.garbage_collection_routes(created_by_user_id);

create table public.garbage_collection_proofs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 route_id uuid not null,
 pickup_id uuid not null,
 outcome text not null check(outcome in ('collected','not_accessible','not_ready','missed')),
 bag_count integer not null default 0 check(bag_count between 0 and 1000),
 note text not null check(char_length(note) between 4 and 1000),
 evidence_reference text check(evidence_reference is null or char_length(evidence_reference) between 4 and 240),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default now(),
 unique(route_id,pickup_id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id),
 foreign key(organization_id,campground_id,route_id)
  references public.garbage_collection_routes(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,pickup_id)
  references public.garbage_pickup_requests(organization_id,campground_id,id),
 constraint garbage_collection_proof_bags check (
  (outcome='collected' and bag_count>0) or (outcome<>'collected' and bag_count=0)
 )
);
create unique index garbage_collected_pickup_once_idx on public.garbage_collection_proofs(pickup_id)
 where outcome='collected';
create index garbage_collection_proofs_route_idx on public.garbage_collection_proofs(route_id,recorded_at desc);
create index garbage_collection_proofs_scope_idx on public.garbage_collection_proofs(campground_id,recorded_at desc);
create index garbage_collection_proofs_actor_idx on public.garbage_collection_proofs(recorded_by_user_id);

create table public.garbage_tag_finance_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 client_review_id uuid not null,
 tag_id uuid not null,
 decision text not null check(decision in ('receipt_matched','needs_followup','disputed')),
 checked_amount_cents integer check(checked_amount_cents between 0 and 1000000),
 receipt_reference_snapshot text not null check(char_length(receipt_reference_snapshot) between 4 and 120),
 note text not null check(char_length(note) between 4 and 1000),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default now(),
 unique(campground_id,client_review_id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id),
 foreign key(organization_id,campground_id,tag_id)
  references public.garbage_paid_tags(organization_id,campground_id,id),
 constraint garbage_tag_finance_match_amount check (
  decision<>'receipt_matched' or checked_amount_cents is not null
 )
);
create index garbage_tag_finance_reviews_tag_idx on public.garbage_tag_finance_reviews(tag_id,reviewed_at desc);
create index garbage_tag_finance_reviews_scope_idx on public.garbage_tag_finance_reviews(campground_id,reviewed_at desc);
create index garbage_tag_finance_reviews_actor_idx on public.garbage_tag_finance_reviews(reviewed_by_user_id);

create function icamp_private.validate_garbage_collection_proof() returns trigger
 language plpgsql set search_path = '' as $$
declare route_stream text; pickup_stream text; pickup_state text;
begin
 select stream into route_stream from public.garbage_collection_routes
  where id=new.route_id and organization_id=new.organization_id and campground_id=new.campground_id;
 select stream,state into pickup_stream,pickup_state from public.garbage_pickup_requests
  where id=new.pickup_id and organization_id=new.organization_id and campground_id=new.campground_id;
 if route_stream is null or pickup_stream is null or route_stream<>pickup_stream then
  raise exception 'Collection route and pickup stream must match within campground';
 end if;
 if pickup_state='cancelled' then raise exception 'Cannot collect a cancelled pickup'; end if;
 if new.outcome='collected' and pickup_state not in ('in_progress','completed') then
  raise exception 'Pickup must be in progress or completed before collection is attested';
 end if;
 return new;
end $$;
create trigger garbage_collection_proof_validate before insert on public.garbage_collection_proofs
 for each row execute function icamp_private.validate_garbage_collection_proof();

create function icamp_private.validate_garbage_finance_review() returns trigger
 language plpgsql set search_path = '' as $$
declare tag_amount integer; tag_receipt text;
begin
 select price_cents,receipt_reference into tag_amount,tag_receipt from public.garbage_paid_tags
  where id=new.tag_id and organization_id=new.organization_id and campground_id=new.campground_id;
 if tag_amount is null or new.receipt_reference_snapshot<>tag_receipt then
  raise exception 'Finance review must use this tag receipt reference'; end if;
 if new.decision='receipt_matched' and new.checked_amount_cents<>tag_amount then
  raise exception 'Matched receipt amount must equal issued tag price'; end if;
 return new;
end $$;
create trigger garbage_finance_review_validate before insert on public.garbage_tag_finance_reviews
 for each row execute function icamp_private.validate_garbage_finance_review();

create function icamp_private.reject_garbage_audit_mutation() returns trigger
 language plpgsql set search_path = '' as $$
begin raise exception 'Garbage collection and finance evidence is append-only'; end $$;
create trigger garbage_route_append_only before update or delete on public.garbage_collection_routes
 for each row execute function icamp_private.reject_garbage_audit_mutation();
create trigger garbage_proof_append_only before update or delete on public.garbage_collection_proofs
 for each row execute function icamp_private.reject_garbage_audit_mutation();
create trigger garbage_finance_review_append_only before update or delete on public.garbage_tag_finance_reviews
 for each row execute function icamp_private.reject_garbage_audit_mutation();

alter table public.garbage_collection_routes enable row level security;
alter table public.garbage_collection_routes force row level security;
alter table public.garbage_collection_proofs enable row level security;
alter table public.garbage_collection_proofs force row level security;
alter table public.garbage_tag_finance_reviews enable row level security;
alter table public.garbage_tag_finance_reviews force row level security;
revoke all on public.garbage_collection_routes,public.garbage_collection_proofs,
 public.garbage_tag_finance_reviews from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.garbage_collection_routes,public.garbage_collection_proofs,public.garbage_tag_finance_reviews from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.garbage_collection_routes,public.garbage_collection_proofs,
 public.garbage_tag_finance_reviews to icamp_app;
create policy garbage_route_read on public.garbage_collection_routes for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'garbage.read')
 or icamp_private.has_campground_permission(campground_id,'garbage.routes.manage')
);
create policy garbage_route_insert on public.garbage_collection_routes for insert to icamp_app with check (
 icamp_private.has_campground_permission(campground_id,'garbage.routes.manage')
 and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
);
create policy garbage_proof_read on public.garbage_collection_proofs for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'garbage.read')
 or icamp_private.has_campground_permission(campground_id,'garbage.routes.manage')
);
create policy garbage_proof_insert on public.garbage_collection_proofs for insert to icamp_app with check (
 icamp_private.has_campground_permission(campground_id,'garbage.routes.manage')
 and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
);
create policy garbage_finance_read on public.garbage_tag_finance_reviews for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'garbage.finance.reconcile')
);
create policy garbage_finance_insert on public.garbage_tag_finance_reviews for insert to icamp_app with check (
 icamp_private.has_campground_permission(campground_id,'garbage.finance.reconcile')
 and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
);
