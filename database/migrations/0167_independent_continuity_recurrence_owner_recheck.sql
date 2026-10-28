-- Build 137: independently watch continuity recurrence, age renewal exceptions,
-- then reverify owner audit evidence. Owner-only, append-only and non-operational.
create table public.owner_export_continuity_recurrence_audits (
 id uuid primary key,
 owner_continuity_id uuid not null references public.owner_export_renewal_freshness_decisions(id),
 prior_recheck_id uuid unique references public.owner_export_continuity_recurrence_audits(id),
 verified_followup_event_id uuid unique references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 recheck_kind text not null check(recheck_kind in
  ('independent_continuity_recurrence_watch',
   'renewal_exception_followup_aging','verified_owner_audit_recheck')),
 outcome_kind text not null check(outcome_kind in
  ('continuity_stable','continuity_recurrence_detected','continuity_escalation_required',
   'renewal_evidence_current','renewal_exception_overdue','renewal_exception_escalated',
   'owner_audit_reverified','owner_audit_on_hold','owner_audit_escalated')),
 next_due_at timestamptz not null,
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_proof_age_days integer not null default 0 check(observed_proof_age_days>=0),
 observed_new_reopenings integer not null default 0 check(observed_new_reopenings>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_recent_owner_escalations integer not null default 0 check(observed_recent_owner_escalations>=0),
 observed_open_renewal_exceptions integer not null default 0 check(observed_open_renewal_exceptions>=0),
 observed_overdue_renewal_reviews integer not null default 0 check(observed_overdue_renewal_reviews>=0),
 observed_verified_owner_proof boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 recheck_note text not null check(char_length(trim(recheck_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint continuity_recheck_pair check(source_campground_id<>target_campground_id),
 constraint continuity_recheck_kind_outcome check(
  (recheck_kind='independent_continuity_recurrence_watch' and outcome_kind in
   ('continuity_stable','continuity_recurrence_detected','continuity_escalation_required'))
  or (recheck_kind='renewal_exception_followup_aging' and outcome_kind in
   ('renewal_evidence_current','renewal_exception_overdue','renewal_exception_escalated'))
  or (recheck_kind='verified_owner_audit_recheck' and outcome_kind in
   ('owner_audit_reverified','owner_audit_on_hold','owner_audit_escalated'))),
 constraint continuity_recheck_verified_proof check(
  (outcome_kind='owner_audit_reverified')=(verified_followup_event_id is not null))
);
create unique index continuity_recheck_first_watch_idx
 on public.owner_export_continuity_recurrence_audits(owner_continuity_id)
 where prior_recheck_id is null;
create index continuity_recheck_pair_history_idx
 on public.owner_export_continuity_recurrence_audits
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index continuity_recheck_due_idx
 on public.owner_export_continuity_recurrence_audits(next_due_at);

create function icamp_private.continuity_recurrence_recheck_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare owner_record record; owner_comparison record; owner_watch record;
 baseline_proof record; owner_renewal record; resolved_record record;
 monitor_record record; baseline_reopen record; prior_record record;
 prior_watch record; verified_event record; latest_proof_at timestamptz;
 reference_due timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,137137));
 select * into owner_record from public.owner_export_renewal_freshness_decisions
  where id=new.owner_continuity_id;
 if owner_record.id is null or owner_record.audit_kind<>'owner_continuity_decision_audit'
  or owner_record.source_campground_id<>new.source_campground_id
  or owner_record.target_campground_id<>new.target_campground_id then
  raise exception 'Build 137 requires a same-pair Build 136 owner continuity audit'; end if;
 select * into owner_watch from public.owner_export_renewal_freshness_decisions
  where id=owner_record.prior_audit_id;
 select * into owner_comparison from public.owner_export_renewal_freshness_decisions
  where id=owner_watch.prior_audit_id;
 select * into baseline_proof from public.owner_export_closure_recurrence_events
  where id=owner_comparison.comparison_evidence_event_id;
 select * into owner_renewal from public.owner_export_escalation_resolution_renewals
  where id=owner_record.owner_renewal_id;
 select * into resolved_record from public.owner_export_reopening_followup_oversights
  where id=owner_renewal.resolved_oversight_id;
 select * into monitor_record from public.owner_export_verified_closure_monitors
  where id=resolved_record.verified_monitor_id;
 select * into baseline_reopen from public.owner_export_closure_recurrence_events
  where id=monitor_record.linked_reopen_event_id;
 if owner_watch.id is null or owner_comparison.id is null
  or owner_watch.audit_kind<>'reopening_watch_exception_reassessment'
  or owner_comparison.audit_kind<>'independent_renewal_freshness_comparison'
  or owner_comparison.owner_renewal_id<>owner_record.owner_renewal_id
  or owner_watch.owner_renewal_id<>owner_record.owner_renewal_id
  or baseline_reopen.id is null or baseline_proof.id is null
  or baseline_proof.root_reopen_id<>baseline_reopen.id
  or baseline_proof.event_kind<>'independent_followup_verify'
  or baseline_proof.outcome_kind<>'verify_followup_evidence'
  or not baseline_proof.observed_original_proof_verified then
  raise exception 'Owner recheck requires the original independently verified same-root proof chain'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_recheck_id is null then
  if new.recheck_kind<>'independent_continuity_recurrence_watch' then
   raise exception 'Continuity recurrence recheck begins with an independent watch'; end if;
  reference_due:=owner_record.next_due_at;
 else
  select * into prior_record from public.owner_export_continuity_recurrence_audits
   where id=new.prior_recheck_id;
  if prior_record.id is null or prior_record.owner_continuity_id<>new.owner_continuity_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Independent rechecks must remain on the same owner continuity chain'; end if;
  if not (
   (prior_record.recheck_kind='independent_continuity_recurrence_watch'
    and new.recheck_kind='renewal_exception_followup_aging')
   or (prior_record.recheck_kind='renewal_exception_followup_aging'
    and new.recheck_kind='verified_owner_audit_recheck')
   or (prior_record.recheck_kind='verified_owner_audit_recheck'
    and new.recheck_kind='independent_continuity_recurrence_watch')) then
   raise exception 'Independent watch, renewal aging and owner recheck must stay ordered'; end if;
  if prior_record.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'Independent reviewer must differ from preceding recheck reviewer'; end if;
  reference_due:=prior_record.next_due_at;
 end if;
 if new.reviewed_by_user_id in (
  owner_record.recorded_by_user_id,owner_watch.recorded_by_user_id,
  owner_comparison.recorded_by_user_id,baseline_proof.recorded_by_user_id,
  owner_renewal.recorded_by_user_id,baseline_reopen.recorded_by_user_id) then
  raise exception 'An evidence author cannot independently recheck their own source'; end if;
 new.observed_prior_days_overdue:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-reference_due))/86400))::int;
 select count(*)::int into new.observed_new_reopenings
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='owner_exception_reopen' and e.recorded_at>owner_record.recorded_at;
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
         and d.recorded_at>=new.reviewed_at-interval '90 days')::int
 into new.observed_open_owner_dispositions,new.observed_recent_owner_escalations
 from public.owner_export_independent_recheck_owner_decisions d
 where d.source_campground_id=new.source_campground_id
  and d.target_campground_id=new.target_campground_id;
 select count(*) filter(where a.outcome_kind in
   ('freshness_stale','freshness_gap_escalated','watch_reopened_exception',
    'watch_escalation_required','owner_evidence_renewal_due','owner_continuity_escalated'))::int,
  count(*) filter(where a.next_due_at<new.reviewed_at-interval '30 days')::int
 into new.observed_open_renewal_exceptions,new.observed_overdue_renewal_reviews
 from public.owner_export_renewal_freshness_decisions a
 where a.source_campground_id=new.source_campground_id
  and a.target_campground_id=new.target_campground_id
  and not exists (select 1 from public.owner_export_renewal_freshness_decisions later
   where later.prior_audit_id=a.id);
 latest_proof_at:=baseline_proof.recorded_at;
 if new.prior_recheck_id is not null then
  select max(e.recorded_at) into latest_proof_at
   from public.owner_export_continuity_recurrence_audits a
   join public.owner_export_closure_recurrence_events e
    on e.id=a.verified_followup_event_id
   where a.owner_continuity_id=new.owner_continuity_id;
  latest_proof_at:=greatest(coalesce(latest_proof_at,baseline_proof.recorded_at),
   baseline_proof.recorded_at);
 end if;
 if new.recheck_kind='verified_owner_audit_recheck' then
  select * into prior_watch from public.owner_export_continuity_recurrence_audits
   where id=prior_record.prior_recheck_id;
  if new.outcome_kind='owner_audit_reverified' and (
   prior_record.outcome_kind<>'renewal_evidence_current'
   or prior_watch.outcome_kind<>'continuity_stable') then
   raise exception 'Verified owner recheck requires stable independent watch and current renewal review'; end if;
  if new.verified_followup_event_id is not null then
   select * into verified_event from public.owner_export_closure_recurrence_events
    where id=new.verified_followup_event_id;
   new.observed_verified_owner_proof:=verified_event.id is not null
    and verified_event.event_kind='independent_followup_verify'
    and verified_event.outcome_kind='verify_followup_evidence'
    and verified_event.root_reopen_id=baseline_reopen.id
    and verified_event.source_campground_id=new.source_campground_id
    and verified_event.target_campground_id=new.target_campground_id
    and verified_event.observed_original_proof_verified
    and verified_event.recorded_at>latest_proof_at
    and verified_event.recorded_at>baseline_proof.recorded_at
    and verified_event.recorded_at<=new.reviewed_at;
   if not new.observed_verified_owner_proof then
    raise exception 'Owner recheck evidence must be newer verified same-root source proof'; end if;
   if new.reviewed_by_user_id=verified_event.recorded_by_user_id then
    raise exception 'Owner recheck reviewer cannot attest their own evidence event'; end if;
   latest_proof_at:=verified_event.recorded_at;
  end if;
 end if;
 new.observed_proof_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-latest_proof_at))/86400))::int;
 if new.outcome_kind in ('continuity_stable','renewal_evidence_current','owner_audit_reverified') and
  (owner_record.outcome_kind<>'owner_continuity_confirmed'
   or owner_watch.outcome_kind<>'watch_no_exception'
   or owner_comparison.outcome_kind<>'freshness_verified'
   or not owner_comparison.observed_fresh_source_verified
   or new.observed_proof_age_days>30 or new.observed_new_reopenings>0
   or new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
   or new.observed_recent_owner_escalations>0 or new.observed_open_renewal_exceptions>0
   or new.observed_overdue_renewal_reviews>0) then
  raise exception 'Positive owner continuity requires fresh proof and zero open renewal/reopening exceptions'; end if;
 if new.outcome_kind='renewal_evidence_current' and
  prior_record.outcome_kind<>'continuity_stable' then
  raise exception 'Renewal evidence current requires a stable preceding independent watch'; end if;
 if new.observed_prior_days_overdue>=30 and new.outcome_kind in
  ('continuity_stable','renewal_evidence_current','owner_audit_reverified',
   'owner_audit_on_hold') then
  raise exception 'Thirty-day overdue continuity evidence requires explicit exception or escalation'; end if;
 if new.next_due_at<=new.reviewed_at or
  new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Next independent recurrence review must be due within 90 days'; end if;
 return new;
end $$;
create trigger continuity_recurrence_recheck_guard before insert
 on public.owner_export_continuity_recurrence_audits for each row
 execute function icamp_private.continuity_recurrence_recheck_guard();
create trigger continuity_recurrence_recheck_immutable before update or delete
 on public.owner_export_continuity_recurrence_audits for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_continuity_recurrence_audits enable row level security;
alter table public.owner_export_continuity_recurrence_audits force row level security;
revoke all on public.owner_export_continuity_recurrence_audits from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_continuity_recurrence_audits from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_continuity_recurrence_audits to icamp_app;
create policy continuity_recheck_read on public.owner_export_continuity_recurrence_audits
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy continuity_recheck_insert on public.owner_export_continuity_recurrence_audits
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.continuity_recurrence_recheck_guard() from public;
