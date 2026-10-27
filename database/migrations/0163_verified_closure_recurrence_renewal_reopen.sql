-- Build 133: monitor completed Build 132 closure, independently recheck
-- evidence, and audit overdue exception reopening. Immutable observations
-- do not release holds, create new operational cases or move money.
create table public.owner_export_verified_closure_monitors (
 id uuid primary key,
 closure_followup_id uuid not null references public.owner_export_continuity_resolution_followups(id),
 prior_monitor_id uuid unique references public.owner_export_verified_closure_monitors(id),
 linked_reopen_event_id uuid references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 monitor_kind text not null check(monitor_kind in
  ('verified_closure_recurrence_monitor','independent_evidence_renewal',
   'overdue_exception_reopening_audit')),
 outcome_kind text not null check(outcome_kind in
  ('closure_watch_stable','recurrence_evidence_gap','recurrence_watch_escalated',
   'renewal_evidence_pending','renewal_evidence_rechecked','renewal_escalated',
   'owner_reopening_required','verified_reopening_linked')),
 next_due_at timestamptz,
 observed_proof_age_days integer not null default 0 check(observed_proof_age_days>=0),
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_recent_owner_escalations integer not null default 0 check(observed_recent_owner_escalations>=0),
 observed_original_verified_closure boolean not null default false,
 observed_linked_reopening_verified boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 monitor_note text not null check(char_length(trim(monitor_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint verified_closure_monitor_pair check(source_campground_id<>target_campground_id),
 constraint verified_closure_monitor_stage check(
  (monitor_kind='verified_closure_recurrence_monitor' and outcome_kind in
   ('closure_watch_stable','recurrence_evidence_gap','recurrence_watch_escalated'))
  or (monitor_kind='independent_evidence_renewal' and outcome_kind in
   ('renewal_evidence_pending','renewal_evidence_rechecked','renewal_escalated'))
  or (monitor_kind='overdue_exception_reopening_audit' and outcome_kind in
   ('owner_reopening_required','verified_reopening_linked'))),
 constraint verified_closure_monitor_link check(
  (outcome_kind='verified_reopening_linked')=(linked_reopen_event_id is not null)),
 constraint verified_closure_monitor_due check(
  (outcome_kind='verified_reopening_linked' and next_due_at is null)
  or (outcome_kind<>'verified_reopening_linked' and next_due_at is not null))
);
create unique index verified_closure_monitor_first_idx
 on public.owner_export_verified_closure_monitors(closure_followup_id)
 where prior_monitor_id is null;
create index verified_closure_monitor_pair_history_idx
 on public.owner_export_verified_closure_monitors
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create index verified_closure_monitor_due_idx
 on public.owner_export_verified_closure_monitors(next_due_at)
 where next_due_at is not null;
create index verified_closure_monitor_closure_idx
 on public.owner_export_verified_closure_monitors(closure_followup_id);
create index verified_closure_monitor_reopen_idx
 on public.owner_export_verified_closure_monitors(linked_reopen_event_id)
 where linked_reopen_event_id is not null;

create function icamp_private.verified_closure_monitor_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare closure_record record; proof_event record; prior_record record;
 reopened_record record; source_due timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,130130));
 select * into closure_record from public.owner_export_continuity_resolution_followups
  where id=new.closure_followup_id;
 if closure_record.id is null or closure_record.followup_kind<>'verified_closure_followup'
  or closure_record.outcome_kind<>'closure_followup_verified'
  or not closure_record.observed_verified_followup_linked
  or closure_record.source_campground_id<>new.source_campground_id
  or closure_record.target_campground_id<>new.target_campground_id then
  raise exception 'Build 133 requires an independently verified same-pair Build 132 closure'; end if;
 select * into proof_event from public.owner_export_closure_recurrence_events
  where id=closure_record.verified_followup_event_id;
 new.observed_original_verified_closure:=proof_event.event_kind='independent_followup_verify'
  and proof_event.outcome_kind='verify_followup_evidence'
  and proof_event.source_campground_id=new.source_campground_id
  and proof_event.target_campground_id=new.target_campground_id
  and proof_event.recorded_at<=closure_record.recorded_at;
 if not coalesce(new.observed_original_verified_closure,false) then
  raise exception 'Verified closure source proof must remain linked and earlier than the audit'; end if;
 new.recorded_at:=clock_timestamp();
 new.observed_proof_age_days:=greatest(0,floor(extract(epoch from
  (new.recorded_at-proof_event.recorded_at))/86400))::int;
 select count(*)::int into new.observed_open_peer_recurrences
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='independent_recurrence_check'
  and e.outcome_kind<>'continuity_stable'
  and not exists (
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
  and d.target_campground_id=new.target_campground_id;
 if new.prior_monitor_id is null then
  if new.monitor_kind<>'verified_closure_recurrence_monitor' then
   raise exception 'Begin with verified closure recurrence monitoring'; end if;
  source_due:=null;
 else
  select * into prior_record from public.owner_export_verified_closure_monitors
   where id=new.prior_monitor_id;
  if prior_record.id is null or prior_record.closure_followup_id<>new.closure_followup_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id
   or prior_record.outcome_kind='verified_reopening_linked' then
   raise exception 'Build 133 review must follow the same open closure audit chain'; end if;
  if not (
   (prior_record.monitor_kind='verified_closure_recurrence_monitor' and
    (new.monitor_kind='independent_evidence_renewal' or
     (prior_record.outcome_kind='closure_watch_stable' and
      new.monitor_kind='verified_closure_recurrence_monitor')))
   or (prior_record.monitor_kind='independent_evidence_renewal' and
    ((prior_record.outcome_kind='renewal_evidence_rechecked' and
      new.monitor_kind='verified_closure_recurrence_monitor')
     or (prior_record.outcome_kind<>'renewal_evidence_rechecked' and
      new.monitor_kind in('independent_evidence_renewal','overdue_exception_reopening_audit'))))
   or (prior_record.monitor_kind='overdue_exception_reopening_audit' and
     new.monitor_kind='overdue_exception_reopening_audit')
  ) then raise exception 'Recurrence monitoring, evidence renewal and overdue reopening must remain in order'; end if;
  if new.recorded_by_user_id=prior_record.recorded_by_user_id then
   raise exception 'Independent evidence reviewer must differ from the previous reviewer'; end if;
  source_due:=prior_record.next_due_at;
 end if;
 if new.recorded_by_user_id in(closure_record.recorded_by_user_id,
   proof_event.recorded_by_user_id) then
  raise exception 'Independent closure reviewer must differ from source proof reviewers'; end if;
 new.observed_prior_days_overdue:=case when source_due is null then 0
  else greatest(0,floor(extract(epoch from(new.recorded_at-source_due))/86400))::int end;
 if new.outcome_kind in('closure_watch_stable','renewal_evidence_pending') and
  new.observed_prior_days_overdue>=30 then
  raise exception 'Thirty-day overdue proof requires escalation or verified follow-up'; end if;
 if new.outcome_kind='closure_watch_stable' and
  (new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
   or new.observed_recent_owner_escalations>0) then
  raise exception 'Stable recurrence cannot ignore open peer or owner exceptions'; end if;
 if new.monitor_kind='overdue_exception_reopening_audit' and
  new.prior_monitor_id is not null
  and prior_record.monitor_kind='independent_evidence_renewal'
  and prior_record.outcome_kind not in('renewal_escalated')
  and new.observed_prior_days_overdue<30
  and new.observed_open_peer_recurrences=0
  and new.observed_open_owner_dispositions=0 then
  raise exception 'Reopening audit requires overdue evidence, a renewal escalation or unresolved exception'; end if;
 if new.linked_reopen_event_id is not null then
  select * into reopened_record from public.owner_export_closure_recurrence_events
   where id=new.linked_reopen_event_id;
  new.observed_linked_reopening_verified:=reopened_record.event_kind='owner_exception_reopen'
   and reopened_record.source_campground_id=new.source_campground_id
   and reopened_record.target_campground_id=new.target_campground_id
   and reopened_record.recorded_at>closure_record.recorded_at
   and reopened_record.observed_original_proof_verified;
  if not coalesce(new.observed_linked_reopening_verified,false) then
   raise exception 'Verified reopening must cite a newer same-pair owner reopening event'; end if;
  if new.recorded_by_user_id=reopened_record.recorded_by_user_id then
   raise exception 'Independent auditor cannot verify their own owner reopening'; end if;
 end if;
 if new.outcome_kind='verified_reopening_linked' then
  if new.prior_monitor_id is null or prior_record.outcome_kind<>'owner_reopening_required'
   or new.next_due_at is not null then
   raise exception 'Verified reopening must follow an owner-required reopening with no open due date'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.recorded_at
   or new.next_due_at>new.recorded_at+interval '90 days' then
   raise exception 'Open closure recurrence or renewal follow-up must be due within 90 days'; end if;
 end if;
 return new;
end $$;
create trigger verified_closure_monitor_guard before insert
 on public.owner_export_verified_closure_monitors for each row
 execute function icamp_private.verified_closure_monitor_guard();
create trigger verified_closure_monitor_immutable before update or delete
 on public.owner_export_verified_closure_monitors for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_verified_closure_monitors enable row level security;
alter table public.owner_export_verified_closure_monitors force row level security;
revoke all on public.owner_export_verified_closure_monitors from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_verified_closure_monitors from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_verified_closure_monitors to icamp_app;
create policy verified_closure_monitor_read on public.owner_export_verified_closure_monitors
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy verified_closure_monitor_insert on public.owner_export_verified_closure_monitors
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.verified_closure_monitor_guard() from public;
