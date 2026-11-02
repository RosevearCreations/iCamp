-- Build 113: accountable manual action plans and independently attested hold resolution.
-- Never mutates a Build 112 exception review, earlier acceptance or source case.
create table public.owner_export_reopen_action_plans (
 id uuid primary key,
 exception_review_id uuid not null references public.owner_export_acceptance_exception_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 action_kind text not null check(action_kind in ('gather_evidence','investigate_source','independent_recheck')),
 next_due_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 action_note text not null check(char_length(trim(action_note)) between 12 and 800),
 planned_by_user_id uuid not null references icamp_private.user_accounts(id),
 planned_at timestamptz not null default clock_timestamp(),
 constraint reopen_plan_pair check(source_campground_id<>target_campground_id)
);
create index reopen_plans_review_idx on public.owner_export_reopen_action_plans
 (exception_review_id,planned_at desc,id desc);
create table public.owner_export_reopen_hold_resolutions (
 id uuid primary key,
 action_plan_id uuid not null references public.owner_export_reopen_action_plans(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 resolution_kind text not null check(resolution_kind in ('continue_hold','independently_resolved')),
 observed_unclosed_cases integer not null default 0 check(observed_unclosed_cases>=0),
 cases_since_acceptance integer not null default 0 check(cases_since_acceptance>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 resolution_note text not null check(char_length(trim(resolution_note)) between 12 and 800),
 resolved_by_user_id uuid not null references icamp_private.user_accounts(id),
 resolved_at timestamptz not null default clock_timestamp(),
 constraint reopen_resolution_pair check(source_campground_id<>target_campground_id),
 constraint reopen_resolution_once unique(action_plan_id)
);
create index reopen_resolutions_pair_idx on public.owner_export_reopen_hold_resolutions
 (source_campground_id,target_campground_id,resolved_at desc);

create function icamp_private.owner_reopen_action_plan_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare scope record; latest_id uuid;
begin
 select x.*,r.review_id into scope from public.owner_export_acceptance_exception_reviews x
 join public.owner_export_outcome_acceptances a on a.id=x.acceptance_id
 join public.owner_export_reassessment_outcomes o on o.id=a.outcome_id
 join public.owner_export_oversight_reassessments r on r.id=o.reassessment_id
 where x.id=new.exception_review_id;
 if scope.id is null or scope.source_campground_id<>new.source_campground_id
  or scope.target_campground_id<>new.target_campground_id then
  raise exception 'Action plan must preserve the directed exception review pair'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(scope.review_id::text,109109));
 select id into latest_id from public.owner_export_acceptance_exception_reviews
  where acceptance_id=scope.acceptance_id order by reviewed_at desc,id desc limit 1;
 if scope.id<>latest_id or scope.review_kind='monitor' then
  raise exception 'Action plan requires the latest active exception hold or reopen recommendation'; end if;
 if new.planned_by_user_id=scope.reviewed_by_user_id then
  raise exception 'Action plan owner must differ from independent exception reviewer'; end if;
 new.planned_at:=clock_timestamp();
 if new.next_due_at<=new.planned_at or new.next_due_at>new.planned_at+interval '90 days' then
  raise exception 'Action plan due date must fall within the next 90 days'; end if;
 return new;
end $$;

create function icamp_private.owner_reopen_hold_resolution_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare scope record; current_review uuid; current_plan uuid; current_decision uuid; current_reassessment uuid; current_outcome uuid;
begin
 select p.*,x.acceptance_id,x.reviewed_by_user_id,
  x.id as exception_id,x.review_kind,a.accepted_at,a.outcome_id,
  o.reassessment_id,r.decision_id,r.review_id,v.snapshot_as_of,v.window_days,v.issue_kind
 into scope from public.owner_export_reopen_action_plans p
 join public.owner_export_acceptance_exception_reviews x on x.id=p.exception_review_id
 join public.owner_export_outcome_acceptances a on a.id=x.acceptance_id
 join public.owner_export_reassessment_outcomes o on o.id=a.outcome_id
 join public.owner_export_oversight_reassessments r on r.id=o.reassessment_id
 join public.owner_export_oversight_reviews v on v.id=r.review_id
 where p.id=new.action_plan_id;
 if scope.id is null or scope.source_campground_id<>new.source_campground_id
  or scope.target_campground_id<>new.target_campground_id then
  raise exception 'Hold resolution must preserve the original directed campground pair'; end if;
 if new.resolved_by_user_id in (scope.planned_by_user_id,scope.reviewed_by_user_id) then
  raise exception 'Independent hold reviewer must differ from plan owner and exception reviewer'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(scope.review_id::text,109109));
 select id into current_review from public.owner_export_acceptance_exception_reviews
  where acceptance_id=scope.acceptance_id order by reviewed_at desc,id desc limit 1;
 select id into current_plan from public.owner_export_reopen_action_plans
  where exception_review_id=scope.exception_review_id order by planned_at desc,id desc limit 1;
 select id into current_decision from public.owner_export_oversight_decisions
  where review_id=scope.review_id order by decided_at desc,id desc limit 1;
 select id into current_reassessment from public.owner_export_oversight_reassessments
  where decision_id=scope.decision_id order by reassessed_at desc,id desc limit 1;
 select id into current_outcome from public.owner_export_reassessment_outcomes
  where reassessment_id=scope.reassessment_id order by recorded_at desc,id desc limit 1;
 if current_review<>scope.exception_review_id or current_plan<>scope.id
  or current_decision<>scope.decision_id or current_reassessment<>scope.reassessment_id
  or current_outcome<>scope.outcome_id then
  raise exception 'Stale review, plan, or upstream evidence requires a fresh review'; end if;
 select count(*) filter(where not exists(select 1 from public.owner_export_exception_reviews e
    where e.case_id=c.id and e.review_kind='accepted'))::int,
  count(*) filter(where c.opened_at>scope.accepted_at)::int
 into new.observed_unclosed_cases,new.cases_since_acceptance
 from public.owner_export_exception_cases c
 where c.source_campground_id=new.source_campground_id
  and c.target_campground_id=new.target_campground_id
  and c.opened_at>=scope.snapshot_as_of-(scope.window_days*interval '1 day')
  and c.opened_at<=clock_timestamp()
  and (scope.issue_kind='all' or c.issue_kind=scope.issue_kind);
 if new.resolution_kind='independently_resolved' and new.observed_unclosed_cases>0 then
  raise exception 'Unresolved source cases require continued hold and independent source acceptance'; end if;
 new.resolved_at:=clock_timestamp();return new;
end $$;
create trigger reopen_action_plan_guard before insert on public.owner_export_reopen_action_plans
 for each row execute function icamp_private.owner_reopen_action_plan_guard();
create trigger reopen_hold_resolution_guard before insert on public.owner_export_reopen_hold_resolutions
 for each row execute function icamp_private.owner_reopen_hold_resolution_guard();
create trigger reopen_action_plan_immutable before update or delete on public.owner_export_reopen_action_plans
 for each row execute function icamp_private.winterization_append_only();
create trigger reopen_hold_resolution_immutable before update or delete on public.owner_export_reopen_hold_resolutions
 for each row execute function icamp_private.winterization_append_only();
do $security$ declare name text; role_name text; begin
 foreach name in array array['owner_export_reopen_action_plans','owner_export_reopen_hold_resolutions'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('alter table public.%I force row level security',name);
  execute format('revoke all on public.%I from public',name);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then
    execute format('revoke all on public.%I from %I',name,role_name);
   end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',name);
  execute format('create policy owner_pair_read on public.%I for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id))',name);
 end loop;
end $security$;
create policy reopen_plan_insert on public.owner_export_reopen_action_plans for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and planned_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy reopen_resolution_insert on public.owner_export_reopen_hold_resolutions for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and resolved_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_reopen_action_plan_guard() from public;
revoke all on function icamp_private.owner_reopen_hold_resolution_guard() from public;
