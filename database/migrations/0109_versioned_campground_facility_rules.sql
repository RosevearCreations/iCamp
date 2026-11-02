-- Build 082: independently published, immutable campground and facility rules.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values
 ('campground.rules.read','Read campground and facility rule publication/acknowledgement history.','standard'),
 ('campground.rules.publish','Create campground/facility rule sets and publish immutable rule versions.','elevated')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,grants.permission_key from icamp_private.roles r
join (values
 ('owner_admin','campground.rules.read'),('campground_manager','campground.rules.read'),
 ('security','campground.rules.read'),
 ('owner_admin','campground.rules.publish'),('campground_manager','campground.rules.publish')
) grants(role_code,permission_key) on r.role_kind='template' and r.role_code=grants.role_code
on conflict do nothing;

create table public.campground_rule_sets (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 code text not null check(code ~ '^[A-Z][A-Z0-9_-]{2,39}$'),
 title text not null check(char_length(trim(title)) between 4 and 160),
 rule_category text not null check(rule_category in
  ('campground','pool','waterfront','sports','playground','event','access')),
 facility_id uuid,
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default now(),
 unique(campground_id,code),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id),
 foreign key(organization_id,campground_id,facility_id)
  references public.operational_assets(organization_id,campground_id,id),
 check(rule_category<>'campground' or facility_id is null)
);
create index campground_rule_sets_facility_idx on public.campground_rule_sets(campground_id,facility_id)
 where facility_id is not null;
create index campground_rule_sets_creator_idx on public.campground_rule_sets(created_by_user_id);

create table public.campground_rule_versions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 rule_set_id uuid not null,
 version_number integer not null check(version_number between 1 and 1000000),
 client_publication_id uuid not null,
 content text not null check(char_length(trim(content)) between 30 and 10000),
 acknowledgement_required boolean not null default true,
 published_by_user_id uuid not null references icamp_private.user_accounts(id),
 published_at timestamptz not null default now(),
 unique(rule_set_id,version_number),
 unique(campground_id,client_publication_id),
 unique(organization_id,campground_id,rule_set_id,id),
 foreign key(organization_id,campground_id,rule_set_id)
  references public.campground_rule_sets(organization_id,campground_id,id)
);
create index campground_rule_versions_current_idx on public.campground_rule_versions
 (campground_id,rule_set_id,version_number desc);
create index campground_rule_versions_publisher_idx on public.campground_rule_versions(published_by_user_id);

create table public.campground_rule_acknowledgements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 rule_set_id uuid not null,
 rule_version_id uuid not null,
 reservation_id uuid not null,
 guest_user_id uuid not null references icamp_private.user_accounts(id),
 acknowledgement_channel text not null default 'web' check(acknowledgement_channel='web'),
 acknowledged_at timestamptz not null default now(),
 unique(rule_version_id,reservation_id),
 foreign key(organization_id,campground_id,rule_set_id,rule_version_id)
  references public.campground_rule_versions(organization_id,campground_id,rule_set_id,id),
 foreign key(organization_id,campground_id,reservation_id)
  references public.reservations(organization_id,campground_id,id)
);
create index campground_rule_ack_reservation_idx on public.campground_rule_acknowledgements
 (reservation_id,acknowledged_at desc);
create index campground_rule_ack_guest_idx on public.campground_rule_acknowledgements(guest_user_id);
create index campground_rule_ack_campground_idx on public.campground_rule_acknowledgements(campground_id,acknowledged_at desc);

create function icamp_private.validate_campground_rule_set() returns trigger
 language plpgsql set search_path='' as $$
declare facility_class text;
begin
 if new.facility_id is not null then
  select asset_class into facility_class from public.operational_assets
   where id=new.facility_id and organization_id=new.organization_id and campground_id=new.campground_id;
  if facility_class is distinct from 'facility' then
   raise exception 'Facility-targeted rules require an operational facility in this campground';
  end if;
 end if;
 return new;
end $$;
create trigger campground_rule_set_validate before insert on public.campground_rule_sets
 for each row execute function icamp_private.validate_campground_rule_set();

create function icamp_private.validate_campground_rule_version() returns trigger
 language plpgsql set search_path='' as $$
declare latest integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('campground-rule-version:' || new.rule_set_id::text,0));
 perform 1 from public.campground_rule_sets
  where id=new.rule_set_id and organization_id=new.organization_id and campground_id=new.campground_id;
 if not found then raise exception 'Rule set not found in campground'; end if;
 select coalesce(max(version_number),0) into latest from public.campground_rule_versions
  where rule_set_id=new.rule_set_id;
 if new.version_number<>latest+1 then
  raise exception 'Rule version must advance consecutively from %',latest;
 end if;
 return new;
end $$;
create trigger campground_rule_version_validate before insert on public.campground_rule_versions
 for each row execute function icamp_private.validate_campground_rule_version();

create function icamp_private.validate_campground_rule_ack() returns trigger
 language plpgsql set search_path='' as $$
declare latest uuid; requires_ack boolean;
begin
 if not exists (
  select 1 from public.reservations r
  where r.id=new.reservation_id and r.organization_id=new.organization_id
   and r.campground_id=new.campground_id and r.guest_user_id=new.guest_user_id
   and r.status in ('confirmed','checked_in')
 ) then raise exception 'A confirmed guest-owned stay is required'; end if;
 select v.id,v.acknowledgement_required into latest,requires_ack
  from public.campground_rule_versions v
  where v.rule_set_id=new.rule_set_id and v.organization_id=new.organization_id
   and v.campground_id=new.campground_id
  order by v.version_number desc limit 1;
 if latest is distinct from new.rule_version_id or not coalesce(requires_ack,false) then
  raise exception 'Only the current published acknowledgement-required rule version can be accepted';
 end if;
 return new;
end $$;
create trigger campground_rule_ack_validate before insert on public.campground_rule_acknowledgements
 for each row execute function icamp_private.validate_campground_rule_ack();

create function icamp_private.reject_campground_rule_history_mutation() returns trigger
 language plpgsql set search_path='' as $$
begin raise exception 'Published campground rules and acknowledgements are append-only'; end $$;
create trigger campground_rule_set_immutable before update or delete on public.campground_rule_sets
 for each row execute function icamp_private.reject_campground_rule_history_mutation();
create trigger campground_rule_version_immutable before update or delete on public.campground_rule_versions
 for each row execute function icamp_private.reject_campground_rule_history_mutation();
create trigger campground_rule_ack_immutable before update or delete on public.campground_rule_acknowledgements
 for each row execute function icamp_private.reject_campground_rule_history_mutation();

alter table public.campground_rule_sets enable row level security;
alter table public.campground_rule_sets force row level security;
alter table public.campground_rule_versions enable row level security;
alter table public.campground_rule_versions force row level security;
alter table public.campground_rule_acknowledgements enable row level security;
alter table public.campground_rule_acknowledgements force row level security;
revoke all on public.campground_rule_sets,public.campground_rule_versions,
 public.campground_rule_acknowledgements from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.campground_rule_sets,public.campground_rule_versions,public.campground_rule_acknowledgements from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.campground_rule_sets,public.campground_rule_versions,
 public.campground_rule_acknowledgements to icamp_app;

create policy campground_rule_set_read on public.campground_rule_sets for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'campground.rules.read')
 or icamp_private.has_campground_permission(campground_id,'campground.rules.publish')
 or exists(select 1 from public.reservations r where r.campground_id=campground_rule_sets.campground_id
  and r.guest_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and r.status in ('confirmed','checked_in'))
);
create policy campground_rule_set_insert on public.campground_rule_sets for insert to icamp_app with check (
 icamp_private.has_campground_permission(campground_id,'campground.rules.publish')
 and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
);
create policy campground_rule_version_read on public.campground_rule_versions for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'campground.rules.read')
 or icamp_private.has_campground_permission(campground_id,'campground.rules.publish')
 or exists(select 1 from public.reservations r where r.campground_id=campground_rule_versions.campground_id
  and r.guest_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and r.status in ('confirmed','checked_in'))
);
create policy campground_rule_version_insert on public.campground_rule_versions for insert to icamp_app with check (
 icamp_private.has_campground_permission(campground_id,'campground.rules.publish')
 and published_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
);
create policy campground_rule_ack_read on public.campground_rule_acknowledgements for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'campground.rules.read')
 or icamp_private.has_campground_permission(campground_id,'campground.rules.publish')
 or (guest_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists(select 1 from public.reservations r where r.id=reservation_id
   and r.guest_user_id=guest_user_id and r.status in ('confirmed','checked_in')))
);
create policy campground_rule_ack_insert on public.campground_rule_acknowledgements for insert to icamp_app with check (
 guest_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and exists(select 1 from public.reservations r where r.id=reservation_id
  and r.campground_id=campground_rule_acknowledgements.campground_id
  and r.guest_user_id=guest_user_id and r.status in ('confirmed','checked_in'))
);
