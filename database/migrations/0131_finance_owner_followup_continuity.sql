-- Build 099: private, append-only task/evidence/reassessment/administrative closure.
-- Closure is NOT a release of exception holds, lending approval or applicant acceptance.
create table public.permanent_unit_finance_followup_tasks (
 id uuid primary key, organization_id uuid not null, campground_id uuid not null,
 escalation_id uuid not null unique, owner_response_id uuid not null unique,
 assigned_owner_user_id uuid not null references icamp_private.user_accounts(id),
 task_reference text not null check(char_length(trim(task_reference)) between 8 and 400),
 action_plan text not null check(char_length(trim(action_plan)) between 12 and 800),
 due_at timestamptz not null, recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,escalation_id) references public.permanent_unit_finance_owner_escalations(organization_id,campground_id,id),
 foreign key(owner_response_id) references public.permanent_unit_finance_owner_responses(id)
);
create index finance_followup_tasks_scope_idx on public.permanent_unit_finance_followup_tasks(campground_id,due_at);
create table public.permanent_unit_finance_followup_evidence (
 id uuid primary key, organization_id uuid not null, campground_id uuid not null,
 task_id uuid not null, evidence_kind text not null check(evidence_kind in ('action_taken','pending_dependency','blocked')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,task_id) references public.permanent_unit_finance_followup_tasks(organization_id,campground_id,id)
);
create index finance_followup_evidence_task_idx on public.permanent_unit_finance_followup_evidence(task_id,recorded_at desc);
create table public.permanent_unit_finance_followup_reassessments (
 id uuid primary key, organization_id uuid not null, campground_id uuid not null,
 task_id uuid not null, evidence_id uuid not null,
 reassessment text not null check(reassessment in ('continue_followup','recommend_admin_closure')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 reassessed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reassessed_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,task_id) references public.permanent_unit_finance_followup_tasks(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,evidence_id) references public.permanent_unit_finance_followup_evidence(organization_id,campground_id,id)
);
create index finance_followup_reassessments_task_idx on public.permanent_unit_finance_followup_reassessments(task_id,reassessed_at desc);
create table public.permanent_unit_finance_escalation_closures (
 id uuid primary key, organization_id uuid not null, campground_id uuid not null,
 task_id uuid not null unique, reassessment_id uuid not null unique,
 outcome text not null check(outcome in ('administrative_followup_complete','returned_to_operator')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 closed_by_user_id uuid not null references icamp_private.user_accounts(id),
 closed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,task_id) references public.permanent_unit_finance_followup_tasks(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,reassessment_id) references public.permanent_unit_finance_followup_reassessments(organization_id,campground_id,id)
);
create index finance_escalation_closures_scope_idx on public.permanent_unit_finance_escalation_closures(campground_id,closed_at desc);

create function icamp_private.finance_followup_task_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare esc record; resp record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.escalation_id::text,99099));
 select * into esc from public.permanent_unit_finance_owner_escalations where id=new.escalation_id and campground_id=new.campground_id;
 select * into resp from public.permanent_unit_finance_owner_responses where id=new.owner_response_id and campground_id=new.campground_id;
 if esc.id is null or resp.id is null or resp.escalation_id<>esc.id or resp.response<>'accepted_followup'
  or new.assigned_owner_user_id<>esc.target_owner_user_id or new.recorded_by_user_id=esc.target_owner_user_id
  or new.due_at<=clock_timestamp() or new.due_at>clock_timestamp()+interval '90 days' then
  raise exception 'Follow-up task requires accepted owner response, independent assignment and bounded due date'; end if;
 return new;
end $$;
create trigger finance_followup_task_guard before insert on public.permanent_unit_finance_followup_tasks
 for each row execute function icamp_private.finance_followup_task_guard();

create function icamp_private.finance_followup_evidence_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare task record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.task_id::text,99099));
 select * into task from public.permanent_unit_finance_followup_tasks where id=new.task_id and campground_id=new.campground_id;
 if task.id is null or new.recorded_by_user_id<>task.assigned_owner_user_id
  or exists(select 1 from public.permanent_unit_finance_escalation_closures where task_id=new.task_id) then
  raise exception 'Only assigned owner may record evidence on an open task'; end if;
 return new;
end $$;
create trigger finance_followup_evidence_guard before insert on public.permanent_unit_finance_followup_evidence
 for each row execute function icamp_private.finance_followup_evidence_guard();

create function icamp_private.finance_followup_reassessment_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare task record; ev record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.task_id::text,99099));
 select * into task from public.permanent_unit_finance_followup_tasks where id=new.task_id and campground_id=new.campground_id;
 select * into ev from public.permanent_unit_finance_followup_evidence where id=new.evidence_id and campground_id=new.campground_id;
 if task.id is null or ev.id is null or ev.task_id<>task.id or new.reassessed_by_user_id in (task.assigned_owner_user_id,task.recorded_by_user_id)
  or (new.reassessment='recommend_admin_closure' and ev.evidence_kind<>'action_taken')
  or exists(select 1 from public.permanent_unit_finance_escalation_closures where task_id=new.task_id) then
  raise exception 'Independent reassessment needs linked owner evidence on an open task'; end if;
 return new;
end $$;
create trigger finance_followup_reassessment_guard before insert on public.permanent_unit_finance_followup_reassessments
 for each row execute function icamp_private.finance_followup_reassessment_guard();

create function icamp_private.finance_escalation_closure_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare task record; rev record; latest_rev record; latest_evidence record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.task_id::text,99099));
 select * into task from public.permanent_unit_finance_followup_tasks where id=new.task_id and campground_id=new.campground_id;
 select * into rev from public.permanent_unit_finance_followup_reassessments where id=new.reassessment_id and campground_id=new.campground_id;
 select * into latest_rev from public.permanent_unit_finance_followup_reassessments where task_id=new.task_id order by reassessed_at desc,id desc limit 1;
 select * into latest_evidence from public.permanent_unit_finance_followup_evidence where task_id=new.task_id order by recorded_at desc,id desc limit 1;
 if task.id is null or rev.id is null or rev.task_id<>task.id or rev.id<>latest_rev.id
  or rev.evidence_id<>latest_evidence.id
  or (new.outcome='administrative_followup_complete' and rev.reassessment<>'recommend_admin_closure')
  or new.closed_by_user_id in (task.assigned_owner_user_id,task.recorded_by_user_id,rev.reassessed_by_user_id) then
  raise exception 'Administrative closure needs latest independent reassessment and separate reviewer'; end if;
 return new;
end $$;
create trigger finance_escalation_closure_guard before insert on public.permanent_unit_finance_escalation_closures
 for each row execute function icamp_private.finance_escalation_closure_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_followup_tasks','permanent_unit_finance_followup_evidence','permanent_unit_finance_followup_reassessments','permanent_unit_finance_escalation_closures'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public',tab);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on public.%I from %I',tab,role_name); end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',tab);
  execute format('create trigger %I before update or delete on public.%I for each row execute function icamp_private.winterization_append_only()',tab||'_immutable',tab);
  execute format('create policy %I on public.%I for select to icamp_app using(icamp_private.has_campground_permission(campground_id,''permanent_unit.transfer''))',tab||'_read',tab);
 end loop;
end $roles$;
create policy finance_followup_tasks_insert on public.permanent_unit_finance_followup_tasks for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer') and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_followup_evidence_insert on public.permanent_unit_finance_followup_evidence for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer') and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_followup_reassessments_insert on public.permanent_unit_finance_followup_reassessments for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer') and reassessed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_escalation_closures_insert on public.permanent_unit_finance_escalation_closures for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer') and closed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.finance_followup_task_guard() from public;
revoke all on function icamp_private.finance_followup_evidence_guard() from public;
revoke all on function icamp_private.finance_followup_reassessment_guard() from public;
revoke all on function icamp_private.finance_escalation_closure_guard() from public;
