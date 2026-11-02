-- iCamp Build 085: swimming-zone, hazard, supervision and closure authority
-- for registered beach facilities. Explicitly NOT a lifeguard substitute,
-- water quality monitor, warning siren, dispatch system or physical gate.
insert into icamp_private.permission_catalog(permission_key,description,risk_level) values
 ('waterfront.swim.read','Read waterfront zone and incident history.','standard'),
 ('waterfront.swim.monitor','Record monitored waterfront checks, incidents and immediate swimming closures.','elevated'),
 ('waterfront.swim.manage','Publish waterfront rules, verify staff training and independently review reopening.','high')
on conflict(permission_key) do nothing;

insert into icamp_private.roles(role_code,display_name,description,role_kind)
values('waterfront_attendant','Waterfront safety attendant','Record waterfront incidents, observations and immediate holds; qualification requires management verification.','template')
on conflict do nothing;
insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r join (values
 ('owner_admin','waterfront.swim.read'),('owner_admin','waterfront.swim.manage'),
 ('owner_admin','waterfront.swim.monitor'),
 ('campground_manager','waterfront.swim.read'),('campground_manager','waterfront.swim.manage'),
 ('campground_manager','waterfront.swim.monitor'),
 ('waterfront_attendant','waterfront.swim.read'),('waterfront_attendant','waterfront.swim.monitor'),
 ('waterfront_attendant','asset.read'),('waterfront_attendant','campground.rules.read'),
 ('security','waterfront.swim.read')
) p(role_code,permission_key) on p.role_code=r.role_code and r.role_kind='template'
on conflict do nothing;

create table public.waterfront_swim_zone_versions (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 asset_id uuid not null,
 zone_code text not null check(zone_code ~ '^[A-Z][A-Z0-9_-]{2,31}$'),
 zone_name text not null check(char_length(trim(zone_name)) between 4 and 120),
 version_number integer not null check(version_number between 1 and 1000000),
 boundary_description text not null check(char_length(trim(boundary_description)) between 30 and 2000),
 operating_days integer[] not null check(cardinality(operating_days) between 1 and 7
  and operating_days <@ array[1,2,3,4,5,6,7]),
 opens_at time not null,
 closes_at time not null check(closes_at>opens_at),
 maximum_swimmers integer not null check(maximum_swimmers between 1 and 10000),
 minimum_unaccompanied_age integer not null check(minimum_unaccompanied_age between 0 and 25),
 minimum_supervisor_age integer not null check(minimum_supervisor_age between 13 and 99),
 maximum_children_per_supervisor integer not null check(maximum_children_per_supervisor between 1 and 50),
 rule_version_id uuid not null references public.campground_rule_versions(id),
 hazard_instructions text not null check(char_length(trim(hazard_instructions)) between 30 and 2000),
 published_by_user_id uuid not null references icamp_private.user_accounts(id),
 published_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 unique(asset_id,zone_code,version_number),
 foreign key(organization_id,campground_id,asset_id)
  references public.operational_assets(organization_id,campground_id,id)
);
create index waterfront_zones_scope_idx on public.waterfront_swim_zone_versions(campground_id,asset_id,zone_code,version_number desc);
create index waterfront_zones_actor_idx on public.waterfront_swim_zone_versions(published_by_user_id);
create index waterfront_zones_rule_idx on public.waterfront_swim_zone_versions(rule_version_id);
create index waterfront_zones_scope_asset_fk_idx on public.waterfront_swim_zone_versions(organization_id,campground_id,asset_id);

-- Training verification/revocation is append-only and independent of role.
create table public.waterfront_staff_training_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 asset_id uuid not null,
 staff_user_id uuid not null references icamp_private.user_accounts(id),
 decision text not null check(decision in ('verify','revoke')),
 training_reference text not null check(char_length(trim(training_reference)) between 8 and 400),
 expires_at timestamptz,
 note text not null check(char_length(trim(note)) between 12 and 2000),
 decided_by_user_id uuid not null references icamp_private.user_accounts(id),
 decided_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id,asset_id)
  references public.operational_assets(organization_id,campground_id,id),
 check((decision='verify' and expires_at is not null) or (decision='revoke' and expires_at is null))
);
create index waterfront_training_latest_idx on public.waterfront_staff_training_events(campground_id,asset_id,staff_user_id,decided_at desc,id desc);
create index waterfront_training_staff_idx on public.waterfront_staff_training_events(staff_user_id);
create index waterfront_training_reviewer_idx on public.waterfront_staff_training_events(decided_by_user_id);
create index waterfront_training_scope_asset_fk_idx on public.waterfront_staff_training_events(organization_id,campground_id,asset_id);

create table public.waterfront_swim_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 asset_id uuid not null,
 zone_code text not null,
 zone_version_id uuid not null,
 kind text not null check(kind in ('entry_check','warning','removal','incident','closure','reopen_request','reopen')),
 reservation_id uuid,
 swimmer_count integer check(swimmer_count between 0 and 10000),
 underage_count integer check(underage_count between 0 and 10000),
 supervisor_count integer check(supervisor_count between 0 and 10000),
 admitted boolean,
 ages_verified boolean,
 hazard_type text check(hazard_type in ('weather','water_quality','current','wildlife','infrastructure','staffing','other')),
 hazard_level text check(hazard_level in ('normal','caution','unsafe')),
 evidence_reference text check(evidence_reference is null or char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 2000),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 occurred_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id,asset_id)
  references public.operational_assets(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,zone_version_id)
  references public.waterfront_swim_zone_versions(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,reservation_id)
  references public.reservations(organization_id,campground_id,id),
 check((kind='entry_check' and reservation_id is not null and admitted is not null
   and ages_verified is not null and hazard_level is not null
   and swimmer_count is not null and underage_count is not null and supervisor_count is not null)
  or (kind in ('warning','removal') and reservation_id is not null and admitted is null)
  or (kind in ('incident','closure') and hazard_type is not null and admitted is null)
  or (kind in ('reopen_request','reopen') and reservation_id is null and admitted is null)),
 check(underage_count is null or (swimmer_count is not null and underage_count<=swimmer_count)),
 check(kind<>'reopen' or evidence_reference is not null)
);
create index waterfront_events_zone_latest_idx on public.waterfront_swim_events(campground_id,asset_id,zone_code,occurred_at desc,id desc);
create index waterfront_events_actor_idx on public.waterfront_swim_events(actor_user_id);
create index waterfront_events_reservation_idx on public.waterfront_swim_events(reservation_id) where reservation_id is not null;
create index waterfront_events_scope_zone_fk_idx on public.waterfront_swim_events(organization_id,campground_id,zone_version_id);
create index waterfront_events_scope_asset_fk_idx on public.waterfront_swim_events(organization_id,campground_id,asset_id);
create index waterfront_events_scope_reservation_fk_idx on public.waterfront_swim_events(organization_id,campground_id,reservation_id) where reservation_id is not null;

create function icamp_private.waterfront_is_beach(org uuid,camp uuid,asset uuid) returns boolean
 language sql security definer stable set search_path='' as $$
 select exists(select 1 from public.operational_assets a
  join public.operational_facilities f on f.asset_id=a.id and f.organization_id=a.organization_id and f.campground_id=a.campground_id
  where a.organization_id=org and a.campground_id=camp and a.id=asset and a.asset_class='facility'
   and a.lifecycle_state='active' and f.facility_type='beach');
 $$;
revoke all on function icamp_private.waterfront_is_beach(uuid,uuid,uuid) from public;

create function icamp_private.waterfront_staff_verified(camp uuid,asset uuid,staff uuid) returns boolean
 language sql security definer stable set search_path='' as $$
 select exists(select 1 from (
  select t.decision,t.expires_at from public.waterfront_staff_training_events t
  where t.campground_id=camp and t.asset_id=asset and t.staff_user_id=staff
  order by t.decided_at desc,t.id desc limit 1
 ) latest where latest.decision='verify' and latest.expires_at>statement_timestamp());
 $$;
revoke all on function icamp_private.waterfront_staff_verified(uuid,uuid,uuid) from public;

create function icamp_private.validate_waterfront_swim_zone() returns trigger
 language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 previous integer; current_rule uuid;
begin
 if actor is null or actor<>new.published_by_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'waterfront.swim.manage') then
  raise exception 'Waterfront zone publication requires campground management'; end if;
 if not icamp_private.waterfront_is_beach(new.organization_id,new.campground_id,new.asset_id) then
  raise exception 'Select an active registered beach facility'; end if;
 perform pg_advisory_xact_lock(hashtextextended('waterfront-zone:'||new.asset_id::text||':'||new.zone_code,0));
 select coalesce(max(version_number),0) into previous from public.waterfront_swim_zone_versions
  where asset_id=new.asset_id and zone_code=new.zone_code;
 if new.version_number<>previous+1 then raise exception 'Waterfront zone requires next immutable version'; end if;
 select v.id into current_rule from public.campground_rule_versions v
 join public.campground_rule_sets s on s.id=v.rule_set_id
 where v.id=new.rule_version_id and v.organization_id=new.organization_id and v.campground_id=new.campground_id
  and s.rule_category='waterfront' and (s.facility_id is null or s.facility_id=new.asset_id)
  and not exists(select 1 from public.campground_rule_versions newer where newer.rule_set_id=v.rule_set_id
   and newer.version_number>v.version_number);
 if current_rule is null then raise exception 'Select the current published waterfront guest rule'; end if;
 return new;
end $$;
revoke all on function icamp_private.validate_waterfront_swim_zone() from public;
create trigger waterfront_zone_validate before insert on public.waterfront_swim_zone_versions
 for each row execute function icamp_private.validate_waterfront_swim_zone();

create function icamp_private.validate_waterfront_training() returns trigger
 language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if actor is null or actor<>new.decided_by_user_id or actor=new.staff_user_id
  or not icamp_private.has_campground_permission(new.campground_id,'waterfront.swim.manage') then
  raise exception 'Training requires independent campground management verification'; end if;
 if not icamp_private.waterfront_is_beach(new.organization_id,new.campground_id,new.asset_id) then
  raise exception 'Waterfront training must reference this campground beach'; end if;
 if new.decision='verify' and new.expires_at<=statement_timestamp() then
  raise exception 'Verified training must expire in the future'; end if;
 if not exists(select 1 from icamp_private.campground_assignments a where
   a.campground_id=new.campground_id and a.user_id=new.staff_user_id and a.assignment_state='active'
   and a.starts_at<=statement_timestamp() and (a.ends_at is null or a.ends_at>statement_timestamp())) then
  raise exception 'Waterfront monitoring requires currently assigned staff'; end if;
 return new;
end $$;
revoke all on function icamp_private.validate_waterfront_training() from public;
create trigger waterfront_training_validate before insert on public.waterfront_staff_training_events
 for each row execute function icamp_private.validate_waterfront_training();

create function icamp_private.validate_waterfront_event() returns trigger
 language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 zone_policy public.waterfront_swim_zone_versions%rowtype; canonical text; zone_timezone text;
 latest_state text; latest_actor uuid; request_actor uuid; closed_at timestamptz;
 guest uuid; acknowledgement_needed boolean; local_now timestamp;
begin
 if actor is null or actor<>new.actor_user_id then raise exception 'Waterfront event actor mismatch'; end if;
 perform pg_advisory_xact_lock(hashtextextended('waterfront-event:'||new.asset_id::text||':'||new.zone_code,0));
 select * into zone_policy from public.waterfront_swim_zone_versions v
 where v.id=new.zone_version_id and v.organization_id=new.organization_id
  and v.campground_id=new.campground_id and v.asset_id=new.asset_id and v.zone_code=new.zone_code;
 if not found or exists(select 1 from public.waterfront_swim_zone_versions newer
  where newer.asset_id=new.asset_id and newer.zone_code=new.zone_code and newer.version_number>zone_policy.version_number) then
  raise exception 'Use the latest swimming-zone policy version'; end if;
 -- A newly published guest rule must never prevent recording an emergency hazard or closure.
 if (new.kind='reopen' or (new.kind='entry_check' and new.admitted))
 and exists(select 1 from public.campground_rule_versions v
  join public.campground_rule_versions newer on newer.rule_set_id=v.rule_set_id and newer.version_number>v.version_number
  where v.id=zone_policy.rule_version_id) then
  raise exception 'Waterfront rules have changed; publish a new zone policy'; end if;
 select a.operating_state,c.timezone into canonical,zone_timezone from public.operational_assets a
  join public.campgrounds c on c.id=a.campground_id and c.organization_id=a.organization_id
  where a.id=new.asset_id and a.campground_id=new.campground_id and a.organization_id=new.organization_id
   and a.lifecycle_state='active';
 select e.kind,e.actor_user_id,e.occurred_at into latest_state,latest_actor,closed_at
  from public.waterfront_swim_events e where e.asset_id=new.asset_id and e.zone_code=new.zone_code
   and e.kind in ('closure','reopen') order by e.occurred_at desc,e.id desc limit 1;
 if new.kind='reopen' then
  if not icamp_private.has_campground_permission(new.campground_id,'waterfront.swim.manage') then
   raise exception 'Independent management reopening required'; end if;
  if canonical<>'operational' then raise exception 'Beach must be canonically operational before swimming reopening'; end if;
  if latest_state is distinct from 'closure' then raise exception 'No active swimming closure for reopening'; end if;
  select e.actor_user_id into request_actor from public.waterfront_swim_events e
   where e.asset_id=new.asset_id and e.zone_code=new.zone_code and e.kind='reopen_request' and e.occurred_at>closed_at
   order by e.occurred_at desc,e.id desc limit 1;
  if request_actor is null or request_actor=actor or latest_actor=actor then
   raise exception 'Independent management must review another staff member request'; end if;
 else
  if not icamp_private.has_campground_permission(new.campground_id,'waterfront.swim.monitor') then
   raise exception 'Authorized waterfront monitor required'; end if;
  if new.kind in ('entry_check','warning','removal','reopen_request')
   and not icamp_private.waterfront_staff_verified(new.campground_id,new.asset_id,actor) then
   raise exception 'Verified, unexpired waterfront monitoring training required'; end if;
  if new.kind='closure' and latest_state='closure' then
   raise exception 'Swimming zone is already closed'; end if;
  if new.kind='reopen_request' and latest_state is distinct from 'closure' then
   raise exception 'Reopening request requires an active closure'; end if;
 end if;
 if new.kind in ('entry_check','warning','removal') then
  select r.guest_user_id into guest from public.reservations r
   where r.id=new.reservation_id and r.organization_id=new.organization_id and r.campground_id=new.campground_id
    and r.status in ('confirmed','checked_in');
  if guest is null then raise exception 'Account-linked active stay required'; end if;
 end if;
 if new.kind='entry_check' and new.admitted then
  if canonical<>'operational' or latest_state='closure' or not new.ages_verified or new.hazard_level<>'normal' then
   raise exception 'Beach unavailable, hazard present or age verification missing'; end if;
  local_now:=statement_timestamp() at time zone zone_timezone;
  if not (extract(isodow from local_now)::integer=any(zone_policy.operating_days)) then
   raise exception 'Swim zone is closed for this local operating day'; end if;
  if local_now::time<zone_policy.opens_at or local_now::time>=zone_policy.closes_at then
   raise exception 'Swim zone is outside approved local operating hours'; end if;
  if new.swimmer_count>zone_policy.maximum_swimmers
    or new.underage_count>new.supervisor_count*zone_policy.maximum_children_per_supervisor then
   raise exception 'Swimming capacity or child supervision ratio exceeded'; end if;
  select v.acknowledgement_required into acknowledgement_needed from public.campground_rule_versions v
   where v.id=zone_policy.rule_version_id;
  if acknowledgement_needed and not exists(select 1 from public.campground_rule_acknowledgements ack
   where ack.rule_version_id=zone_policy.rule_version_id and ack.reservation_id=new.reservation_id
    and ack.guest_user_id=guest) then
   raise exception 'Guest must acknowledge the current waterfront rule version'; end if;
 end if;
 return new;
end $$;
revoke all on function icamp_private.validate_waterfront_event() from public;
create trigger waterfront_event_validate before insert on public.waterfront_swim_events
 for each row execute function icamp_private.validate_waterfront_event();

create function icamp_private.prevent_waterfront_mutation() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin raise exception 'Waterfront safety evidence is append-only'; end $$;
create trigger waterfront_zones_immutable before update or delete on public.waterfront_swim_zone_versions
 for each row execute function icamp_private.prevent_waterfront_mutation();
create trigger waterfront_training_immutable before update or delete on public.waterfront_staff_training_events
 for each row execute function icamp_private.prevent_waterfront_mutation();
create trigger waterfront_events_immutable before update or delete on public.waterfront_swim_events
 for each row execute function icamp_private.prevent_waterfront_mutation();

alter table public.waterfront_swim_zone_versions enable row level security;
alter table public.waterfront_swim_zone_versions force row level security;
alter table public.waterfront_staff_training_events enable row level security;
alter table public.waterfront_staff_training_events force row level security;
alter table public.waterfront_swim_events enable row level security;
alter table public.waterfront_swim_events force row level security;
revoke all on public.waterfront_swim_zone_versions,public.waterfront_staff_training_events,public.waterfront_swim_events from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.waterfront_swim_zone_versions,public.waterfront_staff_training_events,public.waterfront_swim_events from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.waterfront_swim_zone_versions,public.waterfront_staff_training_events,public.waterfront_swim_events to icamp_app;
create policy waterfront_zones_read on public.waterfront_swim_zone_versions for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'waterfront.swim.read')
 or icamp_private.has_campground_permission(campground_id,'waterfront.swim.monitor')
 or icamp_private.has_campground_permission(campground_id,'waterfront.swim.manage'));
create policy waterfront_zones_insert on public.waterfront_swim_zone_versions for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'waterfront.swim.manage')
  and published_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy waterfront_training_read on public.waterfront_staff_training_events for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'waterfront.swim.manage')
  or (staff_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
   and icamp_private.has_campground_permission(campground_id,'waterfront.swim.monitor')));
create policy waterfront_training_insert on public.waterfront_staff_training_events for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'waterfront.swim.manage')
  and decided_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy waterfront_events_read on public.waterfront_swim_events for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'waterfront.swim.read')
  or icamp_private.has_campground_permission(campground_id,'waterfront.swim.monitor')
  or icamp_private.has_campground_permission(campground_id,'waterfront.swim.manage'));
create policy waterfront_events_insert on public.waterfront_swim_events for insert to icamp_app
 with check(actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and (icamp_private.has_campground_permission(campground_id,'waterfront.swim.monitor')
   or icamp_private.has_campground_permission(campground_id,'waterfront.swim.manage')));

comment on table public.waterfront_swim_events is
 'Build 085 manual waterfront observations and closures; not a water-quality sensor, dispatch tool, life-safety certification or physical-access control.';
