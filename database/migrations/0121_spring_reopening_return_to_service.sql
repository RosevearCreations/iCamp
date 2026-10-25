-- Build 089: evidence-backed, independently reviewed spring return-to-service.
-- Approval gates canonical winter-closed assignment reopening; it never acts on utilities.

insert into icamp_private.permission_catalog(permission_key,description,risk_level) values
 ('spring.reopen.read','View campground spring inspection and return-to-service evidence.','elevated'),
 ('spring.reopen.record','Record on-site spring inspections and corrective evidence.','elevated'),
 ('spring.reopen.policy.manage','Publish immutable campground reopening inspection templates.','elevated'),
 ('spring.reopen.approve','Independently approve return-to-service readiness.','elevated')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r join (values
 ('owner_admin','spring.reopen.read'),('owner_admin','spring.reopen.record'),
 ('owner_admin','spring.reopen.policy.manage'),('owner_admin','spring.reopen.approve'),
 ('campground_manager','spring.reopen.read'),('campground_manager','spring.reopen.record'),
 ('campground_manager','spring.reopen.policy.manage'),('campground_manager','spring.reopen.approve'),
 ('maintenance','spring.reopen.read'),('maintenance','spring.reopen.record'),
 ('maintenance_foreman','spring.reopen.read'),('maintenance_foreman','spring.reopen.record'),
 ('maintenance_lead','spring.reopen.read'),('maintenance_lead','spring.reopen.record'),
 ('maintenance_lead','spring.reopen.approve'),
 ('maintenance_main_foreman','spring.reopen.read'),('maintenance_main_foreman','spring.reopen.record'),
 ('maintenance_main_foreman','spring.reopen.policy.manage'),('maintenance_main_foreman','spring.reopen.approve')
) p(role_code,permission_key) on r.role_code=p.role_code and r.role_kind='template'
on conflict do nothing;

create table public.spring_reopening_templates (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 version_number integer not null check(version_number between 1 and 10000),
 name text not null check(char_length(trim(name)) between 5 and 160),
 instructions text not null check(char_length(trim(instructions)) between 12 and 2000),
 steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 6 and 20),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 unique(organization_id,campground_id,version_number),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id)
);
create index spring_reopening_templates_scope_idx on public.spring_reopening_templates(campground_id,version_number desc);
create index spring_reopening_templates_campground_fk_idx on public.spring_reopening_templates(organization_id,campground_id);
create index spring_reopening_templates_actor_fk_idx on public.spring_reopening_templates(created_by_user_id);

create table public.spring_reopening_inspections (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 accommodation_id uuid not null,
 assignment_id uuid,
 winter_close_event_id uuid references public.seasonal_assignment_events(id),
 template_id uuid not null,
 winter_year integer not null check(winter_year between 2020 and 2120),
 water_service text not null check(water_service in ('restored_verified','not_provided_verified')),
 operating_limits text not null check(char_length(trim(operating_limits)) between 12 and 1200),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 started_at timestamptz not null default clock_timestamp(),
 check((assignment_id is null)=(winter_close_event_id is null)),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,accommodation_id)
  references public.accommodations(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,assignment_id)
  references public.seasonal_assignments(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,template_id)
  references public.spring_reopening_templates(organization_id,campground_id,id)
);
create unique index spring_reopening_one_closure_idx on public.spring_reopening_inspections(assignment_id,winter_close_event_id)
 where assignment_id is not null;
create unique index spring_reopening_standalone_year_idx on public.spring_reopening_inspections(campground_id,accommodation_id,winter_year)
 where assignment_id is null;
create index spring_reopening_inspections_scope_idx on public.spring_reopening_inspections(campground_id,winter_year desc,started_at desc);
create index spring_reopening_inspections_accommodation_fk_idx on public.spring_reopening_inspections(organization_id,campground_id,accommodation_id);
create index spring_reopening_inspections_assignment_fk_idx on public.spring_reopening_inspections(organization_id,campground_id,assignment_id) where assignment_id is not null;
create index spring_reopening_inspections_template_fk_idx on public.spring_reopening_inspections(organization_id,campground_id,template_id);
create index spring_reopening_inspections_closure_fk_idx on public.spring_reopening_inspections(winter_close_event_id);
create index spring_reopening_inspections_actor_fk_idx on public.spring_reopening_inspections(created_by_user_id);

create table public.spring_reopening_observations (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 inspection_id uuid not null,
 step_key text not null check(step_key ~ '^[a-z][a-z0-9-]{1,79}$'),
 result text not null check(result in ('pass','defect','not_applicable')),
 evidence_reference text check(evidence_reference is null or char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 2000),
 corrective_work_order_id uuid,
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 observed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,inspection_id)
  references public.spring_reopening_inspections(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,corrective_work_order_id)
  references public.maintenance_work_orders(organization_id,campground_id,id),
 check(result<>'pass' or evidence_reference is not null)
);
create index spring_reopening_observations_scope_idx on public.spring_reopening_observations(campground_id,observed_at desc);
create index spring_reopening_observations_inspection_fk_idx on public.spring_reopening_observations(organization_id,campground_id,inspection_id);
create index spring_reopening_observations_history_idx on public.spring_reopening_observations(inspection_id,step_key,observed_at desc,id desc);
create index spring_reopening_observations_order_fk_idx on public.spring_reopening_observations(organization_id,campground_id,corrective_work_order_id)
 where corrective_work_order_id is not null;
create index spring_reopening_observations_actor_fk_idx on public.spring_reopening_observations(actor_user_id);

create table public.spring_reopening_decisions (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 inspection_id uuid not null,
 decision text not null check(decision in ('approved','rejected')),
 note text not null check(char_length(trim(note)) between 12 and 2000),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 decided_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,inspection_id)
  references public.spring_reopening_inspections(organization_id,campground_id,id)
);
create unique index spring_reopening_one_approval_idx on public.spring_reopening_decisions(inspection_id) where decision='approved';
create index spring_reopening_decisions_scope_idx on public.spring_reopening_decisions(campground_id,decided_at desc);
create index spring_reopening_decisions_inspection_fk_idx on public.spring_reopening_decisions(organization_id,campground_id,inspection_id);
create index spring_reopening_decisions_actor_fk_idx on public.spring_reopening_decisions(actor_user_id);

create function icamp_private.spring_reopening_template_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; seen text[]:=array[]::text[]; k text;
begin
 if new.created_by_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'spring.reopen.policy.manage') then
  raise exception 'Authorized spring inspection policy publisher required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('spring-template:'||new.campground_id::text,0));
 if new.version_number is distinct from coalesce((select max(t.version_number)+1 from public.spring_reopening_templates t
  where t.campground_id=new.campground_id),1) then raise exception 'Spring policy version must advance'; end if;
 for item in select value from jsonb_array_elements(new.steps) as e(value) loop
  k:=item->>'key';
  if jsonb_typeof(item)<>'object' or k is null or k !~ '^[a-z][a-z0-9-]{1,79}$'
   or k=any(seen) or jsonb_typeof(item->'required')<>'boolean'
   or char_length(trim(coalesce(item->>'label',''))) not between 5 and 240 then
   raise exception 'Spring checklist needs unique labeled required/optional steps'; end if;
  seen:=array_append(seen,k);
 end loop;
 if not ('water-restoration'=any(seen) and 'electrical-heat'=any(seen)
  and 'sanitation-drainage'=any(seen) and 'fire-emergency'=any(seen)
  and 'grounds-access'=any(seen) and 'site-condition'=any(seen)) or
  exists(select 1 from jsonb_array_elements(new.steps) e where e->>'key' in
   ('water-restoration','electrical-heat','sanitation-drainage','fire-emergency','grounds-access','site-condition')
   and (e->>'required')::boolean is distinct from true) then
  raise exception 'All six return-to-service safety domains must remain required'; end if;
 return new;
end $$;
create trigger spring_reopening_template_validate before insert on public.spring_reopening_templates
 for each row execute function icamp_private.spring_reopening_template_validate();

create function icamp_private.spring_reopening_inspection_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare latest public.seasonal_assignment_events%rowtype; year_of_closure integer;
begin
 if new.created_by_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'spring.reopen.record') then
  raise exception 'Authorized spring inspection recorder required'; end if;
 if not exists(select 1 from public.accommodations a where a.id=new.accommodation_id
  and a.campground_id=new.campground_id and a.organization_id=new.organization_id
  and a.lifecycle_state='active') then
  raise exception 'Spring inspection must target an active accommodation'; end if;
 if new.winter_year not between extract(year from current_date)::integer-2 and extract(year from current_date)::integer+1 then
  raise exception 'Spring inspection year is outside the operating window'; end if;
 if new.assignment_id is not null then
  if not exists(select 1 from public.seasonal_assignments s where s.id=new.assignment_id
   and s.organization_id=new.organization_id and s.campground_id=new.campground_id
   and s.accommodation_id=new.accommodation_id and s.assignment_state='active'
   and s.occupancy_state='winter_closed') then
   raise exception 'Linked long-term assignment must currently be winter closed at this site'; end if;
  select * into latest from public.seasonal_assignment_events e
   where e.assignment_id=new.assignment_id and e.campground_id=new.campground_id
    and e.organization_id=new.organization_id and e.event_kind='winter_closed'
   order by e.created_at desc,e.id desc limit 1;
  if not found then raise exception 'Canonical winter-close event is required'; end if;
  year_of_closure:=extract(year from latest.effective_on)::integer;
  if extract(month from latest.effective_on)::integer<=4 then year_of_closure:=year_of_closure-1; end if;
  if new.winter_year<>year_of_closure then
   raise exception 'Inspection must use the latest winter-close event season'; end if;
  new.winter_close_event_id:=latest.id;
 else
  if new.winter_close_event_id is not null then raise exception 'Standalone site cannot impersonate an assignment closure'; end if;
  if exists(select 1 from public.seasonal_assignments s where s.accommodation_id=new.accommodation_id
   and s.campground_id=new.campground_id and s.assignment_state='active'
   and s.occupancy_state='winter_closed') then
   raise exception 'Winter-closed long-term sites require a closure-linked spring inspection'; end if;
 end if;
 return new;
end $$;
create trigger spring_reopening_inspection_validate before insert on public.spring_reopening_inspections
 for each row execute function icamp_private.spring_reopening_inspection_validate();

create function icamp_private.spring_reopening_observation_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare inspection public.spring_reopening_inspections%rowtype; mandatory boolean;
begin
 if new.actor_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'spring.reopen.record') then
  raise exception 'Authorized spring inspection observer required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('spring-inspection:'||new.inspection_id::text,0));
 select * into inspection from public.spring_reopening_inspections
  where id=new.inspection_id and campground_id=new.campground_id;
 if not found then raise exception 'Spring inspection scope mismatch'; end if;
 if exists(select 1 from public.spring_reopening_decisions d where d.inspection_id=inspection.id and d.decision='approved') then
  raise exception 'Approved spring inspection cannot receive further observations'; end if;
 select (e->>'required')::boolean into mandatory from public.spring_reopening_templates t,
  lateral jsonb_array_elements(t.steps) e where t.id=inspection.template_id and e->>'key'=new.step_key;
 if mandatory is null then raise exception 'Step is not in the selected checklist version'; end if;
 if mandatory and new.result='not_applicable' then raise exception 'Required return-to-service safety cannot be skipped'; end if;
 if new.result='defect' then
  if new.corrective_work_order_id is null or not exists(select 1 from public.maintenance_work_orders w
   where w.id=new.corrective_work_order_id and w.organization_id=new.organization_id
    and w.campground_id=new.campground_id and w.status in ('open','assigned','in_progress','blocked')
    and (w.accommodation_id is null or w.accommodation_id=inspection.accommodation_id)) then
   raise exception 'Spring defect requires an active matching corrective work order'; end if;
 elsif new.corrective_work_order_id is not null then
  raise exception 'Only spring defects can link corrective work';
 end if;
 return new;
end $$;
create trigger spring_reopening_observation_validate before insert on public.spring_reopening_observations
 for each row execute function icamp_private.spring_reopening_observation_validate();

create function icamp_private.spring_reopening_decision_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare inspection public.spring_reopening_inspections%rowtype; missing_count integer;
declare latest_closure uuid; active_year integer:=extract(year from current_date)::integer;
begin
 if new.actor_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'spring.reopen.approve') then
  raise exception 'Authorized independent spring reviewer required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('spring-inspection:'||new.inspection_id::text,0));
 select * into inspection from public.spring_reopening_inspections
  where id=new.inspection_id and campground_id=new.campground_id;
 if not found then raise exception 'Spring inspection scope mismatch'; end if;
 if exists(select 1 from public.spring_reopening_decisions d where d.inspection_id=inspection.id and d.decision='approved') then
  raise exception 'Spring inspection already approved'; end if;
 if new.decision='approved' then
  if extract(month from current_date)::integer<9 then active_year:=active_year-1; end if;
  if inspection.winter_year<>active_year then
   raise exception 'Spring return-to-service approval must cover the current winter cycle'; end if;
  if new.actor_user_id=inspection.created_by_user_id or exists(
   select 1 from public.spring_reopening_observations o where o.inspection_id=inspection.id
    and o.actor_user_id=new.actor_user_id) then
   raise exception 'Spring reviewer must be independent of inspection recorders'; end if;
  if not exists(select 1 from public.campgrounds c where c.id=new.campground_id and c.lifecycle_state='active') then
   raise exception 'Inactive Camp Rosevear/test campground cannot claim physical spring safety approval'; end if;
  if not exists(select 1 from public.accommodations a where a.id=inspection.accommodation_id
   and a.campground_id=inspection.campground_id and a.lifecycle_state='active') then
   raise exception 'Return-to-service approval requires an active accommodation'; end if;
  if inspection.assignment_id is not null then
   if not exists(select 1 from public.seasonal_assignments s where s.id=inspection.assignment_id
    and s.campground_id=inspection.campground_id and s.accommodation_id=inspection.accommodation_id
    and s.assignment_state='active' and s.occupancy_state='winter_closed') then
    raise exception 'Linked assignment must still be winter closed'; end if;
   select e.id into latest_closure from public.seasonal_assignment_events e
    where e.assignment_id=inspection.assignment_id and e.campground_id=inspection.campground_id
    and e.event_kind='winter_closed' order by e.created_at desc,e.id desc limit 1;
   if latest_closure is distinct from inspection.winter_close_event_id then
    raise exception 'Inspection is stale after a newer winter closure'; end if;
  elsif exists(select 1 from public.seasonal_assignments s where s.accommodation_id=inspection.accommodation_id
   and s.assignment_state='active' and s.occupancy_state='winter_closed') then
   raise exception 'Standalone inspection cannot approve a winter-closed assignment'; end if;
  select count(*) into missing_count from public.spring_reopening_templates t,
   lateral jsonb_array_elements(t.steps) item
   left join lateral (select o.result from public.spring_reopening_observations o
    where o.inspection_id=inspection.id and o.step_key=item->>'key'
    order by o.observed_at desc,o.id desc limit 1) latest on true
   where t.id=inspection.template_id and (latest.result is null or latest.result='defect'
    or ((item->>'required')::boolean and latest.result<>'pass'));
  if missing_count>0 then raise exception 'All spring safety steps need acceptable latest observations'; end if;
  if exists(select 1 from public.spring_reopening_observations o
   join public.maintenance_work_orders w on w.id=o.corrective_work_order_id
   where o.inspection_id=inspection.id and o.result='defect' and w.status<>'completed') then
   raise exception 'Corrective spring safety work orders must be completed before approval'; end if;
 end if;
 return new;
end $$;
create trigger spring_reopening_decision_validate before insert on public.spring_reopening_decisions
 for each row execute function icamp_private.spring_reopening_decision_validate();

-- An old approval cannot be reused for a second winter-close event.
create function icamp_private.require_spring_reopening_before_assignment_return() returns trigger
language plpgsql security definer set search_path='' as $$
declare latest_closure uuid;
begin
 if old.occupancy_state='winter_closed' and new.occupancy_state<>'winter_closed'
  and new.assignment_state='active' then
  select e.id into latest_closure from public.seasonal_assignment_events e
   where e.organization_id=new.organization_id and e.campground_id=new.campground_id
    and e.assignment_id=new.id and e.event_kind='winter_closed'
   order by e.created_at desc,e.id desc limit 1;
  if latest_closure is null or not exists(
   select 1 from public.spring_reopening_inspections i
   join public.spring_reopening_decisions d on d.inspection_id=i.id and d.decision='approved'
   where i.assignment_id=new.id and i.winter_close_event_id=latest_closure
    and i.accommodation_id=new.accommodation_id and i.organization_id=new.organization_id
    and i.campground_id=new.campground_id
  ) then raise exception 'Independent spring return-to-service approval required before reopening'; end if;
  if not exists(select 1 from public.campgrounds c where c.id=new.campground_id and c.lifecycle_state='active')
   or not exists(select 1 from public.accommodations a where a.id=new.accommodation_id
    and a.campground_id=new.campground_id and a.lifecycle_state='active') then
   raise exception 'Cannot reopen a site at an inactive campground or accommodation'; end if;
 end if;
 return new;
end $$;
create trigger seasonal_assignments_require_spring_reopening
 before update on public.seasonal_assignments
 for each row execute function icamp_private.require_spring_reopening_before_assignment_return();

create trigger spring_reopening_templates_immutable before update or delete on public.spring_reopening_templates
 for each row execute function icamp_private.winterization_append_only();
create trigger spring_reopening_inspections_immutable before update or delete on public.spring_reopening_inspections
 for each row execute function icamp_private.winterization_append_only();
create trigger spring_reopening_observations_immutable before update or delete on public.spring_reopening_observations
 for each row execute function icamp_private.winterization_append_only();
create trigger spring_reopening_decisions_immutable before update or delete on public.spring_reopening_decisions
 for each row execute function icamp_private.winterization_append_only();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['spring_reopening_templates','spring_reopening_inspections',
  'spring_reopening_observations','spring_reopening_decisions'] loop
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

create policy accommodations_spring_reopening_read on public.accommodations for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'spring.reopen.read'));
create policy seasonal_assignments_spring_reopening_read on public.seasonal_assignments for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'spring.reopen.read'));
create policy seasonal_events_spring_reopening_read on public.seasonal_assignment_events for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'spring.reopen.read'));
create policy work_orders_spring_reopening_read on public.maintenance_work_orders for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'spring.reopen.read'));

create policy spring_reopening_templates_read on public.spring_reopening_templates for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'spring.reopen.read'));
create policy spring_reopening_templates_insert on public.spring_reopening_templates for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'spring.reopen.policy.manage')
 and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy spring_reopening_inspections_read on public.spring_reopening_inspections for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'spring.reopen.read'));
create policy spring_reopening_inspections_insert on public.spring_reopening_inspections for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'spring.reopen.record')
 and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy spring_reopening_observations_read on public.spring_reopening_observations for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'spring.reopen.read'));
create policy spring_reopening_observations_insert on public.spring_reopening_observations for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'spring.reopen.record')
 and actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy spring_reopening_decisions_read on public.spring_reopening_decisions for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'spring.reopen.read'));
create policy spring_reopening_decisions_insert on public.spring_reopening_decisions for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'spring.reopen.approve')
 and actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);

revoke all on function icamp_private.spring_reopening_template_validate() from public;
revoke all on function icamp_private.spring_reopening_inspection_validate() from public;
revoke all on function icamp_private.spring_reopening_observation_validate() from public;
revoke all on function icamp_private.spring_reopening_decision_validate() from public;
revoke all on function icamp_private.require_spring_reopening_before_assignment_return() from public;

comment on table public.spring_reopening_decisions is
 'Human-attested spring return-to-service approval only; no automatic bookings, utility/gate operation or regulatory certification.';
