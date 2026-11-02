-- Build 140: independent owner-proof renewal, observed aged exception disposition,
-- and a documentary cross-system read-only gate review. Always HOLD; no dispatch.
create table public.owner_export_proof_renewal_gate_reviews (
 id uuid primary key,
 owner_reconciliation_id uuid not null references public.owner_export_continuity_evidence_reconciliations(id),
 prior_review_id uuid unique references public.owner_export_proof_renewal_gate_reviews(id),
 verified_renewal_event_id uuid unique references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in
  ('independent_owner_proof_renewal','aged_exception_disposition',
   'cross_system_read_only_gate_review')),
 outcome_kind text not null check(outcome_kind in
  ('renewal_current','renewal_source_drift','renewal_escalated',
   'aged_exception_reconciled','aged_exception_overdue','aged_exception_escalated',
   'gateway_documented_hold','gateway_evidence_missing','gateway_review_escalated')),
 next_due_at timestamptz not null,
 observed_reconciliation_age_days integer not null default 0 check(observed_reconciliation_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_proof_age_days integer not null default 0 check(observed_proof_age_days>=0),
 observed_later_reopenings integer not null default 0 check(observed_later_reopenings>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_open_139_exceptions integer not null default 0 check(observed_open_139_exceptions>=0),
 observed_overdue_139_reviews integer not null default 0 check(observed_overdue_139_reviews>=0),
 observed_independent_renewal_proof boolean not null default false,
 gateway_health_receipt_ref text check(gateway_health_receipt_ref is null or char_length(gateway_health_receipt_ref) between 8 and 160),
 gateway_capabilities_receipt_ref text check(gateway_capabilities_receipt_ref is null or char_length(gateway_capabilities_receipt_ref) between 8 and 160),
 gateway_audit_receipt_ref text check(gateway_audit_receipt_ref is null or char_length(gateway_audit_receipt_ref) between 8 and 160),
 independent_witness_attestation_ref text check(independent_witness_attestation_ref is null or char_length(independent_witness_attestation_ref) between 8 and 160),
 observed_gateway_metadata_complete boolean not null default false,
 gate_state text not null default 'HOLD' check(gate_state='HOLD'),
 owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false),
 dispatch_enabled boolean not null default false check(dispatch_enabled=false),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint owner_proof_gateway_pair check(source_campground_id<>target_campground_id),
 constraint owner_proof_gateway_outcomes check(
  (review_kind='independent_owner_proof_renewal' and outcome_kind in
   ('renewal_current','renewal_source_drift','renewal_escalated'))
  or (review_kind='aged_exception_disposition' and outcome_kind in
   ('aged_exception_reconciled','aged_exception_overdue','aged_exception_escalated'))
  or (review_kind='cross_system_read_only_gate_review' and outcome_kind in
   ('gateway_documented_hold','gateway_evidence_missing','gateway_review_escalated'))),
 constraint owner_proof_gateway_source_proof check(
  (outcome_kind='renewal_current')=(verified_renewal_event_id is not null)),
 constraint owner_proof_gateway_metadata_only check(
  review_kind='cross_system_read_only_gate_review' or
  (gateway_health_receipt_ref is null and gateway_capabilities_receipt_ref is null
   and gateway_audit_receipt_ref is null and independent_witness_attestation_ref is null))
);
create unique index owner_proof_gateway_first_idx on
 public.owner_export_proof_renewal_gate_reviews(owner_reconciliation_id)
 where prior_review_id is null;
create index owner_proof_gateway_pair_idx on public.owner_export_proof_renewal_gate_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index owner_proof_gateway_root_idx on public.owner_export_proof_renewal_gate_reviews
 (owner_reconciliation_id,reviewed_at desc,id desc);
create index owner_proof_gateway_due_idx on public.owner_export_proof_renewal_gate_reviews(next_due_at);

create function icamp_private.owner_proof_gateway_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; base_watch record; base_proof record; prior_record record;
 renewal_record record; new_proof record;
 due_reference timestamptz; latest_proof_at timestamptz; prior_verified_at timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,140140));
 select * into base from public.owner_export_continuity_evidence_reconciliations
  where id=new.owner_reconciliation_id;
 if base.id is null or base.review_kind<>'owner_audit_proof_reconciliation'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id then
  raise exception 'Build 140 requires a same-pair Build 139 owner proof reconciliation'; end if;
 select * into base_watch from public.owner_export_owner_recheck_renewal_watches
  where id=base.continuity_watch_id;
 select * into base_proof from public.owner_export_closure_recurrence_events
  where id=base.verified_source_event_id;
 if base_watch.id is null or base_watch.watch_kind<>'continuity_evidence_watch'
  or base_watch.source_campground_id<>new.source_campground_id
  or base_watch.target_campground_id<>new.target_campground_id then
  raise exception 'Build 140 must retain the Build 138 same-pair source'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_review_id is null then
  if new.review_kind<>'independent_owner_proof_renewal' then
   raise exception 'Start with an independent owner proof recurrence renewal'; end if;
  due_reference:=base.next_due_at;
 else
  select * into prior_record from public.owner_export_proof_renewal_gate_reviews
   where id=new.prior_review_id;
  if prior_record.id is null or prior_record.owner_reconciliation_id<>new.owner_reconciliation_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Build 140 reviewers must follow the same owner reconciliation root'; end if;
  if not ((prior_record.review_kind='independent_owner_proof_renewal'
    and new.review_kind='aged_exception_disposition')
   or (prior_record.review_kind='aged_exception_disposition'
    and new.review_kind='cross_system_read_only_gate_review')
   or (prior_record.review_kind='cross_system_read_only_gate_review'
    and new.review_kind='independent_owner_proof_renewal')) then
   raise exception 'Owner proof renewal, aging and gateway review must remain ordered'; end if;
  if new.reviewed_by_user_id=prior_record.reviewed_by_user_id then
   raise exception 'Independent reviewer must differ from previous stage'; end if;
  due_reference:=prior_record.next_due_at;
 end if;
 if new.reviewed_by_user_id in (base.reviewed_by_user_id,
  base_watch.reviewed_by_user_id,base_proof.recorded_by_user_id) then
  raise exception 'Reviewer may not independently validate their own prior owner or source evidence'; end if;
 new.observed_reconciliation_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 latest_proof_at:=coalesce(base_proof.recorded_at,base.reviewed_at);
 select max(e.recorded_at) into prior_verified_at from public.owner_export_proof_renewal_gate_reviews prior
  join public.owner_export_closure_recurrence_events e on e.id=prior.verified_renewal_event_id
  where prior.owner_reconciliation_id=new.owner_reconciliation_id;
 -- The last independently verified root proof sets a lower bound for reuse.
 latest_proof_at:=greatest(latest_proof_at,coalesce(prior_verified_at,latest_proof_at));
 select count(*)::int into new.observed_later_reopenings
  from public.owner_export_closure_recurrence_events e
  where e.source_campground_id=new.source_campground_id
   and e.target_campground_id=new.target_campground_id
   and e.event_kind='owner_exception_reopen' and e.recorded_at>base.reviewed_at;
 select count(*)::int into new.observed_open_peer_recurrences
  from public.owner_export_closure_recurrence_events e
  where e.source_campground_id=new.source_campground_id
   and e.target_campground_id=new.target_campground_id
   and e.event_kind='independent_recurrence_check' and e.outcome_kind<>'continuity_stable'
   and not exists (
    with recursive descendants as (
     select x.id,x.event_kind,x.outcome_kind from public.owner_export_closure_recurrence_events x
      where x.prior_event_id=e.id
     union all
     select x.id,x.event_kind,x.outcome_kind from public.owner_export_closure_recurrence_events x
      join descendants d on x.prior_event_id=d.id
    ) select 1 from descendants where event_kind='independent_followup_verify'
      and outcome_kind='verify_followup_evidence');
 select count(*)::int into new.observed_open_owner_dispositions
  from public.owner_export_independent_recheck_owner_decisions d
  where d.source_campground_id=new.source_campground_id
   and d.target_campground_id=new.target_campground_id
   and d.decision_kind<>'acknowledge_closure_proof';
 select count(*) filter(where a.outcome_kind in
   ('recurrence_drift','recurrence_escalated','aging_exception_overdue',
    'aging_exception_escalated','owner_proof_gap','owner_proof_escalated'))::int,
  count(*) filter(where a.next_due_at<new.reviewed_at)::int
  into new.observed_open_139_exceptions,new.observed_overdue_139_reviews
  from public.owner_export_continuity_evidence_reconciliations a
  where a.source_campground_id=new.source_campground_id
   and a.target_campground_id=new.target_campground_id
   and not exists (select 1 from public.owner_export_continuity_evidence_reconciliations child
    where child.prior_reconciliation_id=a.id);
 if new.review_kind='independent_owner_proof_renewal' and new.verified_renewal_event_id is not null then
  select * into new_proof from public.owner_export_closure_recurrence_events
   where id=new.verified_renewal_event_id;
  new.observed_independent_renewal_proof:=base_proof.id is not null
   and new_proof.id is not null
   and new_proof.root_reopen_id=base_proof.root_reopen_id
   and new_proof.source_campground_id=new.source_campground_id
   and new_proof.target_campground_id=new.target_campground_id
   and new_proof.event_kind='independent_followup_verify'
   and new_proof.outcome_kind='verify_followup_evidence'
   and new_proof.observed_original_proof_verified
   and new_proof.recorded_at>latest_proof_at
   and new_proof.recorded_at<=new.reviewed_at
   and new_proof.recorded_by_user_id<>new.reviewed_by_user_id;
  if not new.observed_independent_renewal_proof then
   raise exception 'Renewal requires new verified same-root independently authored source evidence'; end if;
  latest_proof_at:=new_proof.recorded_at;
 end if;
 new.observed_proof_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-latest_proof_at))/86400))::int;
 if new.review_kind='aged_exception_disposition' and
  new.outcome_kind='aged_exception_reconciled' and
  (prior_record.outcome_kind<>'renewal_current' or new.observed_prior_overdue_days>0) then
  raise exception 'Reconciled aging needs a stable and timely independent proof renewal'; end if;
 if new.review_kind='cross_system_read_only_gate_review' then
  new.observed_gateway_metadata_complete:=new.gateway_health_receipt_ref is not null
   and new.gateway_capabilities_receipt_ref is not null
   and new.gateway_audit_receipt_ref is not null
   and new.independent_witness_attestation_ref is not null;
  if new.outcome_kind='gateway_documented_hold' and not new.observed_gateway_metadata_complete then
   raise exception 'Documentary gate review must list all four source references, not invented sign-offs'; end if;
  if new.outcome_kind='gateway_documented_hold' then
   select * into renewal_record from public.owner_export_proof_renewal_gate_reviews
    where id=prior_record.prior_review_id;
   if prior_record.outcome_kind<>'aged_exception_reconciled'
    or renewal_record.outcome_kind<>'renewal_current' then
    raise exception 'Documented gateway HOLD needs stable renewal and reconciled aging'; end if;
  end if;
 end if;
 if new.outcome_kind in('renewal_current','aged_exception_reconciled','gateway_documented_hold') and
  (base.outcome_kind<>'owner_proof_reconciled'
   or not base.observed_independent_proof_verified
   or new.observed_proof_age_days>30 or new.observed_later_reopenings>0
   or new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
   or new.observed_open_139_exceptions>0 or new.observed_overdue_139_reviews>0
   or new.observed_prior_overdue_days>=30) then
  raise exception 'Positive review needs current independently verified proof and no unresolved exceptions'; end if;
 if new.outcome_kind='aged_exception_overdue' and
  new.observed_prior_overdue_days=0 and new.observed_overdue_139_reviews=0 then
  raise exception 'Aged exception overdue requires an observed overdue audit'; end if;
 if new.next_due_at<=new.reviewed_at or
  new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Next independent owner review must be due within 90 days'; end if;
 -- Gate is a documentary HOLD regardless of self-supplied receipt IDs.
 new.gate_state:='HOLD';
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 return new;
end $$;
create trigger owner_proof_gateway_review_guard before insert
 on public.owner_export_proof_renewal_gate_reviews for each row
 execute function icamp_private.owner_proof_gateway_review_guard();
create trigger owner_proof_gateway_review_immutable before update or delete
 on public.owner_export_proof_renewal_gate_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_proof_renewal_gate_reviews enable row level security;
alter table public.owner_export_proof_renewal_gate_reviews force row level security;
revoke all on public.owner_export_proof_renewal_gate_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_proof_renewal_gate_reviews from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_proof_renewal_gate_reviews to icamp_app;
create policy owner_proof_gateway_review_select on public.owner_export_proof_renewal_gate_reviews
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_proof_gateway_review_insert on public.owner_export_proof_renewal_gate_reviews
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_proof_gateway_review_guard() from public;
