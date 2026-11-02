-- Build 110: independent, append-only aging reassessment of a current owner decision.
-- This does not alter Build 105–109 receipts, cases, notes, decisions or closeout.
create table public.owner_export_oversight_reassessments (
 id uuid primary key,
 decision_id uuid not null references public.owner_export_oversight_decisions(id),
 review_id uuid not null references public.owner_export_oversight_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 assessment_kind text not null check(assessment_kind in
  ('continue_monitoring','evidence_needed','escalation_recommended','closure_recommended')),
 basis_case_id uuid references public.owner_export_exception_cases(id),
 next_due_at timestamptz,
 observed_unclosed_cases integer not null default 0 check(observed_unclosed_cases>=0),
 new_cases_since_review integer not null default 0 check(new_cases_since_review>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 reassessment_note text not null check(char_length(trim(reassessment_note)) between 12 and 800),
 reassessed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reassessed_at timestamptz not null default clock_timestamp(),
 constraint owner_oversight_reassessment_pair check(source_campground_id<>target_campground_id),
 constraint owner_oversight_reassessment_due check(
  (assessment_kind='closure_recommended' and next_due_at is null)
  or (assessment_kind<>'closure_recommended' and next_due_at is not null))
);
create index owner_oversight_reassessments_decision_idx on public.owner_export_oversight_reassessments
 (decision_id,reassessed_at desc,id desc);
create index owner_oversight_reassessments_pair_idx on public.owner_export_oversight_reassessments
 (source_campground_id,target_campground_id,reassessed_at desc,id desc);
create index owner_oversight_reassessments_actor_idx on public.owner_export_oversight_reassessments
 (reassessed_by_user_id);
create index owner_oversight_reassessments_case_idx on public.owner_export_oversight_reassessments
 (basis_case_id) where basis_case_id is not null;

create function icamp_private.owner_export_oversight_reassessment_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare decision_row record; review_row record; latest_id uuid; found_case boolean;
begin
 select * into decision_row from public.owner_export_oversight_decisions where id=new.decision_id;
 if decision_row.id is null then raise exception 'The selected owner decision is not available'; end if;
 select * into review_row from public.owner_export_oversight_reviews where id=decision_row.review_id;
 if review_row.id is null then raise exception 'The original owner review is not available'; end if;
 -- Share Build 109's review-level serialization lock: concurrent new decisions
 -- cannot make a signed independent reassessment refer to a stale decision.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(review_row.id::text,109109));
 select d.id into latest_id from public.owner_export_oversight_decisions d
  where d.review_id=review_row.id order by d.decided_at desc,d.id desc limit 1;
 if latest_id<>decision_row.id then
  raise exception 'Reassessment requires the latest owner decision for its review'; end if;
 if decision_row.decision_kind='closed_no_action' then
  raise exception 'A final no-action decision cannot be reassessed as a pending action'; end if;
 if new.reassessed_by_user_id=decision_row.decided_by_user_id then
  raise exception 'A different owner must independently reassess the original decision'; end if;
 if new.review_id<>review_row.id or new.source_campground_id<>decision_row.source_campground_id
  or new.target_campground_id<>decision_row.target_campground_id then
  raise exception 'Reassessment must preserve the original directed campground pair and review'; end if;
 new.reassessed_at:=clock_timestamp();
 if new.assessment_kind='closure_recommended' then
  if new.next_due_at is not null then
   raise exception 'A closure recommendation must not schedule an active reassessment'; end if;
 elsif new.next_due_at is null or new.next_due_at<=new.reassessed_at
  or new.next_due_at>new.reassessed_at+interval '90 days' then
  raise exception 'Pending reassessment requires a future due date within 90 days'; end if;

 -- Count actual exceptions from the original frozen period through the present,
 -- independently accepted Build 107 closeouts excluded from the unresolved count.
 select count(*) filter(where not exists(
   select 1 from public.owner_export_exception_reviews accepted
   where accepted.case_id=c.id and accepted.review_kind='accepted'))::int,
   count(*) filter(where c.opened_at>review_row.snapshot_as_of)::int
 into new.observed_unclosed_cases,new.new_cases_since_review
 from public.owner_export_exception_cases c
 where c.source_campground_id=review_row.source_campground_id
  and c.target_campground_id=review_row.target_campground_id
  and c.opened_at>=review_row.snapshot_as_of-(review_row.window_days*interval '1 day')
  and c.opened_at<=new.reassessed_at
  and (review_row.issue_kind='all' or c.issue_kind=review_row.issue_kind);

 if new.assessment_kind='closure_recommended'
  and (new.observed_unclosed_cases>0 or new.new_cases_since_review>0) then
  raise exception 'Closure cannot be recommended while unresolved or newly opened source cases require a fresh review'; end if;
 if new.assessment_kind='escalation_recommended' and new.basis_case_id is null then
  raise exception 'Manual escalation recommendation must cite an unresolved source exception case'; end if;
 if new.basis_case_id is not null then
  select exists(select 1 from public.owner_export_exception_cases c
    where c.id=new.basis_case_id
     and c.source_campground_id=review_row.source_campground_id
     and c.target_campground_id=review_row.target_campground_id
     and c.opened_at>=review_row.snapshot_as_of-(review_row.window_days*interval '1 day')
     and c.opened_at<=new.reassessed_at
     and (review_row.issue_kind='all' or c.issue_kind=review_row.issue_kind)
     and not exists(select 1 from public.owner_export_exception_reviews accepted
        where accepted.case_id=c.id and accepted.review_kind='accepted')) into found_case;
  if not found_case then raise exception 'Cited case is outside the pair/category/window or already independently closed'; end if;
 end if;
 return new;
end $$;
create trigger owner_export_oversight_reassessment_guard before insert
 on public.owner_export_oversight_reassessments for each row
 execute function icamp_private.owner_export_oversight_reassessment_guard();
create trigger owner_export_oversight_reassessment_immutable before update or delete
 on public.owner_export_oversight_reassessments for each row
 execute function icamp_private.winterization_append_only();

alter table public.owner_export_oversight_reassessments enable row level security;
alter table public.owner_export_oversight_reassessments force row level security;
revoke all on public.owner_export_oversight_reassessments from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_oversight_reassessments from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.owner_export_oversight_reassessments to icamp_app;
create policy owner_export_oversight_reassessment_read on public.owner_export_oversight_reassessments
 for select to icamp_app using(
  icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_export_oversight_reassessment_insert on public.owner_export_oversight_reassessments
 for insert to icamp_app with check(
  icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reassessed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_export_oversight_reassessment_guard() from public;
