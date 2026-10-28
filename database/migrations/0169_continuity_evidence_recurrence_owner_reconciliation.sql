-- Build 139: independent recurrence review, observed aging exceptions, and
-- source-linked owner proof reconciliation. Append-only, no operational writes.
create table public.owner_export_continuity_evidence_reconciliations (
 id uuid primary key,
 continuity_watch_id uuid not null references public.owner_export_owner_recheck_renewal_watches(id),
 prior_reconciliation_id uuid unique references public.owner_export_continuity_evidence_reconciliations(id),
 verified_source_event_id uuid unique references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in
  ('independent_continuity_evidence_recurrence_review',
   'aging_exception_followup','owner_audit_proof_reconciliation')),
 outcome_kind text not null check(outcome_kind in
  ('recurrence_stable','recurrence_drift','recurrence_escalated',
   'aging_exception_current','aging_exception_overdue','aging_exception_escalated',
   'owner_proof_reconciled','owner_proof_gap','owner_proof_escalated')),
 next_due_at timestamptz not null,
 observed_watch_age_days integer not null default 0 check(observed_watch_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_proof_age_days integer not null default 0 check(observed_proof_age_days>=0),
 observed_later_reopenings integer not null default 0 check(observed_later_reopenings>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_open_renewal_exceptions integer not null default 0 check(observed_open_renewal_exceptions>=0),
 observed_overdue_renewal_watches integer not null default 0 check(observed_overdue_renewal_watches>=0),
 observed_independent_proof_verified boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint continuity_evidence_reconciliation_pair check(source_campground_id<>target_campground_id),
 constraint continuity_evidence_reconciliation_outcomes check(
  (review_kind='independent_continuity_evidence_recurrence_review' and outcome_kind in
   ('recurrence_stable','recurrence_drift','recurrence_escalated'))
  or (review_kind='aging_exception_followup' and outcome_kind in
   ('aging_exception_current','aging_exception_overdue','aging_exception_escalated'))
  or (review_kind='owner_audit_proof_reconciliation' and outcome_kind in
   ('owner_proof_reconciled','owner_proof_gap','owner_proof_escalated'))),
 constraint continuity_evidence_reconciliation_proof check(
  (outcome_kind='owner_proof_reconciled')=(verified_source_event_id is not null))
);
create unique index continuity_evidence_reconciliation_first_idx
 on public.owner_export_continuity_evidence_reconciliations(continuity_watch_id)
 where prior_reconciliation_id is null;
create index continuity_evidence_reconciliation_history_idx
 on public.owner_export_continuity_evidence_reconciliations
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index continuity_evidence_reconciliation_root_idx
 on public.owner_export_continuity_evidence_reconciliations
 (continuity_watch_id,reviewed_at desc,id desc);
create index continuity_evidence_reconciliation_due_idx
 on public.owner_export_continuity_evidence_reconciliations(next_due_at);

create function icamp_private.continuity_evidence_reconciliation_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base_watch record; owner_recheck record; original_proof record;
 prior_record record; first_review record; prior_exception record; linked_proof record;
 reference_due timestamptz; baseline_at timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,139139));
 select * into base_watch from public.owner_export_owner_recheck_renewal_watches
  where id=new.continuity_watch_id;
 if base_watch.id is null or base_watch.watch_kind<>'continuity_evidence_watch'
  or base_watch.source_campground_id<>new.source_campground_id
  or base_watch.target_campground_id<>new.target_campground_id then
  raise exception 'Build 139 needs a same-pair Build 138 continuity evidence watch'; end if;
 select * into owner_recheck from public.owner_export_continuity_recurrence_audits
  where id=base_watch.owner_recheck_id;
 select * into original_proof from public.owner_export_closure_recurrence_events
  where id=base_watch.verified_evidence_event_id;
 if owner_recheck.id is null or owner_recheck.recheck_kind<>'verified_owner_audit_recheck'
  or owner_recheck.source_campground_id<>new.source_campground_id
  or owner_recheck.target_campground_id<>new.target_campground_id then
  raise exception 'Build 139 must preserve the independent owner audit chain'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_reconciliation_id is null then
  if new.review_kind<>'independent_continuity_evidence_recurrence_review' then
   raise exception 'Start with independent continuity recurrence review'; end if;
  reference_due:=base_watch.next_due_at;
 else
  select * into prior_record from public.owner_export_continuity_evidence_reconciliations
   where id=new.prior_reconciliation_id;
  if prior_record.id is null or prior_record.continuity_watch_id<>new.continuity_watch_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Build 139 evidence follow-up must remain on one campground pair and root'; end if;
  if not ((prior_record.review_kind='independent_continuity_evidence_recurrence_review'
     and new.review_kind='aging_exception_followup')
    or (prior_record.review_kind='aging_exception_followup'
     and new.review_kind='owner_audit_proof_reconciliation')
    or (prior_record.review_kind='owner_audit_proof_reconciliation'
     and new.review_kind='independent_continuity_evidence_recurrence_review')) then
   raise exception 'Review, aging and owner reconciliation must stay ordered'; end if;
  if new.reviewed_by_user_id=prior_record.reviewed_by_user_id then
   raise exception 'Independent reviewer must differ from previous stage'; end if;
  reference_due:=prior_record.next_due_at;
 end if;
 if new.reviewed_by_user_id in (base_watch.reviewed_by_user_id,
  owner_recheck.reviewed_by_user_id,original_proof.recorded_by_user_id) then
  raise exception 'Reviewer cannot independently recheck their own source or owner audit'; end if;
 new.observed_watch_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base_watch.reviewed_at))/86400))::int;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-reference_due))/86400))::int;
 baseline_at:=coalesce(original_proof.recorded_at,base_watch.reviewed_at);
 select count(*)::int into new.observed_later_reopenings
  from public.owner_export_closure_recurrence_events e
  where e.source_campground_id=new.source_campground_id
   and e.target_campground_id=new.target_campground_id
   and e.event_kind='owner_exception_reopen' and e.recorded_at>base_watch.reviewed_at;
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
 select count(*) filter(where w.outcome_kind in
   ('recurrence_detected','recurrence_escalated','exception_overdue',
    'exception_escalated','continuity_evidence_stale','continuity_evidence_escalated'))::int,
  count(*) filter(where w.next_due_at<new.reviewed_at)::int
  into new.observed_open_renewal_exceptions,new.observed_overdue_renewal_watches
  from public.owner_export_owner_recheck_renewal_watches w
  where w.source_campground_id=new.source_campground_id
   and w.target_campground_id=new.target_campground_id
   and not exists(select 1 from public.owner_export_owner_recheck_renewal_watches child
    where child.prior_watch_id=w.id);
 if new.review_kind='aging_exception_followup' and
  new.outcome_kind='aging_exception_current' and
  (prior_record.outcome_kind<>'recurrence_stable'
   or new.observed_prior_overdue_days>0) then
  raise exception 'Current aging follow-up requires stable, on-time independent review'; end if;
 if new.review_kind='owner_audit_proof_reconciliation' then
  select * into prior_exception from public.owner_export_continuity_evidence_reconciliations
   where id=prior_record.prior_reconciliation_id;
  if new.outcome_kind='owner_proof_reconciled' and
   (prior_record.outcome_kind<>'aging_exception_current'
    or prior_exception.outcome_kind<>'recurrence_stable') then
   raise exception 'Owner proof reconciliation requires stable recurrence and current aging review'; end if;
  if new.verified_source_event_id is not null then
   select * into linked_proof from public.owner_export_closure_recurrence_events
    where id=new.verified_source_event_id;
   new.observed_independent_proof_verified:=linked_proof.id is not null
    and original_proof.id is not null
    and linked_proof.root_reopen_id=original_proof.root_reopen_id
    and linked_proof.source_campground_id=new.source_campground_id
    and linked_proof.target_campground_id=new.target_campground_id
    and linked_proof.event_kind='independent_followup_verify'
    and linked_proof.outcome_kind='verify_followup_evidence'
    and linked_proof.observed_original_proof_verified
    and linked_proof.recorded_at>baseline_at and linked_proof.recorded_at<=new.reviewed_at
    and linked_proof.recorded_by_user_id<>new.reviewed_by_user_id;
   if not new.observed_independent_proof_verified then
    raise exception 'Owner reconciliation needs newer independent same-root verified evidence'; end if;
   baseline_at:=linked_proof.recorded_at;
  end if;
 end if;
 new.observed_proof_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-baseline_at))/86400))::int;
 if new.outcome_kind in('recurrence_stable','aging_exception_current','owner_proof_reconciled') and
  (base_watch.outcome_kind<>'continuity_evidence_verified'
   or not base_watch.observed_verified_continuity_proof
   or new.observed_proof_age_days>30 or new.observed_later_reopenings>0
   or new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
   or new.observed_open_renewal_exceptions>0 or new.observed_overdue_renewal_watches>0
   or new.observed_prior_overdue_days>=30) then
  raise exception 'Positive reconciliation requires fresh verified proof and no open or overdue exceptions'; end if;
 if new.outcome_kind='aging_exception_overdue' and
  new.observed_prior_overdue_days=0 and new.observed_overdue_renewal_watches=0 then
  raise exception 'Aging exception overdue requires an observed overdue source'; end if;
 if new.next_due_at<=new.reviewed_at or
  new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Next independent audit must be scheduled within 90 days'; end if;
 return new;
end $$;
create trigger continuity_evidence_reconciliation_guard before insert
 on public.owner_export_continuity_evidence_reconciliations for each row
 execute function icamp_private.continuity_evidence_reconciliation_guard();
create trigger continuity_evidence_reconciliation_immutable before update or delete
 on public.owner_export_continuity_evidence_reconciliations for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_continuity_evidence_reconciliations enable row level security;
alter table public.owner_export_continuity_evidence_reconciliations force row level security;
revoke all on public.owner_export_continuity_evidence_reconciliations from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_continuity_evidence_reconciliations from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_continuity_evidence_reconciliations to icamp_app;
create policy continuity_evidence_reconciliation_read
 on public.owner_export_continuity_evidence_reconciliations for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy continuity_evidence_reconciliation_insert
 on public.owner_export_continuity_evidence_reconciliations for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.continuity_evidence_reconciliation_guard() from public;

-- QL-243: dedicated, private, nonproduction request receipts. New canonical
-- 32-hex nonces are deliberately not cast to old Build 134 UUID receipts.
create table icamp_private.integration_ql243_request_receipts (
 id uuid primary key,
 source_system text not null check(source_system='ai-data-platform'),
 destination_system text not null check(destination_system='icamp'),
 business_id text not null check(business_id='icamp'),
 environment text not null check(environment='nonproduction'),
 campground_id uuid not null references public.campgrounds(id),
 key_id text not null check(char_length(key_id) between 3 and 80),
 nonce text not null check(nonce ~ '^np-[a-f0-9]{32}$'),
 request_path text not null check(request_path in
  ('/api/integration/v1/health','/api/integration/v1/capabilities')),
 request_timestamp timestamptz not null,
 outcome text not null check(outcome in ('held_read_only','tenant_denied')),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(source_system,business_id,campground_id,key_id,nonce)
);
create index integration_ql243_requests_pair_idx
 on icamp_private.integration_ql243_request_receipts(campground_id,recorded_at desc);
create trigger integration_ql243_requests_immutable before update or delete
 on icamp_private.integration_ql243_request_receipts for each row
 execute function icamp_private.winterization_append_only();
alter table icamp_private.integration_ql243_request_receipts enable row level security;
alter table icamp_private.integration_ql243_request_receipts force row level security;
revoke all on icamp_private.integration_ql243_request_receipts from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on icamp_private.integration_ql243_request_receipts from %I',role_name);
  end if;
 end loop;
end $$;
grant insert on icamp_private.integration_ql243_request_receipts to icamp_app;
create policy integration_ql243_request_receipts_insert
 on icamp_private.integration_ql243_request_receipts for insert to icamp_app
 with check(source_system='ai-data-platform' and destination_system='icamp'
  and business_id='icamp' and environment='nonproduction');

-- Denials never store caller headers, signatures, tenant guesses, or secrets.
create table icamp_private.integration_ql243_denial_receipts (
 id uuid primary key,
 request_path text not null check(request_path in
  ('/api/integration/v1/health','/api/integration/v1/capabilities')),
 reason_code text not null check(reason_code in
  ('INTEGRATION_HOLD','INVALID_GATEWAY_IDENTITY','EXPIRED_GATEWAY_SIGNATURE',
   'INVALID_GATEWAY_SIGNATURE','TENANT_HOLD','REPLAY_REJECTED',
   'METHOD_NOT_ALLOWED','QUERY_NOT_ALLOWED','HANDSHAKE_RECEIPT_UNAVAILABLE')),
 recorded_at timestamptz not null default clock_timestamp()
);
create index integration_ql243_denials_time_idx
 on icamp_private.integration_ql243_denial_receipts(recorded_at desc);
create trigger integration_ql243_denials_immutable before update or delete
 on icamp_private.integration_ql243_denial_receipts for each row
 execute function icamp_private.winterization_append_only();
alter table icamp_private.integration_ql243_denial_receipts enable row level security;
alter table icamp_private.integration_ql243_denial_receipts force row level security;
revoke all on icamp_private.integration_ql243_denial_receipts from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on icamp_private.integration_ql243_denial_receipts from %I',role_name);
  end if;
 end loop;
end $$;
grant insert on icamp_private.integration_ql243_denial_receipts to icamp_app;
create policy integration_ql243_denial_receipts_insert
 on icamp_private.integration_ql243_denial_receipts for insert to icamp_app
 with check(true);
