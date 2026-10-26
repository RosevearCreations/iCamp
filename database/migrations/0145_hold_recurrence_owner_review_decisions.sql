-- Build 115: accountable owner recurrence review and independent follow-up decision ledger.
-- Neither record changes previous holds, resolutions, cases, or original acceptance.
create table public.owner_export_hold_recurrence_reviews (
 id uuid primary key,
 acceptance_id uuid not null references public.owner_export_outcome_acceptances(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 observed_plan_count integer not null default 0 check(observed_plan_count>=0),
 observed_continued_holds integer not null default 0 check(observed_continued_holds>=0),
 observed_overdue_plans integer not null default 0 check(observed_overdue_plans>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint owner_hold_recurrence_pair check(source_campground_id<>target_campground_id)
);
create index owner_hold_recurrence_reviews_pair_idx on public.owner_export_hold_recurrence_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create table public.owner_export_hold_recurrence_decisions (
 id uuid primary key,
 recurrence_review_id uuid not null references public.owner_export_hold_recurrence_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 decision_kind text not null check(decision_kind in ('continue_monitoring','request_evidence','manual_escalation','independent_no_action')),
 next_due_at timestamptz,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 decision_note text not null check(char_length(trim(decision_note)) between 12 and 800),
 decided_by_user_id uuid not null references icamp_private.user_accounts(id),
 decided_at timestamptz not null default clock_timestamp(),
 constraint owner_hold_decision_pair check(source_campground_id<>target_campground_id),
 constraint owner_hold_decision_due check(
  (decision_kind='independent_no_action' and next_due_at is null)
  or (decision_kind<>'independent_no_action' and next_due_at is not null)),
 constraint owner_hold_decision_once unique(recurrence_review_id)
);
create index owner_hold_recurrence_decisions_pair_idx on public.owner_export_hold_recurrence_decisions
 (source_campground_id,target_campground_id,decided_at desc);

create function icamp_private.owner_hold_recurrence_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare a record; source_review uuid;
begin
 select a0.id,a0.acceptance_kind,o.reassessment_id,r.review_id into a
 from public.owner_export_outcome_acceptances a0
 join public.owner_export_reassessment_outcomes o on o.id=a0.outcome_id
 join public.owner_export_oversight_reassessments r on r.id=o.reassessment_id
 where a0.id=new.acceptance_id and a0.source_campground_id=new.source_campground_id
  and a0.target_campground_id=new.target_campground_id;
 if a.id is null or a.acceptance_kind<>'accepted' then
  raise exception 'Recurrence review requires accepted evidence in the directed campground pair'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.review_id::text,109109));
 -- The database, not a form, provides frozen recurrence counts.
 select count(*)::int,
  count(*) filter(where exists(select 1 from public.owner_export_reopen_hold_resolutions z
     where z.action_plan_id=p.id and z.resolution_kind='continue_hold'))::int,
  count(*) filter(where p.next_due_at<clock_timestamp() and not exists(
    select 1 from public.owner_export_reopen_hold_resolutions z
    where z.action_plan_id=p.id and z.resolution_kind='independently_resolved'))::int
 into new.observed_plan_count,new.observed_continued_holds,new.observed_overdue_plans
 from public.owner_export_reopen_action_plans p
 join public.owner_export_acceptance_exception_reviews x on x.id=p.exception_review_id
 where x.acceptance_id=new.acceptance_id;
 if new.observed_plan_count=0 then raise exception 'No action plans are available for recurrence review'; end if;
 new.reviewed_at:=clock_timestamp();return new;
end $$;
create function icamp_private.owner_hold_recurrence_decision_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare r record;latest_review uuid;
begin
 select * into r from public.owner_export_hold_recurrence_reviews where id=new.recurrence_review_id;
 if r.id is null or r.source_campground_id<>new.source_campground_id
  or r.target_campground_id<>new.target_campground_id then
  raise exception 'Decision requires the original directed recurrence review'; end if;
 if new.decided_by_user_id=r.reviewed_by_user_id then
  raise exception 'Independent decision-maker must differ from the recurrence reviewer'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.acceptance_id::text,115115));
 select id into latest_review from public.owner_export_hold_recurrence_reviews
  where acceptance_id=r.acceptance_id order by reviewed_at desc,id desc limit 1;
 if latest_review<>r.id then raise exception 'Independent decision requires the latest recurrence review'; end if;
 new.decided_at:=clock_timestamp();
 if new.decision_kind='independent_no_action' then
  if new.next_due_at is not null or r.observed_continued_holds>0 or r.observed_overdue_plans>0 then
   raise exception 'No-action decision requires no active hold or overdue recurrence'; end if;
 elsif new.next_due_at is null or new.next_due_at<=new.decided_at
  or new.next_due_at>new.decided_at+interval '90 days' then
  raise exception 'Independent follow-up must be due within 90 days'; end if;
 return new;
end $$;
create trigger owner_hold_recurrence_review_guard before insert on public.owner_export_hold_recurrence_reviews
 for each row execute function icamp_private.owner_hold_recurrence_review_guard();
create trigger owner_hold_recurrence_decision_guard before insert on public.owner_export_hold_recurrence_decisions
 for each row execute function icamp_private.owner_hold_recurrence_decision_guard();
create trigger owner_hold_recurrence_review_immutable before update or delete on public.owner_export_hold_recurrence_reviews
 for each row execute function icamp_private.winterization_append_only();
create trigger owner_hold_recurrence_decision_immutable before update or delete on public.owner_export_hold_recurrence_decisions
 for each row execute function icamp_private.winterization_append_only();
do $security$ declare name text; role_name text; begin
 foreach name in array array['owner_export_hold_recurrence_reviews','owner_export_hold_recurrence_decisions'] loop
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
create policy owner_recurrence_review_insert on public.owner_export_hold_recurrence_reviews for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy owner_recurrence_decision_insert on public.owner_export_hold_recurrence_decisions for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and decided_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_hold_recurrence_review_guard() from public;
revoke all on function icamp_private.owner_hold_recurrence_decision_guard() from public;
