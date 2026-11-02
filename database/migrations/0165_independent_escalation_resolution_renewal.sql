-- Build 135: independent escalation-resolution follow-up, recurrence watch,
-- and owner evidence renewal. Append-only, owner-scoped audit only.
create table public.owner_export_escalation_resolution_renewals (
 id uuid primary key,
 resolved_oversight_id uuid not null references public.owner_export_reopening_followup_oversights(id),
 prior_renewal_id uuid unique references public.owner_export_escalation_resolution_renewals(id),
 renewal_evidence_event_id uuid unique references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 renewal_kind text not null check(renewal_kind in
  ('independent_resolution_followup','reopening_recurrence_watch','owner_evidence_renewal')),
 outcome_kind text not null check(outcome_kind in
  ('resolution_evidence_current','resolution_evidence_gap','resolution_followup_escalated',
   'recurrence_watch_stable','reopening_recurrence_detected','recurrence_escalation_required',
   'owner_evidence_renewed','owner_evidence_pending','owner_evidence_escalated')),
 next_due_at timestamptz not null,
 observed_resolution_age_days integer not null default 0 check(observed_resolution_age_days>=0),
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_new_reopenings integer not null default 0 check(observed_new_reopenings>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_recent_owner_escalations integer not null default 0 check(observed_recent_owner_escalations>=0),
 observed_fresh_renewal_verified boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 renewal_note text not null check(char_length(trim(renewal_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint escalation_resolution_renewal_pair check(source_campground_id<>target_campground_id),
 constraint escalation_resolution_renewal_outcomes check(
  (renewal_kind='independent_resolution_followup' and outcome_kind in
   ('resolution_evidence_current','resolution_evidence_gap','resolution_followup_escalated'))
  or (renewal_kind='reopening_recurrence_watch' and outcome_kind in
   ('recurrence_watch_stable','reopening_recurrence_detected','recurrence_escalation_required'))
  or (renewal_kind='owner_evidence_renewal' and outcome_kind in
   ('owner_evidence_renewed','owner_evidence_pending','owner_evidence_escalated'))),
 constraint escalation_resolution_renewal_proof check(
  (outcome_kind in('resolution_evidence_current','recurrence_watch_stable','owner_evidence_renewed'))
    = (renewal_evidence_event_id is not null))
);
create unique index escalation_resolution_first_renewal_idx
 on public.owner_export_escalation_resolution_renewals(resolved_oversight_id)
 where prior_renewal_id is null;
create index escalation_resolution_pair_history_idx
 on public.owner_export_escalation_resolution_renewals
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create index escalation_resolution_due_idx
 on public.owner_export_escalation_resolution_renewals(next_due_at);

create function icamp_private.escalation_resolution_renewal_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare resolved_record record; monitor_record record; reopened_record record;
 baseline_proof record; renewal_proof record; prior_record record;
 reference_due timestamptz; newest_proof_at timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,135135));
 select * into resolved_record from public.owner_export_reopening_followup_oversights
  where id=new.resolved_oversight_id;
 if resolved_record.id is null or resolved_record.oversight_kind<>'owner_escalation_oversight'
  or resolved_record.outcome_kind<>'owner_escalation_resolved'
  or not resolved_record.observed_verified_resolution_linked
  or resolved_record.source_campground_id<>new.source_campground_id
  or resolved_record.target_campground_id<>new.target_campground_id then
  raise exception 'Build 135 requires a verified, same-pair Build 134 escalation resolution'; end if;
 select * into monitor_record from public.owner_export_verified_closure_monitors
  where id=resolved_record.verified_monitor_id;
 select * into reopened_record from public.owner_export_closure_recurrence_events
  where id=monitor_record.linked_reopen_event_id;
 select * into baseline_proof from public.owner_export_closure_recurrence_events
  where id=resolved_record.verified_resolution_event_id;
 if monitor_record.id is null or reopened_record.id is null
  or reopened_record.event_kind<>'owner_exception_reopen'
  or baseline_proof.id is null or baseline_proof.root_reopen_id<>reopened_record.id
  or baseline_proof.event_kind<>'independent_followup_verify'
  or baseline_proof.outcome_kind<>'verify_followup_evidence'
  or baseline_proof.source_campground_id<>new.source_campground_id
  or baseline_proof.target_campground_id<>new.target_campground_id then
  raise exception 'Escalation follow-up source lineage is incomplete'; end if;
 new.recorded_at:=clock_timestamp();
 new.observed_resolution_age_days:=greatest(0,floor(extract(epoch from
  (new.recorded_at-resolved_record.recorded_at))/86400))::int;
 if new.prior_renewal_id is null then
  if new.renewal_kind<>'independent_resolution_followup' then
   raise exception 'Resolution follow-up must begin with independent evidence'; end if;
  reference_due:=resolved_record.recorded_at+interval '30 days';
 else
  select * into prior_record from public.owner_export_escalation_resolution_renewals
   where id=new.prior_renewal_id;
  if prior_record.id is null or prior_record.resolved_oversight_id<>new.resolved_oversight_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Renewal must follow the same original resolved escalation'; end if;
  if not (
   (prior_record.renewal_kind='independent_resolution_followup' and
     new.renewal_kind='reopening_recurrence_watch')
   or (prior_record.renewal_kind='reopening_recurrence_watch' and
     new.renewal_kind='owner_evidence_renewal')
   or (prior_record.renewal_kind='owner_evidence_renewal' and
     new.renewal_kind in('owner_evidence_renewal','independent_resolution_followup'))
  ) then raise exception 'Independent follow-up, recurrence watch and owner renewal must stay ordered'; end if;
  if new.recorded_by_user_id=prior_record.recorded_by_user_id then
   raise exception 'Renewal reviewer must differ from the preceding reviewer'; end if;
  reference_due:=prior_record.next_due_at;
 end if;
 if new.recorded_by_user_id in(resolved_record.recorded_by_user_id,
   baseline_proof.recorded_by_user_id,reopened_record.recorded_by_user_id,
   monitor_record.recorded_by_user_id) then
  raise exception 'Independent reviewer cannot renew their own source closure or reopening'; end if;
 new.observed_prior_days_overdue:=greatest(0,floor(extract(epoch from
  (new.recorded_at-reference_due))/86400))::int;
 select count(*)::int into new.observed_new_reopenings
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='owner_exception_reopen'
  and e.recorded_at>resolved_record.recorded_at;
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
 if new.renewal_evidence_event_id is not null then
  select * into renewal_proof from public.owner_export_closure_recurrence_events
   where id=new.renewal_evidence_event_id;
  select max(e.recorded_at) into newest_proof_at
   from public.owner_export_escalation_resolution_renewals r
   join public.owner_export_closure_recurrence_events e on e.id=r.renewal_evidence_event_id
   where r.resolved_oversight_id=new.resolved_oversight_id;
  new.observed_fresh_renewal_verified:=renewal_proof.id is not null
   and renewal_proof.event_kind='independent_followup_verify'
   and renewal_proof.outcome_kind='verify_followup_evidence'
   and renewal_proof.root_reopen_id=reopened_record.id
   and renewal_proof.source_campground_id=new.source_campground_id
   and renewal_proof.target_campground_id=new.target_campground_id
   and renewal_proof.observed_original_proof_verified
   and renewal_proof.recorded_at>baseline_proof.recorded_at
   and renewal_proof.recorded_at>coalesce(newest_proof_at,baseline_proof.recorded_at)
   and renewal_proof.recorded_at<=new.recorded_at;
  if not coalesce(new.observed_fresh_renewal_verified,false) then
   raise exception 'Renewed proof must be newer and independently source-verified for the same reopening'; end if;
  if new.recorded_by_user_id=renewal_proof.recorded_by_user_id then
   raise exception 'Evidence author cannot independently attest their own renewal'; end if;
 end if;
 if new.outcome_kind in('resolution_evidence_current','recurrence_watch_stable',
  'owner_evidence_renewed') and (
   not new.observed_fresh_renewal_verified or new.observed_new_reopenings>0
   or new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
   or new.observed_recent_owner_escalations>0) then
  raise exception 'Stable or renewed evidence cannot ignore a reopened or unresolved exception'; end if;
 if new.observed_prior_days_overdue>=30 and new.outcome_kind in
  ('resolution_evidence_current','recurrence_watch_stable','owner_evidence_pending') then
  raise exception 'Overdue thirty-day evidence requires explicit escalation or gap outcome'; end if;
 if new.next_due_at<=new.recorded_at or new.next_due_at>new.recorded_at+interval '90 days' then
  raise exception 'Follow-up must be due within 90 days'; end if;
 return new;
end $$;
create trigger escalation_resolution_renewal_guard before insert
 on public.owner_export_escalation_resolution_renewals for each row
 execute function icamp_private.escalation_resolution_renewal_guard();
create trigger escalation_resolution_renewal_immutable before update or delete
 on public.owner_export_escalation_resolution_renewals for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_escalation_resolution_renewals enable row level security;
alter table public.owner_export_escalation_resolution_renewals force row level security;
revoke all on public.owner_export_escalation_resolution_renewals from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_escalation_resolution_renewals from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_escalation_resolution_renewals to icamp_app;
create policy escalation_resolution_renewal_read on public.owner_export_escalation_resolution_renewals
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy escalation_resolution_renewal_insert on public.owner_export_escalation_resolution_renewals
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.escalation_resolution_renewal_guard() from public;
