-- Build 138: independent renewal of owner recheck recurrence outcomes,
-- explicit overdue-exception dispositions and subsequent continuity evidence watch.
-- Append-only, campground-owner scoped and without operational side effects.
create table public.owner_export_owner_recheck_renewal_watches (
 id uuid primary key,
 owner_recheck_id uuid not null references public.owner_export_continuity_recurrence_audits(id),
 prior_watch_id uuid unique references public.owner_export_owner_recheck_renewal_watches(id),
 verified_evidence_event_id uuid unique references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 watch_kind text not null check(watch_kind in
  ('independent_owner_recheck_recurrence_renewal',
   'overdue_exception_disposition','continuity_evidence_watch')),
 outcome_kind text not null check(outcome_kind in
  ('renewal_stable','recurrence_detected','recurrence_escalated',
   'exception_reconciled','exception_overdue','exception_escalated',
   'continuity_evidence_verified','continuity_evidence_stale','continuity_evidence_escalated')),
 next_due_at timestamptz not null,
 observed_days_since_owner_recheck integer not null default 0 check(observed_days_since_owner_recheck>=0),
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_evidence_age_days integer not null default 0 check(observed_evidence_age_days>=0),
 observed_new_reopenings integer not null default 0 check(observed_new_reopenings>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_open_recheck_exceptions integer not null default 0 check(observed_open_recheck_exceptions>=0),
 observed_overdue_owner_rechecks integer not null default 0 check(observed_overdue_owner_rechecks>=0),
 observed_verified_continuity_proof boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 watch_note text not null check(char_length(trim(watch_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint owner_recheck_renewal_pair check(source_campground_id<>target_campground_id),
 constraint owner_recheck_renewal_kind_outcome check(
  (watch_kind='independent_owner_recheck_recurrence_renewal' and outcome_kind in
   ('renewal_stable','recurrence_detected','recurrence_escalated'))
  or (watch_kind='overdue_exception_disposition' and outcome_kind in
   ('exception_reconciled','exception_overdue','exception_escalated'))
  or (watch_kind='continuity_evidence_watch' and outcome_kind in
   ('continuity_evidence_verified','continuity_evidence_stale','continuity_evidence_escalated'))),
 constraint owner_recheck_renewal_proof_link check(
  (outcome_kind='continuity_evidence_verified')=(verified_evidence_event_id is not null))
);
create unique index owner_recheck_renewal_first_watch_idx
 on public.owner_export_owner_recheck_renewal_watches(owner_recheck_id)
 where prior_watch_id is null;
create index owner_recheck_renewal_pair_history_idx
 on public.owner_export_owner_recheck_renewal_watches
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index owner_recheck_renewal_root_history_idx
 on public.owner_export_owner_recheck_renewal_watches
 (owner_recheck_id,reviewed_at desc,id desc);
create index owner_recheck_renewal_due_idx
 on public.owner_export_owner_recheck_renewal_watches(next_due_at);

create function icamp_private.owner_recheck_renewal_watch_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare owner_recheck record; owner_continuity record; prior_aging record;
 prior_watch record; prior_record record; root_comparison record;
 original_proof record; baseline_proof record; new_proof record;
 latest_proof_at timestamptz; reference_due timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,138138));
 select * into owner_recheck from public.owner_export_continuity_recurrence_audits
  where id=new.owner_recheck_id;
 if owner_recheck.id is null or owner_recheck.recheck_kind<>'verified_owner_audit_recheck'
  or owner_recheck.source_campground_id<>new.source_campground_id
  or owner_recheck.target_campground_id<>new.target_campground_id then
  raise exception 'Build 138 needs a same-pair Build 137 verified owner audit recheck receipt'; end if;
 select * into prior_aging from public.owner_export_continuity_recurrence_audits
  where id=owner_recheck.prior_recheck_id;
 select * into prior_watch from public.owner_export_continuity_recurrence_audits
  where id=prior_aging.prior_recheck_id;
 select * into owner_continuity from public.owner_export_renewal_freshness_decisions
  where id=owner_recheck.owner_continuity_id;
 select * into root_comparison from public.owner_export_renewal_freshness_decisions
  where id=(select w.prior_audit_id from public.owner_export_renewal_freshness_decisions w
   where w.id=owner_continuity.prior_audit_id);
 select * into original_proof from public.owner_export_closure_recurrence_events
  where id=root_comparison.comparison_evidence_event_id;
 select * into baseline_proof from public.owner_export_closure_recurrence_events
  where id=coalesce(owner_recheck.verified_followup_event_id,root_comparison.comparison_evidence_event_id);
 if prior_aging.id is null or prior_watch.id is null
  or prior_aging.recheck_kind<>'renewal_exception_followup_aging'
  or prior_watch.recheck_kind<>'independent_continuity_recurrence_watch'
  or prior_watch.owner_continuity_id<>owner_recheck.owner_continuity_id
  or prior_aging.owner_continuity_id<>owner_recheck.owner_continuity_id
  or owner_continuity.id is null or root_comparison.id is null
  or root_comparison.audit_kind<>'independent_renewal_freshness_comparison'
  or original_proof.id is null or baseline_proof.id is null
  or baseline_proof.root_reopen_id<>original_proof.root_reopen_id
  or baseline_proof.event_kind<>'independent_followup_verify'
  or baseline_proof.outcome_kind<>'verify_followup_evidence'
  or not baseline_proof.observed_original_proof_verified then
  raise exception 'Owner recheck renewal must retain the independently verified same-root chain'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_watch_id is null then
  if new.watch_kind<>'independent_owner_recheck_recurrence_renewal' then
   raise exception 'Owner recheck renewal begins with independent recurrence outcome review'; end if;
  reference_due:=owner_recheck.next_due_at;
 else
  select * into prior_record from public.owner_export_owner_recheck_renewal_watches
   where id=new.prior_watch_id;
  if prior_record.id is null or prior_record.owner_recheck_id<>new.owner_recheck_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Renewal and overdue disposition must share one owner recheck root'; end if;
  if not (
   (prior_record.watch_kind='independent_owner_recheck_recurrence_renewal'
    and new.watch_kind='overdue_exception_disposition')
   or (prior_record.watch_kind='overdue_exception_disposition'
    and new.watch_kind='continuity_evidence_watch')
   or (prior_record.watch_kind='continuity_evidence_watch'
    and new.watch_kind='independent_owner_recheck_recurrence_renewal')) then
   raise exception 'Recurrence renewal, overdue disposition and evidence watch must stay ordered'; end if;
  if new.reviewed_by_user_id=prior_record.reviewed_by_user_id then
   raise exception 'Independent reviewer must differ from the preceding renewal reviewer'; end if;
  reference_due:=prior_record.next_due_at;
 end if;
 if new.reviewed_by_user_id in (owner_recheck.reviewed_by_user_id,
  prior_aging.reviewed_by_user_id,prior_watch.reviewed_by_user_id,
  owner_continuity.recorded_by_user_id,root_comparison.recorded_by_user_id,
  baseline_proof.recorded_by_user_id) then
  raise exception 'Independent reviewer cannot verify their own owner recheck or source proof'; end if;
 new.observed_days_since_owner_recheck:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-owner_recheck.reviewed_at))/86400))::int;
 new.observed_prior_days_overdue:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-reference_due))/86400))::int;
 select count(*)::int into new.observed_new_reopenings
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='owner_exception_reopen'
  and e.recorded_at>owner_recheck.reviewed_at;
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
 select count(*)::int into new.observed_open_owner_dispositions
 from public.owner_export_independent_recheck_owner_decisions d
 where d.source_campground_id=new.source_campground_id
  and d.target_campground_id=new.target_campground_id
  and d.decision_kind<>'acknowledge_closure_proof';
 select count(*) filter(where a.outcome_kind in
   ('continuity_recurrence_detected','continuity_escalation_required',
    'renewal_exception_overdue','renewal_exception_escalated',
    'owner_audit_on_hold','owner_audit_escalated'))::int,
  count(*) filter(where a.next_due_at<new.reviewed_at-interval '30 days')::int
 into new.observed_open_recheck_exceptions,new.observed_overdue_owner_rechecks
 from public.owner_export_continuity_recurrence_audits a
 where a.source_campground_id=new.source_campground_id
  and a.target_campground_id=new.target_campground_id
  and not exists (select 1 from public.owner_export_continuity_recurrence_audits child
   where child.prior_recheck_id=a.id);
 select max(e.recorded_at) into latest_proof_at
 from public.owner_export_owner_recheck_renewal_watches previous
 join public.owner_export_closure_recurrence_events e
  on e.id=previous.verified_evidence_event_id
 where previous.owner_recheck_id=new.owner_recheck_id;
 latest_proof_at:=greatest(coalesce(latest_proof_at,baseline_proof.recorded_at),
  baseline_proof.recorded_at);
 if new.watch_kind='overdue_exception_disposition' and
  new.outcome_kind='exception_reconciled' and
  prior_record.outcome_kind<>'renewal_stable' then
  raise exception 'Reconciled exception needs an independently stable recurrence renewal'; end if;
 if new.watch_kind='continuity_evidence_watch' then
  select * into prior_watch from public.owner_export_owner_recheck_renewal_watches
   where id=prior_record.prior_watch_id;
  if new.outcome_kind='continuity_evidence_verified' and
   (prior_record.outcome_kind<>'exception_reconciled'
    or prior_watch.outcome_kind<>'renewal_stable') then
   raise exception 'Continuity proof needs a stable recurrence and reconciled exception disposition'; end if;
  if new.verified_evidence_event_id is not null then
   select * into new_proof from public.owner_export_closure_recurrence_events
    where id=new.verified_evidence_event_id;
   new.observed_verified_continuity_proof:=new_proof.id is not null
    and new_proof.event_kind='independent_followup_verify'
    and new_proof.outcome_kind='verify_followup_evidence'
    and new_proof.root_reopen_id=baseline_proof.root_reopen_id
    and new_proof.source_campground_id=new.source_campground_id
    and new_proof.target_campground_id=new.target_campground_id
    and new_proof.observed_original_proof_verified
    and new_proof.recorded_at>latest_proof_at
    and new_proof.recorded_at<=new.reviewed_at
    and not exists (select 1 from public.owner_export_owner_recheck_renewal_watches used
     join public.owner_export_closure_recurrence_events e
      on e.id=used.verified_evidence_event_id
     where used.owner_recheck_id=new.owner_recheck_id
      and e.recorded_at>=new_proof.recorded_at);
   if not new.observed_verified_continuity_proof then
    raise exception 'Continuity watch proof must be new, independently verified and same-root'; end if;
   if new.reviewed_by_user_id=new_proof.recorded_by_user_id then
    raise exception 'Continuity watcher cannot verify their own proof event'; end if;
   latest_proof_at:=new_proof.recorded_at;
  end if;
 end if;
 new.observed_evidence_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-latest_proof_at))/86400))::int;
 if new.outcome_kind in('renewal_stable','exception_reconciled','continuity_evidence_verified') and
  (owner_recheck.outcome_kind<>'owner_audit_reverified'
   or not owner_recheck.observed_verified_owner_proof
   or prior_aging.outcome_kind<>'renewal_evidence_current'
   or new.observed_evidence_age_days>30
   or new.observed_new_reopenings>0 or new.observed_open_peer_recurrences>0
   or new.observed_open_owner_dispositions>0 or new.observed_open_recheck_exceptions>0
   or new.observed_overdue_owner_rechecks>0) then
  raise exception 'Positive renewal needs verified current proof and zero unresolved owner exceptions'; end if;
 if new.outcome_kind='exception_overdue' and
  reference_due>=new.reviewed_at and new.observed_overdue_owner_rechecks=0 then
  raise exception 'Exception overdue requires an observed overdue source'; end if;
 if new.observed_prior_days_overdue>=30 and new.outcome_kind in
  ('renewal_stable','exception_reconciled','continuity_evidence_verified') then
  raise exception 'Thirty-day overdue owner evidence requires explicit exception or escalation'; end if;
 if new.next_due_at<=new.reviewed_at or
  new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Next independent owner recheck must be due within 90 days'; end if;
 return new;
end $$;
create trigger owner_recheck_renewal_watch_guard before insert
 on public.owner_export_owner_recheck_renewal_watches for each row
 execute function icamp_private.owner_recheck_renewal_watch_guard();
create trigger owner_recheck_renewal_watch_immutable before update or delete
 on public.owner_export_owner_recheck_renewal_watches for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_owner_recheck_renewal_watches enable row level security;
alter table public.owner_export_owner_recheck_renewal_watches force row level security;
revoke all on public.owner_export_owner_recheck_renewal_watches from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_owner_recheck_renewal_watches from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_owner_recheck_renewal_watches to icamp_app;
create policy owner_recheck_renewal_watch_read on public.owner_export_owner_recheck_renewal_watches
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_recheck_renewal_watch_insert on public.owner_export_owner_recheck_renewal_watches
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_recheck_renewal_watch_guard() from public;
