-- Build 084: lifeguarded pool supervision. This is an operator evidence and
-- swim-admission ledger, not a physical gate, statutory certification or an
-- alternative to Build 069's inspected facility reopen procedure.
insert into icamp_private.permission_catalog(permission_key,description,risk_level) values
 ('pool.supervision.read','Read supervised-swimming safety records.','standard'),
 ('pool.supervision.attest','Record observations, warnings, removals and emergency swim holds.','elevated'),
 ('pool.supervision.manage','Publish pool policy, verify credentials and independently release swim holds.','high')
on conflict(permission_key) do nothing;

insert into icamp_private.roles(role_code,display_name,description,role_kind)
values('pool_lifeguard','Pool lifeguard','Supervised-swimming records; actual qualification must be manager-verified.','template')
on conflict do nothing;
insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r
join (values
 ('owner_admin','pool.supervision.read'),('owner_admin','pool.supervision.manage'),
 ('campground_manager','pool.supervision.read'),('campground_manager','pool.supervision.manage'),
 ('pool_lifeguard','pool.supervision.read'),('pool_lifeguard','pool.supervision.attest')
) p(role_code,permission_key) on p.role_code=r.role_code and r.role_kind='template'
on conflict do nothing;
-- Lifeguards need the existing exact-version rule acknowledgement read
-- permission and pool asset labels; this does not grant publication or asset
-- management authority.
insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r
cross join (values('campground.rules.read'),('asset.read')) p(permission_key)
where r.role_kind='template' and r.role_code='pool_lifeguard'
on conflict do nothing;

create table public.pool_swim_policies (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 asset_id uuid not null,
 version_number integer not null check(version_number between 1 and 1000000),
 maximum_bathers integer not null check(maximum_bathers between 1 and 10000),
 minimum_unaccompanied_age integer not null check(minimum_unaccompanied_age between 0 and 25),
 minimum_supervisor_age integer not null check(minimum_supervisor_age between 13 and 99),
 maximum_children_per_supervisor integer not null check(maximum_children_per_supervisor between 1 and 50),
 minimum_lifeguards integer not null check(minimum_lifeguards between 1 and 50),
 rule_version_id uuid not null references public.campground_rule_versions(id),
 safety_instructions text not null check(char_length(trim(safety_instructions)) between 30 and 2000),
 published_by_user_id uuid not null references icamp_private.user_accounts(id),
 published_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 unique(asset_id,version_number),
 foreign key(organization_id,campground_id,asset_id)
  references public.operational_assets(organization_id,campground_id,id)
);
create index pool_swim_policies_scope_asset_idx on public.pool_swim_policies(campground_id,asset_id,version_number desc);
create index pool_swim_policies_publisher_idx on public.pool_swim_policies(published_by_user_id);
create index pool_swim_policies_rule_idx on public.pool_swim_policies(rule_version_id);
create index pool_swim_policies_scope_asset_fk_idx on public.pool_swim_policies(organization_id,campground_id,asset_id);

-- Append-only verification/revocation decisions; qualifications are checked
-- at every event, never inferred from role assignment alone.
create table public.pool_staff_qualifications (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 asset_id uuid not null,
 staff_user_id uuid not null references icamp_private.user_accounts(id),
 decision text not null check(decision in ('verify','revoke')),
 credential_reference text not null check(char_length(trim(credential_reference)) between 8 and 400),
 expires_at timestamptz,
 decision_note text not null check(char_length(trim(decision_note)) between 12 and 2000),
 decided_by_user_id uuid not null references icamp_private.user_accounts(id),
 decided_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id,asset_id)
  references public.operational_assets(organization_id,campground_id,id),
 check((decision='verify' and expires_at is not null) or (decision='revoke' and expires_at is null))
);
create index pool_staff_qualifications_latest_idx on public.pool_staff_qualifications(campground_id,asset_id,staff_user_id,decided_at desc,id desc);
create index pool_staff_qualifications_actor_idx on public.pool_staff_qualifications(decided_by_user_id);
create index pool_staff_qualifications_staff_idx on public.pool_staff_qualifications(staff_user_id);
create index pool_staff_qualifications_scope_asset_fk_idx on public.pool_staff_qualifications(organization_id,campground_id,asset_id);

create table public.pool_swim_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 asset_id uuid not null,
 policy_id uuid not null,
 kind text not null check(kind in ('admission_check','warning','removal','hold','release_request','release')),
 reservation_id uuid,
 bather_count integer check(bather_count between 0 and 10000),
 underage_count integer check(underage_count between 0 and 10000),
 supervisor_count integer check(supervisor_count between 0 and 10000),
 lifeguard_count integer check(lifeguard_count between 0 and 10000),
 admitted boolean,
 supervision_ages_verified boolean,
 reason text not null check(char_length(trim(reason)) between 12 and 2000),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 occurred_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id,asset_id)
  references public.operational_assets(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,policy_id)
  references public.pool_swim_policies(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,reservation_id)
  references public.reservations(organization_id,campground_id,id),
 check ((kind='admission_check' and reservation_id is not null and admitted is not null and supervision_ages_verified is not null
   and bather_count is not null and underage_count is not null and supervisor_count is not null and lifeguard_count is not null)
  or (kind in ('warning','removal') and reservation_id is not null and admitted is null)
  or (kind in ('hold','release_request','release') and reservation_id is null and admitted is null)),
 check(underage_count is null or (bather_count is not null and underage_count<=bather_count))
);
create index pool_swim_events_latest_idx on public.pool_swim_events(campground_id,asset_id,occurred_at desc,id desc);
create index pool_swim_events_actor_idx on public.pool_swim_events(actor_user_id);
create index pool_swim_events_reservation_idx on public.pool_swim_events(reservation_id) where reservation_id is not null;
create index pool_swim_events_scope_policy_fk_idx on public.pool_swim_events(organization_id,campground_id,policy_id);
create index pool_swim_events_scope_asset_fk_idx on public.pool_swim_events(organization_id,campground_id,asset_id);
create index pool_swim_events_scope_reservation_fk_idx on public.pool_swim_events(organization_id,campground_id,reservation_id) where reservation_id is not null;

create function icamp_private.pool_swim_asset_ok(org uuid,camp uuid,asset uuid) returns boolean
 language sql security definer stable set search_path='' as $$
 select exists(select 1 from public.operational_assets a
 join public.operational_facilities f on f.asset_id=a.id and f.organization_id=a.organization_id and f.campground_id=a.campground_id
 where a.organization_id=org and a.campground_id=camp and a.id=asset
 and a.asset_class='facility' and a.lifecycle_state='active' and f.facility_type='pool');
 $$;
revoke all on function icamp_private.pool_swim_asset_ok(uuid,uuid,uuid) from public;

create function icamp_private.pool_swim_qualified(camp uuid,asset uuid,staff uuid) returns boolean
 language sql security definer stable set search_path='' as $$
 select exists(select 1 from (
  select q.decision,q.expires_at from public.pool_staff_qualifications q
  where q.campground_id=camp and q.asset_id=asset and q.staff_user_id=staff
  order by q.decided_at desc,q.id desc limit 1
 ) last where last.decision='verify' and last.expires_at>statement_timestamp());
 $$;
revoke all on function icamp_private.pool_swim_qualified(uuid,uuid,uuid) from public;

create function icamp_private.validate_pool_swim_policy() returns trigger
 language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
        previous integer; current_rule uuid;
begin
 if actor is null or actor<>new.published_by_user_id
    or not icamp_private.has_campground_permission(new.campground_id,'pool.supervision.manage') then
  raise exception 'Pool policy requires authorized management'; end if;
 if not icamp_private.pool_swim_asset_ok(new.organization_id,new.campground_id,new.asset_id) then
  raise exception 'Select an active pool in the campground'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pool-policy:'||new.asset_id::text,0));
 select coalesce(max(version_number),0) into previous from public.pool_swim_policies where asset_id=new.asset_id;
 if new.version_number<>previous+1 then raise exception 'Pool policy must advance one immutable version'; end if;
 select v.id into current_rule from public.campground_rule_versions v
 join public.campground_rule_sets s on s.id=v.rule_set_id
 where v.id=new.rule_version_id and v.organization_id=new.organization_id and v.campground_id=new.campground_id
  and s.rule_category='pool' and (s.facility_id is null or s.facility_id=new.asset_id)
  and not exists(select 1 from public.campground_rule_versions newer
   where newer.rule_set_id=v.rule_set_id and newer.version_number>v.version_number);
 if current_rule is null then raise exception 'Publish and select the current pool rule version'; end if;
 return new;
end $$;
revoke all on function icamp_private.validate_pool_swim_policy() from public;
create trigger pool_swim_policy_validate before insert on public.pool_swim_policies
 for each row execute function icamp_private.validate_pool_swim_policy();

create function icamp_private.validate_pool_staff_qualification() returns trigger
 language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if actor is null or actor<>new.decided_by_user_id or actor=new.staff_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'pool.supervision.manage') then
   raise exception 'Independent campground management must verify staff credentials'; end if;
 if not icamp_private.pool_swim_asset_ok(new.organization_id,new.campground_id,new.asset_id) then
  raise exception 'Pool credential is outside an active pool'; end if;
 if new.decision='verify' and new.expires_at<=statement_timestamp() then
  raise exception 'Verified credential must expire in the future'; end if;
 if not exists(select 1 from icamp_private.campground_assignments a where
  a.campground_id=new.campground_id and a.user_id=new.staff_user_id and a.assignment_state='active'
  and a.starts_at<=statement_timestamp() and (a.ends_at is null or a.ends_at>statement_timestamp())) then
  raise exception 'Credential requires a currently assigned campground staff member'; end if;
 return new;
end $$;
revoke all on function icamp_private.validate_pool_staff_qualification() from public;
create trigger pool_staff_qualification_validate before insert on public.pool_staff_qualifications
 for each row execute function icamp_private.validate_pool_staff_qualification();

create function icamp_private.validate_pool_swim_event() returns trigger
 language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
  pol public.pool_swim_policies%rowtype; facility_state text;
  last_kind text; last_actor uuid; request_actor uuid; guest uuid; ack_needed boolean;
begin
 if actor is null or actor<>new.actor_user_id then raise exception 'Actor mismatch'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pool-swim-event:'||new.asset_id::text,0));
 select * into pol from public.pool_swim_policies where id=new.policy_id
  and organization_id=new.organization_id and campground_id=new.campground_id and asset_id=new.asset_id;
 if not found or exists(select 1 from public.pool_swim_policies p
  where p.asset_id=new.asset_id and p.version_number>pol.version_number) then
  raise exception 'Use the current published pool policy'; end if;
 if exists(select 1 from public.campground_rule_versions v
  join public.campground_rule_versions newer on newer.rule_set_id=v.rule_set_id and newer.version_number>v.version_number
  where v.id=pol.rule_version_id) then
  raise exception 'The pool rules changed; publish an updated swim policy first'; end if;
 select a.operating_state into facility_state from public.operational_assets a
  where a.id=new.asset_id and a.organization_id=new.organization_id and a.campground_id=new.campground_id
  and a.lifecycle_state='active';
 select e.kind,e.actor_user_id into last_kind,last_actor from public.pool_swim_events e
  where e.asset_id=new.asset_id and e.kind in ('hold','release')
  order by e.occurred_at desc,e.id desc limit 1;
 if new.kind='release' then
  if not icamp_private.has_campground_permission(new.campground_id,'pool.supervision.manage') then
   raise exception 'Independent management release required'; end if;
  if facility_state<>'operational' then
   raise exception 'Pool must be canonically operational via inspected facility workflow before swim release'; end if;
  if last_kind is distinct from 'hold' then raise exception 'No active swim hold to release'; end if;
  select e.actor_user_id into request_actor from public.pool_swim_events e
  where e.asset_id=new.asset_id and e.kind='release_request'
   and e.occurred_at>(select max(h.occurred_at) from public.pool_swim_events h
    where h.asset_id=new.asset_id and h.kind='hold')
  order by e.occurred_at desc,e.id desc limit 1;
  if request_actor is null or request_actor=actor or last_actor=actor then
   raise exception 'Independent review of a lifeguard release request is required'; end if;
 else
  if not icamp_private.has_campground_permission(new.campground_id,'pool.supervision.attest')
   or not icamp_private.pool_swim_qualified(new.campground_id,new.asset_id,actor) then
   raise exception 'Currently verified and assigned lifeguard required'; end if;
  if new.kind='hold' and last_kind='hold' then raise exception 'Swim hold already active'; end if;
  if new.kind='release_request' and last_kind is distinct from 'hold' then
   raise exception 'No active hold for release request'; end if;
 end if;
 if new.kind in ('admission_check','warning','removal') then
  select r.guest_user_id into guest from public.reservations r
   where r.id=new.reservation_id and r.organization_id=new.organization_id and r.campground_id=new.campground_id
    and r.status in ('confirmed','checked_in');
  if guest is null then raise exception 'Active account-linked reservation required'; end if;
 end if;
 if new.kind='admission_check' and new.admitted then
  if facility_state<>'operational' or last_kind='hold' then
   raise exception 'Pool is closed or swim supervision hold is active'; end if;
  if not new.supervision_ages_verified or new.bather_count>pol.maximum_bathers or new.lifeguard_count<pol.minimum_lifeguards
   or new.underage_count>new.supervisor_count*pol.maximum_children_per_supervisor then
   raise exception 'Capacity, lifeguard staffing or minor-supervision limits exceeded'; end if;
  select v.acknowledgement_required into ack_needed from public.campground_rule_versions v
   where v.id=pol.rule_version_id;
  if ack_needed and not exists(select 1 from public.campground_rule_acknowledgements a
   where a.rule_version_id=pol.rule_version_id and a.reservation_id=new.reservation_id and a.guest_user_id=guest) then
   raise exception 'Current exact-version pool rule acknowledgement required'; end if;
 end if;
 return new;
end $$;
revoke all on function icamp_private.validate_pool_swim_event() from public;
create trigger pool_swim_event_validate before insert on public.pool_swim_events
 for each row execute function icamp_private.validate_pool_swim_event();

create function icamp_private.pool_swim_no_mutation() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin raise exception 'Pool supervision evidence is append-only'; end $$;
create trigger pool_swim_policies_immutable before update or delete on public.pool_swim_policies
 for each row execute function icamp_private.pool_swim_no_mutation();
create trigger pool_staff_qualifications_immutable before update or delete on public.pool_staff_qualifications
 for each row execute function icamp_private.pool_swim_no_mutation();
create trigger pool_swim_events_immutable before update or delete on public.pool_swim_events
 for each row execute function icamp_private.pool_swim_no_mutation();

alter table public.pool_swim_policies enable row level security;
alter table public.pool_swim_policies force row level security;
alter table public.pool_staff_qualifications enable row level security;
alter table public.pool_staff_qualifications force row level security;
alter table public.pool_swim_events enable row level security;
alter table public.pool_swim_events force row level security;
revoke all on public.pool_swim_policies,public.pool_staff_qualifications,public.pool_swim_events from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.pool_swim_policies,public.pool_staff_qualifications,public.pool_swim_events from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.pool_swim_policies,public.pool_staff_qualifications,public.pool_swim_events to icamp_app;
create policy pool_swim_policies_read on public.pool_swim_policies for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'pool.supervision.read')
 or icamp_private.has_campground_permission(campground_id,'pool.supervision.manage')
 or icamp_private.has_campground_permission(campground_id,'pool.supervision.attest'));
create policy pool_swim_policies_insert on public.pool_swim_policies for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'pool.supervision.manage')
 and published_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy pool_staff_qualifications_read on public.pool_staff_qualifications for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'pool.supervision.manage')
 or icamp_private.has_campground_permission(campground_id,'pool.supervision.attest'));
create policy pool_staff_qualifications_insert on public.pool_staff_qualifications for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'pool.supervision.manage')
 and decided_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy pool_swim_events_read on public.pool_swim_events for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'pool.supervision.read')
 or icamp_private.has_campground_permission(campground_id,'pool.supervision.manage')
 or icamp_private.has_campground_permission(campground_id,'pool.supervision.attest'));
create policy pool_swim_events_insert on public.pool_swim_events for insert to icamp_app
 with check(actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and (icamp_private.has_campground_permission(campground_id,'pool.supervision.attest')
 or icamp_private.has_campground_permission(campground_id,'pool.supervision.manage')));

comment on table public.pool_swim_events is
 'Build 084 app-only swimming oversight ledger; never asserts on-site safety, legal certification or physical pool access.';
