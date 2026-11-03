-- Build 193: versioned staff-recorded renewal interests and immutable owner follow-up evidence.
-- Deliberately does not renew terms, collect money, send notices or approve safety.
insert into icamp_private.permission_catalog(permission_key,description,risk_level) values
 ('seasonal.owner.read','Inspect campground seasonal owner follow-up and canonical readiness evidence.','elevated'),
 ('seasonal.owner.record','Record versioned renewal preferences and internal owner tasks.','elevated'),
 ('seasonal.owner.review','Independently acknowledge internal owner follow-ups; never approve safety.','elevated')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.key from icamp_private.roles r join (values
 ('owner_admin','seasonal.owner.read'),('owner_admin','seasonal.owner.record'),('owner_admin','seasonal.owner.review'),
 ('campground_manager','seasonal.owner.read'),('campground_manager','seasonal.owner.record'),
 ('maintenance_main_foreman','seasonal.owner.read'),('maintenance_main_foreman','seasonal.owner.record'),
 ('maintenance_lead','seasonal.owner.read')
) p(code,key) on r.role_kind='template' and r.lifecycle_state='active' and r.role_code=p.code
on conflict do nothing;

create table icamp_private.seasonal_renewal_intents (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 assignment_id uuid not null,
 term_version integer not null check(term_version between 1 and 9999),
 base_assignment_version bigint not null check(base_assignment_version>=1),
 current_term_ends_on date not null,
 proposed_term_ends_on date,
 preference text not null check(preference in ('interested','declined','needs_discussion')),
 evidence_origin text not null default 'staff_recorded' check(evidence_origin='staff_recorded'),
 source_reference text not null check(char_length(trim(source_reference)) between 8 and 180),
 note text not null check(char_length(trim(note)) between 12 and 1200),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 unique(assignment_id,term_version),
 foreign key(organization_id,campground_id,assignment_id)
  references public.seasonal_assignments(organization_id,campground_id,id) on delete restrict,
 check((preference='interested' and proposed_term_ends_on is not null and proposed_term_ends_on>current_term_ends_on)
    or (preference<>'interested' and proposed_term_ends_on is null))
);
create index seasonal_renewal_intents_scope_idx on icamp_private.seasonal_renewal_intents(campground_id,assignment_id,term_version desc);
create index seasonal_renewal_intents_actor_fk_idx on icamp_private.seasonal_renewal_intents(recorded_by_user_id);
create index seasonal_renewal_intents_assignment_fk_idx on icamp_private.seasonal_renewal_intents(organization_id,campground_id,assignment_id);

create table icamp_private.seasonal_owner_tasks (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 assignment_id uuid not null,
 task_kind text not null check(task_kind in ('renewal','winterization','spring_reopening','deficiency','owner_followup')),
 due_on date not null,
 description text not null check(char_length(trim(description)) between 12 and 1200),
 source_reference text not null check(char_length(trim(source_reference)) between 8 and 180),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,assignment_id)
  references public.seasonal_assignments(organization_id,campground_id,id) on delete restrict
);
create index seasonal_owner_tasks_scope_idx on icamp_private.seasonal_owner_tasks(campground_id,due_on,id);
create index seasonal_owner_tasks_assignment_fk_idx on icamp_private.seasonal_owner_tasks(organization_id,campground_id,assignment_id);
create index seasonal_owner_tasks_creator_fk_idx on icamp_private.seasonal_owner_tasks(created_by_user_id);

create table icamp_private.seasonal_owner_task_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 task_id uuid not null,
 event_kind text not null check(event_kind in ('followup_note','owner_acknowledged','reopened')),
 reason text not null check(char_length(trim(reason)) between 12 and 1200),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,task_id)
  references icamp_private.seasonal_owner_tasks(organization_id,campground_id,id) on delete restrict
);
create index seasonal_owner_task_events_task_fk_idx on icamp_private.seasonal_owner_task_events(organization_id,campground_id,task_id,recorded_at desc);
create index seasonal_owner_task_events_actor_fk_idx on icamp_private.seasonal_owner_task_events(actor_user_id);

create function icamp_private.seasonal_owner_guard_renewal()
returns trigger language plpgsql security definer set search_path='' as $$
declare a record; next_version integer;
begin
 if new.recorded_by_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid
  or not icamp_private.has_campground_permission(new.campground_id,'seasonal.owner.record') then
  raise exception 'Unauthorized seasonal renewal evidence'; end if;
 select organization_id,campground_id,row_version,ends_on,assignment_state into a
 from public.seasonal_assignments where id=new.assignment_id and campground_id=new.campground_id for update;
 if not found or a.organization_id is distinct from new.organization_id or a.assignment_state<>'active'
  then raise exception 'Active matching seasonal assignment required'; end if;
 if new.base_assignment_version<>a.row_version or new.current_term_ends_on<>a.ends_on
  then raise exception 'Stale assignment terms; refresh the renewal record'; end if;
 select coalesce(max(term_version),0)+1 into next_version from icamp_private.seasonal_renewal_intents
 where assignment_id=new.assignment_id;
 if new.term_version<>next_version then raise exception 'Renewal version changed; refresh'; end if;
 return new;
end $$;
create trigger seasonal_renewal_guard before insert on icamp_private.seasonal_renewal_intents
for each row execute function icamp_private.seasonal_owner_guard_renewal();

create function icamp_private.seasonal_owner_guard_task()
returns trigger language plpgsql security definer set search_path='' as $$
declare a record;
begin
 if new.created_by_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid
  or not icamp_private.has_campground_permission(new.campground_id,'seasonal.owner.record') then
  raise exception 'Unauthorized seasonal owner task'; end if;
 select organization_id,assignment_state into a from public.seasonal_assignments
 where id=new.assignment_id and campground_id=new.campground_id;
 if not found or a.organization_id is distinct from new.organization_id or a.assignment_state<>'active'
  then raise exception 'Active matching seasonal assignment required'; end if;
 return new;
end $$;
create trigger seasonal_owner_task_guard before insert on icamp_private.seasonal_owner_tasks
for each row execute function icamp_private.seasonal_owner_guard_task();

create function icamp_private.seasonal_owner_guard_task_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare task_row record; author uuid;
begin
 author:=nullif(current_setting('icamp.user_id',true),'')::uuid;
 if new.actor_user_id is distinct from author then raise exception 'Owner follow-up actor mismatch'; end if;
 select organization_id,campground_id,created_by_user_id into task_row
 from icamp_private.seasonal_owner_tasks where id=new.task_id;
 if not found or task_row.organization_id is distinct from new.organization_id
  or task_row.campground_id is distinct from new.campground_id then
  raise exception 'Owner task source outside campground'; end if;
 if new.event_kind='owner_acknowledged' then
  if author=task_row.created_by_user_id or
   not icamp_private.has_campground_permission(new.campground_id,'seasonal.owner.review')
   then raise exception 'Independent owner review required'; end if;
 else
  if not icamp_private.has_campground_permission(new.campground_id,'seasonal.owner.record')
  then raise exception 'Owner follow-up permission required'; end if;
 end if;
 return new;
end $$;
create trigger seasonal_owner_task_event_guard before insert on icamp_private.seasonal_owner_task_events
for each row execute function icamp_private.seasonal_owner_guard_task_event();

create function icamp_private.seasonal_owner_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Seasonal owner evidence is immutable'; end $$;
do $immutable$ declare t text; begin
 foreach t in array array['seasonal_renewal_intents','seasonal_owner_tasks','seasonal_owner_task_events'] loop
 execute format('create trigger %I before update or delete on icamp_private.%I for each row execute function icamp_private.seasonal_owner_immutable()',t||'_immutable',t);
 end loop;
end $immutable$;

do $owner_rls$ declare t text; begin
 foreach t in array array['seasonal_renewal_intents','seasonal_owner_tasks','seasonal_owner_task_events'] loop
 execute format('alter table icamp_private.%I enable row level security',t);
 execute format('alter table icamp_private.%I force row level security',t);
 execute format('revoke all on icamp_private.%I from public',t);
 if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on icamp_private.%I from anon',t); end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on icamp_private.%I from authenticated',t); end if;
 execute format('grant select,insert on icamp_private.%I to icamp_app',t);
 execute format('create policy %I on icamp_private.%I for select to icamp_app using (icamp_private.has_campground_permission(campground_id,''seasonal.owner.read'') or icamp_private.has_campground_permission(campground_id,''seasonal.owner.record'') or icamp_private.has_campground_permission(campground_id,''seasonal.owner.review''))',t||'_read',t);
 execute format('create policy %I on icamp_private.%I for insert to icamp_app with check (icamp_private.has_campground_permission(campground_id,''seasonal.owner.record'') or icamp_private.has_campground_permission(campground_id,''seasonal.owner.review''))',t||'_insert',t);
 end loop;
end $owner_rls$;
revoke all on function icamp_private.seasonal_owner_guard_renewal() from public;
revoke all on function icamp_private.seasonal_owner_guard_task() from public;
revoke all on function icamp_private.seasonal_owner_guard_task_event() from public;
revoke all on function icamp_private.seasonal_owner_immutable() from public;
comment on table icamp_private.seasonal_renewal_intents is 'Staff-recorded, versioned interest only. Not an executed renewal, signed agreement, billing action or guest consent.';
comment on table icamp_private.seasonal_owner_task_events is 'Internal owner follow-ups; acknowledgement cannot override winterization, spring safety, maintenance, availability or payment holds.';
