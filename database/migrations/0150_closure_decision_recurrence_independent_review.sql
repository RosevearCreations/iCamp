-- Build 120: independently review an owner closure decision against a frozen
-- pair-wide recurrence/overdue snapshot. No operational hold or case mutation.
create table public.owner_export_closure_followup_reviews (
 id uuid primary key,
 owner_decision_id uuid not null unique references public.owner_export_closure_owner_decisions(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in ('continue_exception','request_new_evidence','manual_escalation','confirm_audit_acknowledged')),
 next_due_at timestamptz,
 observed_recurring_decisions integer not null default 0 check(observed_recurring_decisions>=0),
 observed_overdue_decisions integer not null default 0 check(observed_overdue_decisions>=0),
 observed_escalation_decisions integer not null default 0 check(observed_escalation_decisions>=0),
 observed_owner_days_overdue integer not null default 0 check(observed_owner_days_overdue>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint closure_followup_review_pair check(source_campground_id<>target_campground_id),
 constraint closure_followup_review_due check(
  (review_kind='confirm_audit_acknowledged' and next_due_at is null)
  or (review_kind<>'confirm_audit_acknowledged' and next_due_at is not null))
);
create index closure_followup_review_pair_idx on public.owner_export_closure_followup_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create function icamp_private.closure_decision_independent_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare decision_record record; recheck_record record;
begin
 select * into decision_record from public.owner_export_closure_owner_decisions where id=new.owner_decision_id;
 if decision_record.id is null or decision_record.source_campground_id<>new.source_campground_id
  or decision_record.target_campground_id<>new.target_campground_id then
  raise exception 'Independent review requires a matching owner closure decision and directed pair'; end if;
 select * into recheck_record from public.owner_export_reconciliation_closure_rechecks where id=decision_record.closure_recheck_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(decision_record.id::text,120120));
 if new.reviewed_by_user_id=decision_record.decided_by_user_id or new.reviewed_by_user_id=recheck_record.rechecked_by_user_id then
  raise exception 'Independent reviewer must differ from owner decision-maker and closure rechecker'; end if;
 new.reviewed_at:=clock_timestamp();
 -- Snapshot previous owner decisions across the same ordered campground pair;
 -- unreviewed past-due decisions (including this one) are open escalations.
 select count(*) filter(where d.id<>decision_record.id and d.decision_kind<>'acknowledge_audit_closure'
         and d.decided_at>=new.reviewed_at-interval '90 days')::int,
        count(*) filter(where d.decision_kind<>'acknowledge_audit_closure'
         and d.next_due_at<new.reviewed_at and r.id is null)::int,
        count(*) filter(where d.decision_kind='manual_escalation'
         and d.decided_at>=new.reviewed_at-interval '90 days')::int
 into new.observed_recurring_decisions,new.observed_overdue_decisions,new.observed_escalation_decisions
 from public.owner_export_closure_owner_decisions d
 left join public.owner_export_closure_followup_reviews r on r.owner_decision_id=d.id
 where d.source_campground_id=new.source_campground_id and d.target_campground_id=new.target_campground_id;
 new.observed_owner_days_overdue:=case when decision_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.reviewed_at-decision_record.next_due_at))/86400))::int end;
 if decision_record.decision_kind<>'acknowledge_audit_closure' and new.review_kind='confirm_audit_acknowledged' then
  raise exception 'An open owner exception cannot be independently confirmed closed'; end if;
 if new.review_kind='confirm_audit_acknowledged' then
  if decision_record.decision_kind<>'acknowledge_audit_closure' or new.observed_overdue_decisions>0
   or new.observed_recurring_decisions>0 then
   raise exception 'Audit confirmation requires an acknowledged closure and no captured open recurrence or overdue decisions'; end if;
  if new.next_due_at is not null then raise exception 'Confirmed audit has no pending due date'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.reviewed_at
   or new.next_due_at>new.reviewed_at+interval '90 days' then
   raise exception 'Independent follow-up must be due within 90 days'; end if;
  if new.observed_owner_days_overdue>=30 and new.review_kind<>'manual_escalation' then
   raise exception 'Owner follow-ups overdue 30+ days require independent manual escalation'; end if;
  if decision_record.next_due_at<new.reviewed_at and new.review_kind='continue_exception' then
   raise exception 'Overdue owner follow-ups require evidence review or escalation'; end if;
 end if;
 return new;
end $$;
create trigger closure_decision_independent_review_guard before insert on public.owner_export_closure_followup_reviews
 for each row execute function icamp_private.closure_decision_independent_review_guard();
create trigger closure_decision_independent_review_immutable before update or delete on public.owner_export_closure_followup_reviews
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_closure_followup_reviews enable row level security;
alter table public.owner_export_closure_followup_reviews force row level security;
revoke all on public.owner_export_closure_followup_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_closure_followup_reviews from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_closure_followup_reviews to icamp_app;
create policy closure_followup_review_read on public.owner_export_closure_followup_reviews for select to icamp_app using(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id));
create policy closure_followup_review_insert on public.owner_export_closure_followup_reviews for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.closure_decision_independent_review_guard() from public;
