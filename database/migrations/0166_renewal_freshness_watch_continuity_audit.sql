-- Build 136: independently compare renewed evidence, reassess reopening watch
-- exceptions and audit owner continuity. Append-only, no operational effect.
create table public.owner_export_renewal_freshness_decisions (
 id uuid primary key,
 owner_renewal_id uuid not null references public.owner_export_escalation_resolution_renewals(id),
 prior_audit_id uuid unique references public.owner_export_renewal_freshness_decisions(id),
 comparison_evidence_event_id uuid unique references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 audit_kind text not null check(audit_kind in
  ('independent_renewal_freshness_comparison',
   'reopening_watch_exception_reassessment','owner_continuity_decision_audit')),
 outcome_kind text not null check(outcome_kind in
  ('freshness_verified','freshness_stale','freshness_gap_escalated',
   'watch_no_exception','watch_reopened_exception','watch_escalation_required',
   'owner_continuity_confirmed','owner_evidence_renewal_due','owner_continuity_escalated')),
 next_due_at timestamptz not null,
 observed_proof_age_days integer not null default 0 check(observed_proof_age_days>=0),
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_new_reopenings integer not null default 0 check(observed_new_reopenings>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_recent_owner_escalations integer not null default 0 check(observed_recent_owner_escalations>=0),
 observed_fresh_source_verified boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 audit_note text not null check(char_length(trim(audit_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint renewal_freshness_pair check(source_campground_id<>target_campground_id),
 constraint renewal_freshness_kind_outcome check(
  (audit_kind='independent_renewal_freshness_comparison' and outcome_kind in
   ('freshness_verified','freshness_stale','freshness_gap_escalated'))
  or (audit_kind='reopening_watch_exception_reassessment' and outcome_kind in
   ('watch_no_exception','watch_reopened_exception','watch_escalation_required'))
  or (audit_kind='owner_continuity_decision_audit' and outcome_kind in
   ('owner_continuity_confirmed','owner_evidence_renewal_due','owner_continuity_escalated'))),
 constraint renewal_freshness_proof_link check(
  (outcome_kind='freshness_verified')=(comparison_evidence_event_id is not null))
);
create unique index renewal_freshness_first_audit_idx
 on public.owner_export_renewal_freshness_decisions(owner_renewal_id)
 where prior_audit_id is null;
create index renewal_freshness_pair_history_idx
 on public.owner_export_renewal_freshness_decisions
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create index renewal_freshness_due_idx
 on public.owner_export_renewal_freshness_decisions(next_due_at);

create function icamp_private.renewal_freshness_decision_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare owner_renewal record; resolved_record record; monitor_record record;
 reopened_record record; baseline_proof record; comparison_proof record;
 prior_record record; prior_comparison record; reference_due timestamptz;
 comparison_proof_at timestamptz; freshest_prior_proof_at timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,136136));
 select * into owner_renewal from public.owner_export_escalation_resolution_renewals
  where id=new.owner_renewal_id;
 if owner_renewal.id is null or owner_renewal.renewal_kind<>'owner_evidence_renewal'
  or owner_renewal.source_campground_id<>new.source_campground_id
  or owner_renewal.target_campground_id<>new.target_campground_id then
  raise exception 'Build 136 requires a same-pair Build 135 owner evidence renewal'; end if;
 select * into resolved_record from public.owner_export_reopening_followup_oversights
  where id=owner_renewal.resolved_oversight_id;
 select * into monitor_record from public.owner_export_verified_closure_monitors
  where id=resolved_record.verified_monitor_id;
 select * into reopened_record from public.owner_export_closure_recurrence_events
  where id=monitor_record.linked_reopen_event_id;
 select * into baseline_proof from public.owner_export_closure_recurrence_events
  where id=coalesce(owner_renewal.renewal_evidence_event_id,
    resolved_record.verified_resolution_event_id);
 if resolved_record.id is null or resolved_record.outcome_kind<>'owner_escalation_resolved'
  or not resolved_record.observed_verified_resolution_linked
  or monitor_record.id is null or reopened_record.id is null
  or reopened_record.event_kind<>'owner_exception_reopen'
  or baseline_proof.id is null or baseline_proof.root_reopen_id<>reopened_record.id
  or baseline_proof.event_kind<>'independent_followup_verify'
  or baseline_proof.outcome_kind<>'verify_followup_evidence'
  or not baseline_proof.observed_original_proof_verified
  or baseline_proof.source_campground_id<>new.source_campground_id
  or baseline_proof.target_campground_id<>new.target_campground_id then
  raise exception 'Owner renewal freshness comparison requires verified same-root source proof'; end if;
 new.recorded_at:=clock_timestamp();
 if new.prior_audit_id is null then
  if new.audit_kind<>'independent_renewal_freshness_comparison' then
   raise exception 'Freshness audit must start with an independent comparison'; end if;
  reference_due:=owner_renewal.next_due_at;
 else
  select * into prior_record from public.owner_export_renewal_freshness_decisions
   where id=new.prior_audit_id;
  if prior_record.id is null or prior_record.owner_renewal_id<>new.owner_renewal_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Freshness, watch and continuity decisions must retain one owner renewal'; end if;
  if not (
   (prior_record.audit_kind='independent_renewal_freshness_comparison' and
    new.audit_kind='reopening_watch_exception_reassessment')
   or (prior_record.audit_kind='reopening_watch_exception_reassessment' and
    new.audit_kind='owner_continuity_decision_audit')
   or (prior_record.audit_kind='owner_continuity_decision_audit' and
    new.audit_kind='independent_renewal_freshness_comparison')
  ) then raise exception 'Freshness comparison, reopening recheck and owner audit must be ordered'; end if;
  if new.recorded_by_user_id=prior_record.recorded_by_user_id then
   raise exception 'Independent reviewer must differ from preceding evidence reviewer'; end if;
  reference_due:=prior_record.next_due_at;
 end if;
 if new.recorded_by_user_id in(owner_renewal.recorded_by_user_id,
   resolved_record.recorded_by_user_id,baseline_proof.recorded_by_user_id,
   monitor_record.recorded_by_user_id,reopened_record.recorded_by_user_id) then
  raise exception 'Source evidence author cannot independently audit their own renewal'; end if;
 new.observed_prior_days_overdue:=greatest(0,floor(extract(epoch from
  (new.recorded_at-reference_due))/86400))::int;
 select count(*)::int into new.observed_new_reopenings
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='owner_exception_reopen'
  and e.recorded_at>owner_renewal.recorded_at;
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
 if new.audit_kind='independent_renewal_freshness_comparison' then
  if new.comparison_evidence_event_id is not null then
   select * into comparison_proof from public.owner_export_closure_recurrence_events
    where id=new.comparison_evidence_event_id;
   select max(e.recorded_at) into freshest_prior_proof_at
   from public.owner_export_renewal_freshness_decisions d
   join public.owner_export_closure_recurrence_events e
    on e.id=d.comparison_evidence_event_id
   where d.owner_renewal_id=new.owner_renewal_id;
   new.observed_fresh_source_verified:=comparison_proof.id is not null
    and comparison_proof.event_kind='independent_followup_verify'
    and comparison_proof.outcome_kind='verify_followup_evidence'
    and comparison_proof.root_reopen_id=reopened_record.id
    and comparison_proof.source_campground_id=new.source_campground_id
    and comparison_proof.target_campground_id=new.target_campground_id
    and comparison_proof.observed_original_proof_verified
    and comparison_proof.recorded_at>coalesce(freshest_prior_proof_at,baseline_proof.recorded_at)
    and comparison_proof.recorded_at>baseline_proof.recorded_at
    and comparison_proof.recorded_at<=new.recorded_at;
   if not coalesce(new.observed_fresh_source_verified,false) then
    raise exception 'Comparison evidence must be independently verified and newer than prior same-root proof'; end if;
   if new.recorded_by_user_id=comparison_proof.recorded_by_user_id then
    raise exception 'Freshness reviewer cannot attest their own new source evidence'; end if;
   comparison_proof_at:=comparison_proof.recorded_at;
  else comparison_proof_at:=baseline_proof.recorded_at;
  end if;
 elsif new.audit_kind='reopening_watch_exception_reassessment' then
  prior_comparison:=prior_record;
  if new.outcome_kind='watch_no_exception' and
   (prior_comparison.outcome_kind<>'freshness_verified'
    or not prior_comparison.observed_fresh_source_verified) then
   raise exception 'Clear reopening watch requires independently refreshed source proof'; end if;
  select recorded_at into comparison_proof_at from public.owner_export_closure_recurrence_events
   where id=prior_comparison.comparison_evidence_event_id;
 elsif new.audit_kind='owner_continuity_decision_audit' then
  select * into prior_comparison from public.owner_export_renewal_freshness_decisions
   where id=prior_record.prior_audit_id;
  if new.outcome_kind='owner_continuity_confirmed' and
   (prior_record.outcome_kind<>'watch_no_exception'
    or prior_comparison.outcome_kind<>'freshness_verified'
    or not prior_comparison.observed_fresh_source_verified) then
   raise exception 'Owner continuity requires an independent exception-free renewal comparison'; end if;
  select recorded_at into comparison_proof_at from public.owner_export_closure_recurrence_events
   where id=prior_comparison.comparison_evidence_event_id;
 end if;
 new.observed_proof_age_days:=greatest(0,floor(extract(epoch from
  (new.recorded_at-coalesce(comparison_proof_at,baseline_proof.recorded_at)))/86400))::int;
 if new.outcome_kind in('freshness_verified','watch_no_exception','owner_continuity_confirmed') and
   (new.observed_proof_age_days>30 or new.observed_new_reopenings>0
    or new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
    or new.observed_recent_owner_escalations>0) then
  raise exception 'Continuity cannot be confirmed with stale proof or unresolved reopening/owner exceptions'; end if;
 if new.observed_prior_days_overdue>=30 and new.outcome_kind in
  ('freshness_verified','watch_no_exception','owner_evidence_renewal_due',
   'owner_continuity_confirmed') then
  raise exception 'Thirty-day overdue source proof requires explicit exception or escalation'; end if;
 if new.next_due_at<=new.recorded_at or new.next_due_at>new.recorded_at+interval '90 days' then
  raise exception 'Next independent reassessment must be due within 90 days'; end if;
 return new;
end $$;
create trigger renewal_freshness_decision_guard before insert
 on public.owner_export_renewal_freshness_decisions for each row
 execute function icamp_private.renewal_freshness_decision_guard();
create trigger renewal_freshness_decision_immutable before update or delete
 on public.owner_export_renewal_freshness_decisions for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_renewal_freshness_decisions enable row level security;
alter table public.owner_export_renewal_freshness_decisions force row level security;
revoke all on public.owner_export_renewal_freshness_decisions from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_renewal_freshness_decisions from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_renewal_freshness_decisions to icamp_app;
create policy renewal_freshness_decision_read on public.owner_export_renewal_freshness_decisions
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy renewal_freshness_decision_insert on public.owner_export_renewal_freshness_decisions
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.renewal_freshness_decision_guard() from public;
