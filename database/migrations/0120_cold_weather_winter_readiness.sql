-- Build 088: explicitly reviewed winter-open readiness; never a shutdown substitute.
insert into icamp_private.permission_catalog(permission_key,description,risk_level) values
 ('winter.readiness.read','View campground cold-weather site assessment evidence.','elevated'),
 ('winter.readiness.record','Record observations and corrective cold-weather readiness evidence.','elevated'),
 ('winter.readiness.policy.manage','Publish immutable campground cold-weather checklists.','elevated'),
 ('winter.readiness.approve','Independently decide documented cold-weather readiness.','elevated')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,grant_row.permission_key from icamp_private.roles r join (values
 ('owner_admin','winter.readiness.read'),('owner_admin','winter.readiness.record'),
 ('owner_admin','winter.readiness.policy.manage'),('owner_admin','winter.readiness.approve'),
 ('campground_manager','winter.readiness.read'),('campground_manager','winter.readiness.record'),
 ('campground_manager','winter.readiness.policy.manage'),('campground_manager','winter.readiness.approve'),
 ('maintenance','winter.readiness.read'),('maintenance','winter.readiness.record'),
 ('maintenance_lead','winter.readiness.read'),('maintenance_lead','winter.readiness.record'),
 ('maintenance_lead','winter.readiness.approve'),
 ('maintenance_foreman','winter.readiness.read'),('maintenance_foreman','winter.readiness.record'),
 ('maintenance_main_foreman','winter.readiness.read'),('maintenance_main_foreman','winter.readiness.record'),
 ('maintenance_main_foreman','winter.readiness.policy.manage'),
 ('maintenance_main_foreman','winter.readiness.approve')
) grant_row(role_code,permission_key) on r.role_code=grant_row.role_code and r.role_kind='template'
on conflict do nothing;

create table public.winter_readiness_templates (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 version_number integer not null check(version_number between 1 and 10000),
 name text not null check(char_length(trim(name)) between 5 and 160),
 instructions text not null check(char_length(trim(instructions)) between 12 and 2000),
 steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 4 and 18),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 unique(organization_id,campground_id,version_number),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id)
);
create index winter_readiness_templates_scope_idx on public.winter_readiness_templates(campground_id,version_number desc);
create index winter_readiness_templates_campground_fk_idx on public.winter_readiness_templates(organization_id,campground_id);
create index winter_readiness_templates_actor_idx on public.winter_readiness_templates(created_by_user_id);

create table public.winter_readiness_assessments (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 accommodation_id uuid not null,
 assignment_id uuid,
 template_id uuid not null,
 winter_year integer not null check(winter_year between 2020 and 2120),
 water_mode text not null check(water_mode in ('none_verified','insulated','heated')),
 operating_limits text not null check(char_length(trim(operating_limits)) between 12 and 1200),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 started_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 unique(campground_id,accommodation_id,winter_year),
 foreign key(organization_id,campground_id,accommodation_id)
  references public.accommodations(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,assignment_id)
  references public.seasonal_assignments(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,template_id)
  references public.winter_readiness_templates(organization_id,campground_id,id)
);
create index winter_readiness_assessments_scope_idx on public.winter_readiness_assessments(campground_id,winter_year desc,started_at desc);
create index winter_readiness_assessments_accommodation_fk_idx on public.winter_readiness_assessments(organization_id,campground_id,accommodation_id);
create index winter_readiness_assessments_assignment_fk_idx on public.winter_readiness_assessments(organization_id,campground_id,assignment_id) where assignment_id is not null;
create index winter_readiness_assessments_template_fk_idx on public.winter_readiness_assessments(organization_id,campground_id,template_id);
create index winter_readiness_assessments_actor_fk_idx on public.winter_readiness_assessments(created_by_user_id);

create table public.winter_readiness_observations (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 assessment_id uuid not null,
 step_key text not null check(step_key ~ '^[a-z][a-z0-9-]{1,79}$'),
 result text not null check(result in ('pass','defect','not_applicable')),
 evidence_reference text check(evidence_reference is null or char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 2000),
 corrective_work_order_id uuid,
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 observed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,assessment_id)
  references public.winter_readiness_assessments(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,corrective_work_order_id)
  references public.maintenance_work_orders(organization_id,campground_id,id),
 check(result <> 'pass' or evidence_reference is not null)
);
create index winter_readiness_observations_scope_idx on public.winter_readiness_observations(campground_id,observed_at desc);
create index winter_readiness_observations_assessment_fk_idx on public.winter_readiness_observations(organization_id,campground_id,assessment_id);
create index winter_readiness_observations_history_idx on public.winter_readiness_observations(assessment_id,step_key,observed_at desc,id desc);
create index winter_readiness_observations_order_fk_idx on public.winter_readiness_observations(organization_id,campground_id,corrective_work_order_id) where corrective_work_order_id is not null;
create index winter_readiness_observations_actor_idx on public.winter_readiness_observations(actor_user_id);

create table public.winter_readiness_decisions (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 assessment_id uuid not null,
 decision text not null check(decision in ('approved','rejected')),
 note text not null check(char_length(trim(note)) between 12 and 2000),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 decided_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,assessment_id)
  references public.winter_readiness_assessments(organization_id,campground_id,id)
);
create unique index winter_readiness_one_approval_idx on public.winter_readiness_decisions(assessment_id) where decision='approved';
create index winter_readiness_decisions_assessment_fk_idx on public.winter_readiness_decisions(organization_id,campground_id,assessment_id);
create index winter_readiness_decisions_scope_idx on public.winter_readiness_decisions(campground_id,decided_at desc);
create index winter_readiness_decisions_actor_idx on public.winter_readiness_decisions(actor_user_id);

create function icamp_private.winter_readiness_template_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; seen text[]:=array[]::text[]; k text;
begin
 if new.created_by_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'winter.readiness.policy.manage') then
  raise exception 'Authorized winter-readiness checklist publisher required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('winter-readiness-template:'||new.campground_id::text,0));
 if new.version_number is distinct from coalesce((select max(t.version_number)+1 from public.winter_readiness_templates t
  where t.campground_id=new.campground_id),1) then raise exception 'Checklist version must advance'; end if;
 for item in select value from jsonb_array_elements(new.steps) as e(value) loop
  k:=item->>'key';
  if jsonb_typeof(item)<>'object' or k is null or k !~ '^[a-z][a-z0-9-]{1,79}$'
   or k=any(seen) or jsonb_typeof(item->'required')<>'boolean'
   or char_length(trim(coalesce(item->>'label',''))) not between 5 and 240 then
   raise exception 'Checklist steps need distinct keys, labels and required flags'; end if;
  seen:=array_append(seen,k);
 end loop;
 if not ('water-freeze-protection'=any(seen) and 'heating-power'=any(seen)
  and 'sanitation-drainage'=any(seen) and 'winter-access'=any(seen)) or
  exists(select 1 from jsonb_array_elements(new.steps) e where e->>'key' in
   ('water-freeze-protection','heating-power','sanitation-drainage','winter-access')
   and (e->>'required')::boolean is distinct from true) then
  raise exception 'Water, heat, sanitation and winter access must remain required'; end if;
 return new;
end $$;
create trigger winter_readiness_template_validate before insert on public.winter_readiness_templates
 for each row execute function icamp_private.winter_readiness_template_validate();

create function icamp_private.winter_readiness_assessment_validate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.created_by_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'winter.readiness.record') then
  raise exception 'Authorized winter-readiness recorder required'; end if;
 if not exists(select 1 from public.accommodations a where a.id=new.accommodation_id
  and a.campground_id=new.campground_id and a.organization_id=new.organization_id
  and a.lifecycle_state='active') then
  raise exception 'Winter readiness must target an active accommodation'; end if;
 if new.assignment_id is not null and not exists(select 1 from public.seasonal_assignments s
  where s.id=new.assignment_id and s.campground_id=new.campground_id
  and s.accommodation_id=new.accommodation_id and s.assignment_state='active'
  and not s.winterization_required and s.occupancy_state<>'winter_closed') then
  raise exception 'Readiness assignment must belong to this open site and not require shutdown'; end if;
 if exists(select 1 from public.seasonal_assignments s where s.accommodation_id=new.accommodation_id
  and s.assignment_state='active' and (s.winterization_required or s.occupancy_state='winter_closed')) then
  raise exception 'Required-shutdown or winter-closed site cannot use readiness as a substitute'; end if;
 if new.winter_year not between extract(year from current_date)::integer-1 and extract(year from current_date)::integer+1 then
  raise exception 'Readiness year is outside the operating period'; end if;
 return new;
end $$;
create trigger winter_readiness_assessment_validate before insert on public.winter_readiness_assessments
 for each row execute function icamp_private.winter_readiness_assessment_validate();

create function icamp_private.winter_readiness_observation_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare assessment public.winter_readiness_assessments%rowtype; mandatory boolean;
begin
 if new.actor_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'winter.readiness.record') then
  raise exception 'Authorized winter readiness observer required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('winter-readiness:'||new.assessment_id::text,0));
 select * into assessment from public.winter_readiness_assessments
  where id=new.assessment_id and campground_id=new.campground_id;
 if not found then raise exception 'Assessment scope mismatch'; end if;
 if exists(select 1 from public.winter_readiness_decisions d where d.assessment_id=assessment.id and d.decision='approved') then
  raise exception 'Approved winter readiness cannot receive more observations'; end if;
 select (e->>'required')::boolean into mandatory from public.winter_readiness_templates t,
  lateral jsonb_array_elements(t.steps) e where t.id=assessment.template_id and e->>'key'=new.step_key;
 if mandatory is null then raise exception 'Step not in the selected policy'; end if;
 if mandatory and new.result='not_applicable' then raise exception 'Mandatory winter safety evidence cannot be bypassed'; end if;
 if new.result='defect' and new.corrective_work_order_id is null then
  raise exception 'Cold-weather defects need a canonical corrective work order'; end if;
 if new.result<>'defect' and new.corrective_work_order_id is not null then
  raise exception 'Only defects can link corrective work'; end if;
 return new;
end $$;
create trigger winter_readiness_observation_validate before insert on public.winter_readiness_observations
 for each row execute function icamp_private.winter_readiness_observation_validate();

create function icamp_private.winter_readiness_decision_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare assessment public.winter_readiness_assessments%rowtype; missing_count integer;
declare expected_year integer:=extract(year from current_date)::integer;
begin
 if new.actor_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'winter.readiness.approve') then
  raise exception 'Independent authorized winter-readiness reviewer required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('winter-readiness:'||new.assessment_id::text,0));
 select * into assessment from public.winter_readiness_assessments
  where id=new.assessment_id and campground_id=new.campground_id;
 if not found then raise exception 'Assessment scope mismatch'; end if;
 if exists(select 1 from public.winter_readiness_decisions d where d.assessment_id=assessment.id and d.decision='approved') then
  raise exception 'Readiness already approved'; end if;
 if new.decision='approved' then
  if extract(month from current_date)::integer<=4 then expected_year:=expected_year-1; end if;
  if assessment.winter_year<>expected_year then raise exception 'Approval must cover the current winter operating year'; end if;
  if new.actor_user_id=assessment.created_by_user_id or exists(
   select 1 from public.winter_readiness_observations o where o.assessment_id=assessment.id
    and o.actor_user_id=new.actor_user_id) then
   raise exception 'Reviewer must be independent of the field evidence recorder'; end if;
  if not exists(select 1 from public.campgrounds c where c.id=new.campground_id and c.lifecycle_state='active') then
   raise exception 'Inactive demonstration campground cannot attest physical winter readiness'; end if;
  if not exists(select 1 from public.accommodations a where a.id=assessment.accommodation_id and a.lifecycle_state='active') then
   raise exception 'Only active accommodation can be approved'; end if;
  if exists(select 1 from public.seasonal_assignments s where s.accommodation_id=assessment.accommodation_id
   and s.assignment_state='active' and (s.winterization_required or s.occupancy_state='winter_closed')) then
   raise exception 'Required winter shutdown or closed occupancy must not be replaced with readiness'; end if;
  select count(*) into missing_count from public.winter_readiness_templates t,
   lateral jsonb_array_elements(t.steps) item
   left join lateral (select o.result from public.winter_readiness_observations o
    where o.assessment_id=assessment.id and o.step_key=item->>'key'
    order by o.observed_at desc,o.id desc limit 1) latest on true
   where t.id=assessment.template_id and (latest.result is null or latest.result='defect'
    or ((item->>'required')::boolean and latest.result<>'pass'));
  if missing_count>0 then raise exception 'Every safety step needs acceptable latest evidence'; end if;
 end if;
 return new;
end $$;
create trigger winter_readiness_decision_validate before insert on public.winter_readiness_decisions
 for each row execute function icamp_private.winter_readiness_decision_validate();

create trigger winter_readiness_templates_immutable before update or delete on public.winter_readiness_templates
 for each row execute function icamp_private.winterization_append_only();
create trigger winter_readiness_assessments_immutable before update or delete on public.winter_readiness_assessments
 for each row execute function icamp_private.winterization_append_only();
create trigger winter_readiness_observations_immutable before update or delete on public.winter_readiness_observations
 for each row execute function icamp_private.winterization_append_only();
create trigger winter_readiness_decisions_immutable before update or delete on public.winter_readiness_decisions
 for each row execute function icamp_private.winterization_append_only();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['winter_readiness_templates','winter_readiness_assessments',
  'winter_readiness_observations','winter_readiness_decisions'] loop
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
create policy accommodations_winter_readiness_read on public.accommodations for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winter.readiness.read'));
create policy seasonal_assignments_winter_readiness_read on public.seasonal_assignments for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winter.readiness.read'));
create policy winter_readiness_templates_read on public.winter_readiness_templates for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winter.readiness.read'));
create policy winter_readiness_templates_insert on public.winter_readiness_templates for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'winter.readiness.policy.manage')
 and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy winter_readiness_assessments_read on public.winter_readiness_assessments for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winter.readiness.read'));
create policy winter_readiness_assessments_insert on public.winter_readiness_assessments for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'winter.readiness.record')
 and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy winter_readiness_observations_read on public.winter_readiness_observations for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winter.readiness.read'));
create policy winter_readiness_observations_insert on public.winter_readiness_observations for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'winter.readiness.record')
 and actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy winter_readiness_decisions_read on public.winter_readiness_decisions for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winter.readiness.read'));
create policy winter_readiness_decisions_insert on public.winter_readiness_decisions for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'winter.readiness.approve')
 and actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);

comment on table public.winter_readiness_decisions is
 'Build 088 human-attested readiness only; approval does not activate winter bookings or operate physical utilities.';
