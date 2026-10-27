-- Build 130: source-linked, append-only closure recurrence, owner reopening,
-- and independent follow-up evidence. No operational release or money movement.
create table public.owner_export_closure_recurrence_events (
 id uuid primary key,
 proof_review_id uuid not null references public.owner_export_owner_decision_independent_continuity_reviews(id),
 prior_event_id uuid unique references public.owner_export_closure_recurrence_events(id),
 root_reopen_id uuid references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 event_kind text not null check(event_kind in
  ('independent_recurrence_check','owner_exception_reopen','independent_followup_verify')),
 outcome_kind text not null check(outcome_kind in
  ('continuity_stable','recurrence_gap','recurrence_escalated',
   'reopen_evidence','reopen_escalation',
   'verify_followup_evidence','request_more_followup_evidence','renew_followup_escalation')),
 owner_evidence_decision_id uuid references public.owner_export_independent_recheck_owner_decisions(id),
 next_due_at timestamptz,
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_recent_owner_escalations integer not null default 0 check(observed_recent_owner_escalations>=0),
 observed_original_proof_verified boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 event_note text not null check(char_length(trim(event_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint closure_recurrence_ordered_pair check(source_campground_id<>target_campground_id),
 constraint closure_recurrence_due check(
  (outcome_kind='verify_followup_evidence' and next_due_at is null)
  or (outcome_kind<>'verify_followup_evidence' and next_due_at is not null))
);
create index closure_recurrence_pair_history_idx
 on public.owner_export_closure_recurrence_events
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create index closure_recurrence_proof_review_idx
 on public.owner_export_closure_recurrence_events
 (proof_review_id,recorded_at desc,id desc);
create function icamp_private.closure_recurrence_event_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare proof_record record; original_record record; prior_record record;
 check_record record; replay_record record; reopen_record record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,130130));
 select * into proof_record from public.owner_export_owner_decision_independent_continuity_reviews
  where id=new.proof_review_id;
 if proof_record.id is null or proof_record.review_kind<>'confirm_proof_continuity'
  or proof_record.source_campground_id<>new.source_campground_id
  or proof_record.target_campground_id<>new.target_campground_id then
  raise exception 'Recurrence monitoring requires verified proof from the same ordered campground pair'; end if;
 select * into original_record from public.owner_export_independent_recheck_owner_decisions
  where id=proof_record.owner_decision_id;
 new.recorded_at:=clock_timestamp();
 new.observed_original_proof_verified:=proof_record.observed_prior_chain_complete
  and original_record.observed_closure_proof_chain_complete
  and original_record.decision_kind='acknowledge_closure_proof';
 if not new.observed_original_proof_verified then
  raise exception 'Original source-linked closure proof is incomplete'; end if;
 select count(*)::int into new.observed_open_peer_recurrences
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='independent_recurrence_check'
  and e.outcome_kind<>'continuity_stable'
  and not exists(
   with recursive followup_chain as (
    select x.id,x.event_kind,x.outcome_kind from public.owner_export_closure_recurrence_events x
     where x.prior_event_id=e.id
    union all
    select x.id,x.event_kind,x.outcome_kind from public.owner_export_closure_recurrence_events x
     join followup_chain c on x.prior_event_id=c.id
   ) select 1 from followup_chain where event_kind='independent_followup_verify'
    and outcome_kind='verify_followup_evidence');
 select count(*) filter(where d.decision_kind<>'acknowledge_closure_proof')::int,
        count(*) filter(where d.decision_kind='renew_escalation_exception'
          and d.recorded_at>=new.recorded_at-interval '90 days')::int
 into new.observed_open_owner_dispositions,new.observed_recent_owner_escalations
 from public.owner_export_independent_recheck_owner_decisions d
 where d.source_campground_id=new.source_campground_id
  and d.target_campground_id=new.target_campground_id
  and d.id<>original_record.id;
 if new.event_kind='independent_recurrence_check' then
  if new.prior_event_id is not null or new.root_reopen_id is not null
   or new.owner_evidence_decision_id is not null
   or new.outcome_kind not in('continuity_stable','recurrence_gap','recurrence_escalated') then
   raise exception 'Independent recurrence check must originate at verified proof'; end if;
  if new.recorded_by_user_id in(proof_record.reviewed_by_user_id,original_record.recorded_by_user_id) then
   raise exception 'Recurrence reviewer must be independent of proof and owner disposition'; end if;
  if new.outcome_kind='continuity_stable' and
   (new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
    or new.observed_recent_owner_escalations>0) then
   raise exception 'Stable continuity cannot ignore unresolved or renewed peer exceptions'; end if;
  if exists(select 1 from public.owner_export_closure_recurrence_events e
    where e.proof_review_id=new.proof_review_id and e.event_kind='independent_recurrence_check'
    and e.outcome_kind<>'continuity_stable'
    and not exists(
     with recursive followup_chain as (
      select x.id,x.event_kind,x.outcome_kind from public.owner_export_closure_recurrence_events x
       where x.prior_event_id=e.id
      union all
      select x.id,x.event_kind,x.outcome_kind from public.owner_export_closure_recurrence_events x
       join followup_chain c on x.prior_event_id=c.id
     ) select 1 from followup_chain where event_kind='independent_followup_verify'
      and outcome_kind='verify_followup_evidence')) then
   raise exception 'Resolve the earlier monitored recurrence before another check'; end if;
 elsif new.event_kind='owner_exception_reopen' then
  select * into prior_record from public.owner_export_closure_recurrence_events
   where id=new.prior_event_id;
  if prior_record.id is null or prior_record.event_kind<>'independent_recurrence_check'
   or prior_record.outcome_kind='continuity_stable'
   or prior_record.proof_review_id<>new.proof_review_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id
   or new.root_reopen_id is not null
   or new.owner_evidence_decision_id is not null
   or new.outcome_kind not in('reopen_evidence','reopen_escalation') then
   raise exception 'Owner exception reopening requires a matching independent recurrence finding'; end if;
  if new.recorded_by_user_id in(prior_record.recorded_by_user_id,proof_record.reviewed_by_user_id) then
   raise exception 'The recurrence reviewer cannot record their own owner reopening'; end if;
  new.observed_prior_days_overdue:=case when prior_record.next_due_at is null then 0
   else greatest(0,floor(extract(epoch from(new.recorded_at-prior_record.next_due_at))/86400))::int end;
  if (prior_record.outcome_kind='recurrence_escalated' or new.observed_prior_days_overdue>=30
   or new.observed_recent_owner_escalations>0)
   and new.outcome_kind<>'reopen_escalation' then
   raise exception 'Escalated or 30-day-overdue recurrence requires explicit owner reopening escalation'; end if;
 elsif new.event_kind='independent_followup_verify' then
  select * into prior_record from public.owner_export_closure_recurrence_events
   where id=new.prior_event_id;
  if prior_record.event_kind='owner_exception_reopen' then
   new.root_reopen_id:=prior_record.id;
  elsif prior_record.event_kind='independent_followup_verify'
    and prior_record.outcome_kind<>'verify_followup_evidence' then
   new.root_reopen_id:=prior_record.root_reopen_id;
  else
   raise exception 'Independent follow-up requires an owner reopening or pending previous follow-up'; end if;
  select * into reopen_record from public.owner_export_closure_recurrence_events
   where id=new.root_reopen_id;
  select * into check_record from public.owner_export_closure_recurrence_events
   where id=reopen_record.prior_event_id;
  if prior_record.id is null or reopen_record.id is null
   or reopen_record.event_kind<>'owner_exception_reopen'
   or reopen_record.proof_review_id<>new.proof_review_id
   or prior_record.proof_review_id<>new.proof_review_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id
   or reopen_record.source_campground_id<>new.source_campground_id
   or reopen_record.target_campground_id<>new.target_campground_id
   or check_record.event_kind<>'independent_recurrence_check'
   or new.outcome_kind not in('verify_followup_evidence','request_more_followup_evidence','renew_followup_escalation') then
   raise exception 'Follow-up verification requires matching owner reopening and independent recurrence evidence'; end if;
  if new.recorded_by_user_id in(prior_record.recorded_by_user_id,reopen_record.recorded_by_user_id,
    check_record.recorded_by_user_id,proof_record.reviewed_by_user_id) then
   raise exception 'Independent follow-up auditor must be distinct from the owner and earlier reviewers'; end if;
  new.observed_prior_days_overdue:=case when prior_record.next_due_at is null then 0
   else greatest(0,floor(extract(epoch from(new.recorded_at-prior_record.next_due_at))/86400))::int end;
  if new.outcome_kind='verify_followup_evidence' then
   select * into replay_record from public.owner_export_independent_recheck_owner_decisions
    where id=new.owner_evidence_decision_id;
   if replay_record.id is null or replay_record.source_campground_id<>new.source_campground_id
    or replay_record.target_campground_id<>new.target_campground_id
    or replay_record.recorded_at<=prior_record.recorded_at
    or replay_record.recorded_at<=reopen_record.recorded_at
    or replay_record.decision_kind not in('submit_replay_gap_evidence','acknowledge_closure_proof') then
    raise exception 'Verified follow-up requires a newer same-pair owner evidence disposition'; end if;
  else
   if new.owner_evidence_decision_id is not null then
    raise exception 'Unverified follow-up cannot cite a completed owner evidence disposition'; end if;
   if (new.observed_prior_days_overdue>=30 or reopen_record.outcome_kind='reopen_escalation'
    or new.observed_recent_owner_escalations>0)
    and new.outcome_kind<>'renew_followup_escalation' then
    raise exception 'Overdue or escalated follow-up requires renewed independent escalation'; end if;
  end if;
 else
  raise exception 'Unknown closure recurrence stage';
 end if;
 if new.outcome_kind='verify_followup_evidence' then
  if new.next_due_at is not null then
   raise exception 'Verified follow-up cannot leave a pending due date'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.recorded_at
   or new.next_due_at>new.recorded_at+interval '90 days' then
   raise exception 'Open recurrence audit follow-up must be due within 90 days'; end if;
 end if;
 return new;
end $$;
create trigger closure_recurrence_event_guard before insert
 on public.owner_export_closure_recurrence_events for each row
 execute function icamp_private.closure_recurrence_event_guard();
create trigger closure_recurrence_event_immutable before update or delete
 on public.owner_export_closure_recurrence_events for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_closure_recurrence_events enable row level security;
alter table public.owner_export_closure_recurrence_events force row level security;
revoke all on public.owner_export_closure_recurrence_events from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_closure_recurrence_events from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_closure_recurrence_events to icamp_app;
create policy closure_recurrence_event_read on public.owner_export_closure_recurrence_events
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy closure_recurrence_event_insert on public.owner_export_closure_recurrence_events
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.closure_recurrence_event_guard() from public;
