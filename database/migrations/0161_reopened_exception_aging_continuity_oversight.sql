-- Build 131: independently reassess aged reopened exceptions and retain
-- source-linked, append-only continuity recurrence oversight receipts.
-- Audit observations never release an operational hold or modify money.
create table public.owner_export_reopened_exception_aging_reviews (
 id uuid primary key,
 reopen_event_id uuid not null references public.owner_export_closure_recurrence_events(id),
 prior_review_id uuid unique references public.owner_export_reopened_exception_aging_reviews(id),
 verified_followup_event_id uuid references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in
  ('independent_followup_reassessment','continuity_recurrence_oversight')),
 outcome_kind text not null check(outcome_kind in
  ('evidence_gap_pending','evidence_aging_escalated','followup_evidence_reassessed',
   'continuity_watch_open','recurrence_exception_detected',
   'continuity_escalation_renewed','continuity_recheck_verified')),
 next_due_at timestamptz,
 observed_reopen_days_aging integer not null default 0 check(observed_reopen_days_aging>=0),
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_recent_owner_escalations integer not null default 0 check(observed_recent_owner_escalations>=0),
 observed_verified_followup_linked boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint reopened_aging_pair check(source_campground_id<>target_campground_id),
 constraint reopened_aging_due check(
  (outcome_kind='continuity_recheck_verified' and next_due_at is null)
  or (outcome_kind<>'continuity_recheck_verified' and next_due_at is not null)),
 constraint reopened_aging_stage check(
  (review_kind='independent_followup_reassessment'
   and outcome_kind in('evidence_gap_pending','evidence_aging_escalated','followup_evidence_reassessed'))
  or (review_kind='continuity_recurrence_oversight'
   and outcome_kind in('continuity_watch_open','recurrence_exception_detected',
    'continuity_escalation_renewed','continuity_recheck_verified'))),
 constraint reopened_aging_verified_link check(
  (outcome_kind in('followup_evidence_reassessed','continuity_recheck_verified'))
   = (verified_followup_event_id is not null))
);
create unique index reopened_aging_first_reassessment_idx
 on public.owner_export_reopened_exception_aging_reviews(reopen_event_id)
 where review_kind='independent_followup_reassessment';
create index reopened_aging_pair_history_idx
 on public.owner_export_reopened_exception_aging_reviews
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create index reopened_aging_open_due_idx
 on public.owner_export_reopened_exception_aging_reviews(next_due_at)
 where next_due_at is not null;

create function icamp_private.reopened_exception_aging_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare reopen_record record; check_record record; proof_record record;
 prior_record record; verified_record record; owner_record record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,130130));
 select * into reopen_record from public.owner_export_closure_recurrence_events
  where id=new.reopen_event_id;
 if reopen_record.id is null or reopen_record.event_kind<>'owner_exception_reopen'
  or reopen_record.source_campground_id<>new.source_campground_id
  or reopen_record.target_campground_id<>new.target_campground_id then
  raise exception 'A matching owner-reopened Build 130 exception is required'; end if;
 select * into check_record from public.owner_export_closure_recurrence_events
  where id=reopen_record.prior_event_id;
 select * into proof_record from public.owner_export_owner_decision_independent_continuity_reviews
  where id=reopen_record.proof_review_id;
 if check_record.event_kind<>'independent_recurrence_check'
  or not reopen_record.observed_original_proof_verified
  or proof_record.review_kind<>'confirm_proof_continuity' then
  raise exception 'Reopened exception must retain original independently verified proof'; end if;
 new.recorded_at:=clock_timestamp();
 new.observed_reopen_days_aging:=greatest(0,floor(extract(epoch from
  (new.recorded_at-reopen_record.recorded_at))/86400))::int;
 select count(*)::int into new.observed_open_peer_recurrences
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='independent_recurrence_check'
  and e.id<>check_record.id
  and e.outcome_kind<>'continuity_stable'
  and not exists (
   with recursive followup_chain as (
    select x.id,x.event_kind,x.outcome_kind
     from public.owner_export_closure_recurrence_events x where x.prior_event_id=e.id
    union all
    select x.id,x.event_kind,x.outcome_kind
     from public.owner_export_closure_recurrence_events x
     join followup_chain c on x.prior_event_id=c.id
   ) select 1 from followup_chain
    where event_kind='independent_followup_verify'
     and outcome_kind='verify_followup_evidence');
 select count(*) filter(where d.decision_kind<>'acknowledge_closure_proof')::int,
        count(*) filter(where d.decision_kind='renew_escalation_exception'
          and d.recorded_at>=new.recorded_at-interval '90 days')::int
 into new.observed_open_owner_dispositions,new.observed_recent_owner_escalations
 from public.owner_export_independent_recheck_owner_decisions d
 where d.source_campground_id=new.source_campground_id
  and d.target_campground_id=new.target_campground_id;
 if new.verified_followup_event_id is not null then
  select * into verified_record from public.owner_export_closure_recurrence_events
   where id=new.verified_followup_event_id;
  new.observed_verified_followup_linked:=verified_record.event_kind='independent_followup_verify'
   and verified_record.outcome_kind='verify_followup_evidence'
   and verified_record.root_reopen_id=new.reopen_event_id
   and verified_record.source_campground_id=new.source_campground_id
   and verified_record.target_campground_id=new.target_campground_id
   and verified_record.recorded_at>reopen_record.recorded_at
   and verified_record.owner_evidence_decision_id is not null;
  if not coalesce(new.observed_verified_followup_linked,false) then
   raise exception 'A same-pair, post-reopening, verified Build 130 receipt is required'; end if;
  select * into owner_record from public.owner_export_independent_recheck_owner_decisions
   where id=verified_record.owner_evidence_decision_id;
  if owner_record.id is null or owner_record.recorded_at<=reopen_record.recorded_at then
   raise exception 'Linked owner evidence must be newer than the reopening'; end if;
 end if;
 if new.review_kind='independent_followup_reassessment' then
  if new.prior_review_id is not null or new.outcome_kind not in
   ('evidence_gap_pending','evidence_aging_escalated','followup_evidence_reassessed') then
   raise exception 'The first aging review must be an independent reassessment'; end if;
  if new.recorded_by_user_id in(reopen_record.recorded_by_user_id,
    check_record.recorded_by_user_id,proof_record.reviewed_by_user_id) or
    (new.verified_followup_event_id is not null and
     new.recorded_by_user_id=verified_record.recorded_by_user_id) then
   raise exception 'Reassessment reviewer must be independent of the owner and source reviewers'; end if;
  new.observed_prior_days_overdue:=case when reopen_record.next_due_at is null then 0
   else greatest(0,floor(extract(epoch from
    (new.recorded_at-reopen_record.next_due_at))/86400))::int end;
  if (new.observed_prior_days_overdue>=30
   or reopen_record.outcome_kind='reopen_escalation')
   and new.outcome_kind='evidence_gap_pending' then
   raise exception 'Overdue or escalated reopening requires an explicit escalation or verified evidence'; end if;
 elsif new.review_kind='continuity_recurrence_oversight' then
  select * into prior_record from public.owner_export_reopened_exception_aging_reviews
   where id=new.prior_review_id;
  if prior_record.id is null or prior_record.reopen_event_id<>new.reopen_event_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id
   or prior_record.outcome_kind='continuity_recheck_verified' then
   raise exception 'Continuity oversight must follow a live same-exception review'; end if;
  if new.recorded_by_user_id in(prior_record.recorded_by_user_id,
    reopen_record.recorded_by_user_id,check_record.recorded_by_user_id,
    proof_record.reviewed_by_user_id) or
    (new.verified_followup_event_id is not null and
     new.recorded_by_user_id=verified_record.recorded_by_user_id) then
   raise exception 'Continuity reviewer must be independent of the preceding review and source chain'; end if;
  new.observed_prior_days_overdue:=case when prior_record.next_due_at is null then 0
   else greatest(0,floor(extract(epoch from
    (new.recorded_at-prior_record.next_due_at))/86400))::int end;
  if new.outcome_kind='continuity_recheck_verified' and
   (new.observed_open_peer_recurrences>0
    or new.observed_open_owner_dispositions>0
    or new.observed_recent_owner_escalations>0) then
   raise exception 'Independent continuity cannot close with unresolved peer or owner exceptions'; end if;
  if (new.observed_prior_days_overdue>=30
   or prior_record.outcome_kind in('evidence_aging_escalated','continuity_escalation_renewed'))
   and new.outcome_kind in('continuity_watch_open','recurrence_exception_detected') then
   raise exception 'Aged or escalated continuity watch requires renewed escalation or verified proof'; end if;
 else
  raise exception 'Unknown reopened exception review kind'; end if;
 if new.outcome_kind='continuity_recheck_verified' then
  if new.next_due_at is not null then
   raise exception 'Verified continuity cannot retain an open date'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.recorded_at
   or new.next_due_at>new.recorded_at+interval '90 days' then
   raise exception 'Open reopened-exception follow-up must be due within 90 days'; end if;
 end if;
 return new;
end $$;
create trigger reopened_exception_aging_guard before insert
 on public.owner_export_reopened_exception_aging_reviews for each row
 execute function icamp_private.reopened_exception_aging_guard();
create trigger reopened_exception_aging_immutable before update or delete
 on public.owner_export_reopened_exception_aging_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_reopened_exception_aging_reviews enable row level security;
alter table public.owner_export_reopened_exception_aging_reviews force row level security;
revoke all on public.owner_export_reopened_exception_aging_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_reopened_exception_aging_reviews from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_reopened_exception_aging_reviews to icamp_app;
create policy reopened_exception_aging_read on public.owner_export_reopened_exception_aging_reviews
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy reopened_exception_aging_insert on public.owner_export_reopened_exception_aging_reviews
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.reopened_exception_aging_guard() from public;
