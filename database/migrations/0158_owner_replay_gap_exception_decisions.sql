-- Build 128: immutable owner replay-gap decisions and independent closure proof continuity.
-- An audit decision cannot release operational holds or affect transfers/payments.
create table public.owner_export_independent_recheck_owner_decisions (
 id uuid primary key,
 independent_recheck_id uuid not null unique references public.owner_export_independent_disposition_rechecks(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 decision_kind text not null check(decision_kind in
  ('continue_replay_followup','submit_replay_gap_evidence',
   'renew_escalation_exception','acknowledge_closure_proof')),
 next_due_at timestamptz,
 observed_recheck_days_overdue integer not null default 0 check(observed_recheck_days_overdue>=0),
 observed_peer_open_rechecks integer not null default 0 check(observed_peer_open_rechecks>=0),
 observed_peer_overdue_rechecks integer not null default 0 check(observed_peer_overdue_rechecks>=0),
 observed_prior_escalation_decisions integer not null default 0 check(observed_prior_escalation_decisions>=0),
 observed_recent_independent_escalations integer not null default 0 check(observed_recent_independent_escalations>=0),
 observed_replay_is_newer boolean not null default false,
 observed_closure_proof_chain_complete boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 decision_note text not null check(char_length(trim(decision_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint independent_recheck_owner_pair check(source_campground_id<>target_campground_id),
 constraint independent_recheck_owner_due check(
  (decision_kind='acknowledge_closure_proof' and next_due_at is null)
  or (decision_kind<>'acknowledge_closure_proof' and next_due_at is not null))
);
create index independent_recheck_owner_decision_pair_idx on public.owner_export_independent_recheck_owner_decisions
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create function icamp_private.independent_recheck_owner_decision_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare recheck_record record; disposition_record record; owner_record record;
 closeout_record record; signoff_record record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,128128));
 select * into recheck_record from public.owner_export_independent_disposition_rechecks
  where id=new.independent_recheck_id;
 if recheck_record.id is null or recheck_record.source_campground_id<>new.source_campground_id
  or recheck_record.target_campground_id<>new.target_campground_id then
  raise exception 'Replay-gap decision must match the independent recheck and ordered campground pair'; end if;
 if new.recorded_by_user_id=recheck_record.reviewed_by_user_id then
  raise exception 'An independent rechecker cannot approve their own replay-gap outcome'; end if;
 select * into disposition_record from public.owner_export_owner_evidence_independent_dispositions
  where id=recheck_record.independent_disposition_id;
 select * into owner_record from public.owner_export_independent_closeout_owner_outcomes
  where id=disposition_record.owner_outcome_id;
 select * into closeout_record from public.owner_export_signoff_independent_closeout_reviews
  where id=owner_record.closeout_review_id;
 select * into signoff_record from public.owner_export_closure_audit_owner_signoffs
  where id=closeout_record.owner_signoff_id;
 new.recorded_at:=clock_timestamp();
 new.observed_replay_is_newer:=recheck_record.observed_replay_is_newer;
 new.observed_closure_proof_chain_complete:=(
  recheck_record.recheck_kind='confirm_closure_continuity_recheck'
  and disposition_record.disposition_kind='verify_closure_continuity'
  and owner_record.outcome_kind='acknowledge_independent_closeout'
  and recheck_record.replay_owner_outcome_id=owner_record.id
  and closeout_record.review_kind='independent_exception_closed'
  and signoff_record.signoff_kind='acknowledge_independent_closure');
 select count(*) filter(where r.recheck_kind<>'confirm_closure_continuity_recheck')::int,
        count(*) filter(where r.recheck_kind<>'confirm_closure_continuity_recheck'
          and r.next_due_at<new.recorded_at)::int,
        count(*) filter(where r.recheck_kind='renew_escalation_recheck'
          and r.rechecked_at>=new.recorded_at-interval '90 days')::int
 into new.observed_peer_open_rechecks,new.observed_peer_overdue_rechecks,
      new.observed_recent_independent_escalations
 from public.owner_export_independent_disposition_rechecks r
 where r.source_campground_id=new.source_campground_id and r.target_campground_id=new.target_campground_id
  and r.id<>recheck_record.id;
 select count(*)::int into new.observed_prior_escalation_decisions
 from public.owner_export_independent_recheck_owner_decisions d
 where d.source_campground_id=new.source_campground_id and d.target_campground_id=new.target_campground_id
  and d.decision_kind='renew_escalation_exception'
  and d.recorded_at>=new.recorded_at-interval '90 days';
 new.observed_recheck_days_overdue:=case when recheck_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.recorded_at-recheck_record.next_due_at))/86400))::int end;
 if recheck_record.recheck_kind='confirm_closure_continuity_recheck' then
  if new.decision_kind<>'acknowledge_closure_proof'
   or not new.observed_closure_proof_chain_complete or new.next_due_at is not null then
   raise exception 'Closure proof requires the fully linked independent closeout chain'; end if;
  if new.observed_peer_open_rechecks>0 or new.observed_peer_overdue_rechecks>0
   or new.observed_prior_escalation_decisions>0 or new.observed_recent_independent_escalations>0 then
   raise exception 'Closure proof cannot disregard unresolved peers or recent escalations'; end if;
 else
  if new.decision_kind='acknowledge_closure_proof' then
   raise exception 'An open independent recheck cannot be acknowledged as closed'; end if;
  if new.next_due_at is null or new.next_due_at<=new.recorded_at
   or new.next_due_at>new.recorded_at+interval '90 days' then
   raise exception 'Owner evidence gap follow-up must be due within 90 days'; end if;
  if (recheck_record.recheck_kind='renew_escalation_recheck'
   or new.observed_recheck_days_overdue>=30
   or new.observed_peer_overdue_rechecks>0
   or new.observed_prior_escalation_decisions>=2
   or new.observed_recent_independent_escalations>=2)
   and new.decision_kind<>'renew_escalation_exception' then
   raise exception 'Recurrent, escalated or long-overdue gaps require explicit owner escalation renewal'; end if;
  if new.decision_kind='continue_replay_followup'
   and (recheck_record.recheck_kind<>'continue_followup_watch'
    or recheck_record.next_due_at<new.recorded_at
    or new.observed_peer_open_rechecks>0 or new.observed_replay_is_newer) then
   raise exception 'Passive replay follow-up requires timely unchanged evidence and no open peer rechecks'; end if;
 end if;
 return new;
end $$;
create trigger independent_recheck_owner_decision_guard before insert on public.owner_export_independent_recheck_owner_decisions
 for each row execute function icamp_private.independent_recheck_owner_decision_guard();
create trigger independent_recheck_owner_decision_immutable before update or delete on public.owner_export_independent_recheck_owner_decisions
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_independent_recheck_owner_decisions enable row level security;
alter table public.owner_export_independent_recheck_owner_decisions force row level security;
revoke all on public.owner_export_independent_recheck_owner_decisions from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_independent_recheck_owner_decisions from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_independent_recheck_owner_decisions to icamp_app;
create policy independent_recheck_owner_decision_read on public.owner_export_independent_recheck_owner_decisions
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy independent_recheck_owner_decision_insert on public.owner_export_independent_recheck_owner_decisions
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.independent_recheck_owner_decision_guard() from public;
