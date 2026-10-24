-- Build 087: versioned campground winter shutdown checklists and foreman sign-off.
-- This records human-attested physical work; it does not operate water valves or utilities.

insert into icamp_private.permission_catalog(permission_key,description,risk_level) values
 ('winterization.read','View campground winterization plans, evidence and sign-offs.','elevated'),
 ('winterization.record','Record observed winterization work and source evidence.','elevated'),
 ('winterization.template.manage','Publish new immutable campground winterization checklist versions.','elevated')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,g.permission_key from icamp_private.roles r join (values
 ('owner_admin','winterization.read'),('owner_admin','winterization.record'),('owner_admin','winterization.template.manage'),
 ('campground_manager','winterization.read'),('campground_manager','winterization.record'),('campground_manager','winterization.template.manage'),
 ('maintenance','winterization.read'),('maintenance','winterization.record'),
 ('maintenance_lead','winterization.read'),('maintenance_lead','winterization.record'),
 ('maintenance_foreman','winterization.read'),('maintenance_foreman','winterization.record'),
 ('maintenance_main_foreman','winterization.read'),('maintenance_main_foreman','winterization.record'),
 ('maintenance_main_foreman','winterization.template.manage')
) g(role_code,permission_key) on r.role_code=g.role_code and r.role_kind='template'
on conflict do nothing;

create table public.winterization_templates (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 version_number integer not null check(version_number between 1 and 10000),
 name text not null check(char_length(trim(name)) between 5 and 160),
 instructions text not null check(char_length(trim(instructions)) between 12 and 2000),
 steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 2 and 16),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 unique(organization_id,campground_id,version_number),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id)
);
create index winterization_templates_scope_idx on public.winterization_templates(campground_id,version_number desc);
create index winterization_templates_actor_idx on public.winterization_templates(created_by_user_id);

create table public.winterization_runs (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 assignment_id uuid not null,
 template_id uuid not null,
 winter_year integer not null check(winter_year between 2020 and 2120),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 started_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 unique(assignment_id,winter_year),
 foreign key(organization_id,campground_id,assignment_id)
  references public.seasonal_assignments(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,template_id)
  references public.winterization_templates(organization_id,campground_id,id)
);
create index winterization_runs_scope_idx on public.winterization_runs(campground_id,winter_year desc,started_at desc);
create index winterization_runs_assignment_fk_idx on public.winterization_runs(organization_id,campground_id,assignment_id);
create index winterization_runs_template_fk_idx on public.winterization_runs(organization_id,campground_id,template_id);
create index winterization_runs_actor_idx on public.winterization_runs(created_by_user_id);

create table public.winterization_step_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 run_id uuid not null,
 step_key text not null check(step_key ~ '^[a-z][a-z0-9-]{1,79}$'),
 result text not null check(result in ('pass','needs_work','not_applicable')),
 evidence_reference text check(evidence_reference is null or char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 2000),
 work_order_id uuid,
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,run_id)
  references public.winterization_runs(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,work_order_id)
  references public.maintenance_work_orders(organization_id,campground_id,id),
 check(result<>'pass' or evidence_reference is not null)
);
create index winterization_step_history_idx on public.winterization_step_events(run_id,step_key,recorded_at desc,id desc);
create index winterization_step_scope_idx on public.winterization_step_events(campground_id,recorded_at desc);
create index winterization_step_work_order_fk_idx on public.winterization_step_events(organization_id,campground_id,work_order_id) where work_order_id is not null;
create index winterization_step_actor_idx on public.winterization_step_events(actor_user_id);

create table public.winterization_reviews (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 run_id uuid not null,
 decision text not null check(decision in ('approved','rejected')),
 note text not null check(char_length(trim(note)) between 12 and 2000),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,run_id)
  references public.winterization_runs(organization_id,campground_id,id)
);
create unique index winterization_one_approval_idx on public.winterization_reviews(run_id) where decision='approved';
create index winterization_review_scope_idx on public.winterization_reviews(campground_id,reviewed_at desc);
create index winterization_review_actor_idx on public.winterization_reviews(actor_user_id);

create function icamp_private.winterization_actor() returns uuid language sql stable security invoker set search_path='' as $$
 select nullif((select current_setting('icamp.user_id',true)),'')::uuid;
$$;
revoke all on function icamp_private.winterization_actor() from public;
grant execute on function icamp_private.winterization_actor() to icamp_app;

create function icamp_private.winterization_template_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; seen text[] := array[]::text[]; item_key text;
begin
 if new.created_by_user_id is distinct from icamp_private.winterization_actor()
  or not icamp_private.has_campground_permission(new.campground_id,'winterization.template.manage') then
  raise exception 'Authorized winterization template publisher required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('winter-template:'||new.campground_id::text,0));
 if new.version_number is distinct from coalesce((select max(t.version_number)+1 from public.winterization_templates t
   where t.campground_id=new.campground_id),1) then raise exception 'New template must use next campground version'; end if;
 for item in select value from jsonb_array_elements(new.steps) as e(value) loop
  item_key := item->>'key';
  if jsonb_typeof(item)<>'object' or item_key is null or item_key !~ '^[a-z][a-z0-9-]{1,79}$'
    or item_key=any(seen) or jsonb_typeof(item->'required')<>'boolean'
    or char_length(trim(coalesce(item->>'label',''))) not between 5 and 240 then
    raise exception 'Checklist steps must have unique keys, labels and required booleans'; end if;
  seen := array_append(seen,item_key);
 end loop;
 if not ('water-shutoff'=any(seen) and 'water-drain'=any(seen)) or
    not exists(select 1 from jsonb_array_elements(new.steps) e where e->>'key'='water-shutoff' and (e->>'required')::boolean) or
    not exists(select 1 from jsonb_array_elements(new.steps) e where e->>'key'='water-drain' and (e->>'required')::boolean) then
   raise exception 'Water shutoff and draining must be required checklist steps'; end if;
 return new;
end $$;
create trigger winterization_template_validate before insert on public.winterization_templates
 for each row execute function icamp_private.winterization_template_validate();

create function icamp_private.winterization_run_validate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.created_by_user_id is distinct from icamp_private.winterization_actor() or
  not (icamp_private.has_campground_permission(new.campground_id,'winterization.record')
   or icamp_private.has_campground_permission(new.campground_id,'seasonal.manage')) then
   raise exception 'Authorized winterization recorder required'; end if;
 if not exists(select 1 from public.seasonal_assignments s where s.id=new.assignment_id
   and s.campground_id=new.campground_id and s.organization_id=new.organization_id
   and s.assignment_state='active' and s.occupancy_state<>'winter_closed') then
   raise exception 'Only a currently active, open long-term assignment may start winterization'; end if;
 if new.winter_year not between extract(year from current_date)::integer-1 and extract(year from current_date)::integer+1 then
   raise exception 'Winterization year is outside the current operating period'; end if;
 return new;
end $$;
create trigger winterization_run_validate before insert on public.winterization_runs
 for each row execute function icamp_private.winterization_run_validate();

create function icamp_private.winterization_step_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.winterization_runs%rowtype; mandatory boolean;
begin
 if new.actor_user_id is distinct from icamp_private.winterization_actor() or
  not icamp_private.has_campground_permission(new.campground_id,'winterization.record') then
   raise exception 'Authorized maintenance evidence recorder required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('winter-run:'||new.run_id::text,0));
 select * into r from public.winterization_runs where id=new.run_id and campground_id=new.campground_id;
 if not found then raise exception 'Winterization run scope mismatch'; end if;
 if exists(select 1 from public.winterization_reviews d where d.run_id=r.id and d.decision='approved') then
  raise exception 'Signed-off winterization cannot accept further step evidence'; end if;
 select (e->>'required')::boolean into mandatory from public.winterization_templates t,
  lateral jsonb_array_elements(t.steps) e where t.id=r.template_id and e->>'key'=new.step_key;
 if mandatory is null then raise exception 'Step is not in the selected checklist version'; end if;
 if mandatory and new.result='not_applicable' then raise exception 'Required winterization steps cannot be marked not applicable'; end if;
 if new.result='needs_work' and new.work_order_id is null then
   raise exception 'Failed winterization step must link a canonical maintenance work order'; end if;
 if new.result<>'needs_work' and new.work_order_id is not null then
   raise exception 'Only failed winterization steps may reference corrective work'; end if;
 return new;
end $$;
create trigger winterization_step_validate before insert on public.winterization_step_events
 for each row execute function icamp_private.winterization_step_validate();

create function icamp_private.winterization_review_validate() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.winterization_runs%rowtype; missing_count integer;
begin
 if new.actor_user_id is distinct from icamp_private.winterization_actor() or
  not icamp_private.has_campground_permission(new.campground_id,'winterization.signoff') then
  raise exception 'Maintenance lead or foreman sign-off permission required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('winter-run:'||new.run_id::text,0));
 select * into r from public.winterization_runs where id=new.run_id and campground_id=new.campground_id;
 if not found then raise exception 'Winterization run scope mismatch'; end if;
 if exists(select 1 from public.winterization_reviews d where d.run_id=r.id and d.decision='approved') then
  raise exception 'Winterization run already signed off'; end if;
 if new.decision='approved' and (new.actor_user_id=r.created_by_user_id or
  exists(select 1 from public.winterization_step_events se where se.run_id=r.id
    and se.actor_user_id=new.actor_user_id)) then
  raise exception 'Winterization sign-off must be independent of the work recorder'; end if;
 if not exists(select 1 from public.seasonal_assignments a where a.id=r.assignment_id
  and a.assignment_state='active' and a.occupancy_state<>'winter_closed') then
  raise exception 'Cannot sign off an inactive or already winter-closed assignment'; end if;
 if new.decision='approved' then
  if not exists(select 1 from public.campgrounds c where c.id=new.campground_id and c.lifecycle_state='active') then
   raise exception 'Inactive test campgrounds cannot attest physical shutdown'; end if;
  select count(*) into missing_count from public.winterization_templates t,
   lateral jsonb_array_elements(t.steps) item
   left join lateral (
    select se.result from public.winterization_step_events se
    where se.run_id=r.id and se.step_key=item->>'key'
    order by se.recorded_at desc,se.id desc limit 1
   ) latest on true
   where t.id=r.template_id and (latest.result is null or latest.result='needs_work'
    or ((item->>'required')::boolean and latest.result<>'pass'));
  if missing_count>0 then raise exception 'Every checklist step must have acceptable latest evidence before sign-off'; end if;
 end if;
 return new;
end $$;
create trigger winterization_review_validate before insert on public.winterization_reviews
 for each row execute function icamp_private.winterization_review_validate();

create function icamp_private.winterization_append_only() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'Winterization plans and evidence are append-only'; end $$;
create trigger winterization_templates_immutable before update or delete on public.winterization_templates
 for each row execute function icamp_private.winterization_append_only();
create trigger winterization_runs_immutable before update or delete on public.winterization_runs
 for each row execute function icamp_private.winterization_append_only();
create trigger winterization_steps_immutable before update or delete on public.winterization_step_events
 for each row execute function icamp_private.winterization_append_only();
create trigger winterization_reviews_immutable before update or delete on public.winterization_reviews
 for each row execute function icamp_private.winterization_append_only();

-- Canonical Build 047 winter close may not bypass the required winterization proof.
create function icamp_private.require_winterization_before_winter_close() returns trigger
language plpgsql security definer set search_path='' as $$
declare operating_year integer := extract(year from current_date)::integer;
begin
 if old.winterization_required is distinct from new.winterization_required then
  raise exception 'Winterization requirement cannot be removed from a signed assignment'; end if;
 if new.occupancy_state='winter_closed' and old.occupancy_state is distinct from 'winter_closed'
    and new.winterization_required then
  if extract(month from current_date)::integer <= 4 then operating_year:=operating_year-1; end if;
  if not exists(select 1 from public.winterization_runs r join public.winterization_reviews d
      on d.run_id=r.id and d.decision='approved'
     where r.assignment_id=new.id and r.campground_id=new.campground_id
       and r.winter_year=operating_year) then
    raise exception 'Maintenance/foreman winterization sign-off required before winter closing this assignment'; end if;
 end if;
 return new;
end $$;
create trigger seasonal_assignments_require_winterization
 before update on public.seasonal_assignments
 for each row execute function icamp_private.require_winterization_before_winter_close();

do $roles$ declare role_name text; tab text; begin
 foreach tab in array array['winterization_templates','winterization_runs','winterization_step_events','winterization_reviews'] loop
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
create policy winterization_templates_read on public.winterization_templates for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winterization.read'));
create policy winterization_templates_insert on public.winterization_templates for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'winterization.template.manage')
 and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy winterization_runs_read on public.winterization_runs for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winterization.read'));
create policy winterization_runs_insert on public.winterization_runs for insert to icamp_app
 with check((icamp_private.has_campground_permission(campground_id,'winterization.record')
  or icamp_private.has_campground_permission(campground_id,'seasonal.manage'))
 and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy winterization_steps_read on public.winterization_step_events for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winterization.read'));
create policy winterization_steps_insert on public.winterization_step_events for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'winterization.record')
 and actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy winterization_reviews_read on public.winterization_reviews for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'winterization.read'));
create policy winterization_reviews_insert on public.winterization_reviews for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'winterization.signoff')
 and actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);

comment on table public.winterization_reviews is
 'Build 087 foreman-attested winter shutdown evidence; no physical valve, heater, electrical or safety device is controlled by iCamp.';
