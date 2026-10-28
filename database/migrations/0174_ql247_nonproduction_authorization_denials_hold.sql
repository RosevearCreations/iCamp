-- Build 144: owner-safe intake of QL-247 Phase B authorization references,
-- seven distinct denial receipt IDs and reversible HOLD follow-up.
-- This ledger DOES NOT grant Phase B permission or authorize a live pilot.
create table public.owner_export_ql247_test_receipt_hold_watches (
 id uuid primary key,
 ql246_hold_decision_id uuid not null references public.owner_export_ql246_exception_pin_hold_decisions(id),
 prior_review_id uuid unique references public.owner_export_ql247_test_receipt_hold_watches(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 source_system text not null check(source_system in
  ('ai-data-platform','devilndove','rosiedazzlers','yw','icamp','rosevear-ai-hub')),
 repository text not null,
 review_kind text not null check(review_kind in
  ('nonproduction_test_authorization_evidence_intake',
   'independent_seven_denial_receipt_reconciliation','reversible_hold_decision_watch')),
 outcome_kind text not null check(outcome_kind in
  ('authorization_not_given','authorization_reference_unverified','two_sha_transport_pending',
   'authorization_exception_escalated','seven_denials_missing','denial_references_unverified',
   'denial_mismatch_escalated','hold_reaffirmed','hold_exception_escalated','hold_rollback_watch_due')),
 test_authorization_reference text check(test_authorization_reference is null or
  test_authorization_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 authorization_reference_status text not null default 'NOT_GIVEN' check(authorization_reference_status in
  ('NOT_GIVEN','REFERENCE_UNVERIFIED')),
 two_sha_agreement_status text not null default 'NOT_AGREED' check(two_sha_agreement_status in
  ('NOT_AGREED','REFERENCE_UNVERIFIED')),
 two_sha_agreement_reference text check(two_sha_agreement_reference is null or
  two_sha_agreement_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 source_revision_sha text check(source_revision_sha is null or source_revision_sha ~ '^[a-f0-9]{40}$'),
 proof_commit_sha text check(proof_commit_sha is null or proof_commit_sha ~ '^[a-f0-9]{40}$'),
 proof_sha256 text check(proof_sha256 is null or proof_sha256 ~ '^[a-f0-9]{64}$'),
 ci_run_url text check(ci_run_url is null or ci_run_url ~
  '^https://github[.]com/RosevearCreations/[A-Za-z0-9-]+/actions/runs/[0-9]{1,20}$'),
 denial_receipt_ids text[] not null default '{}',
 denial_witness_reference text check(denial_witness_reference is null or
  denial_witness_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 observed_denial_receipt_ids_provided integer not null default 0 check
  (observed_denial_receipt_ids_provided between 0 and 7),
 rollback_reference text check(rollback_reference is null or
  rollback_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 revocation_reference text check(revocation_reference is null or
  revocation_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_open_143_exceptions integer not null default 0 check(observed_open_143_exceptions>=0),
 observed_overdue_143_leaves integer not null default 0 check(observed_overdue_143_leaves>=0),
 phase_b_test_authorized boolean not null default false check(phase_b_test_authorized=false),
 seven_denials_independently_witnessed boolean not null default false check(seven_denials_independently_witnessed=false),
 source_proof_signature_verified boolean not null default false check(source_proof_signature_verified=false),
 two_sha_origin_verified boolean not null default false check(two_sha_origin_verified=false),
 original_gateway_receipts_verified boolean not null default false check(original_gateway_receipts_verified=false),
 scoped_key_revocation_verified boolean not null default false check(scoped_key_revocation_verified=false),
 owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false),
 dispatch_enabled boolean not null default false check(dispatch_enabled=false),
 connection_state text not null default 'DISCONNECTED' check(connection_state='DISCONNECTED'),
 gate_state text not null default 'HOLD' check(gate_state='HOLD'),
 next_due_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint ql247_test_pair check(source_campground_id<>target_campground_id),
 constraint ql247_test_outcome_stage check(
  (review_kind='nonproduction_test_authorization_evidence_intake' and outcome_kind in
   ('authorization_not_given','authorization_reference_unverified','two_sha_transport_pending','authorization_exception_escalated')) or
  (review_kind='independent_seven_denial_receipt_reconciliation' and outcome_kind in
   ('seven_denials_missing','denial_references_unverified','denial_mismatch_escalated')) or
  (review_kind='reversible_hold_decision_watch' and outcome_kind in
   ('hold_reaffirmed','hold_exception_escalated','hold_rollback_watch_due'))),
 constraint ql247_authorization_stage_only check(
  review_kind='nonproduction_test_authorization_evidence_intake' or
  (test_authorization_reference is null and authorization_reference_status='NOT_GIVEN'
   and two_sha_agreement_status='NOT_AGREED' and two_sha_agreement_reference is null
   and source_revision_sha is null and proof_commit_sha is null and proof_sha256 is null
   and ci_run_url is null)),
 constraint ql247_denial_stage_only check(review_kind='independent_seven_denial_receipt_reconciliation'
  or (cardinality(denial_receipt_ids)=0 and denial_witness_reference is null)),
 constraint ql247_rollback_stage_only check(review_kind='reversible_hold_decision_watch'
  or (rollback_reference is null and revocation_reference is null)),
 constraint ql247_transport_pair check(
  (source_revision_sha is null and proof_commit_sha is null and proof_sha256 is null and ci_run_url is null)
  or (source_revision_sha is not null and proof_commit_sha is not null
    and source_revision_sha<>proof_commit_sha and proof_sha256 is not null and ci_run_url is not null)),
 constraint ql247_test_auth_reference_pair check(
  (authorization_reference_status='NOT_GIVEN' and test_authorization_reference is null)
  or (authorization_reference_status='REFERENCE_UNVERIFIED' and test_authorization_reference is not null)),
 constraint ql247_two_sha_agreement_pair check(
  (two_sha_agreement_status='NOT_AGREED' and two_sha_agreement_reference is null)
  or (two_sha_agreement_status='REFERENCE_UNVERIFIED' and two_sha_agreement_reference is not null))
);
create unique index ql247_test_first_idx on public.owner_export_ql247_test_receipt_hold_watches(ql246_hold_decision_id)
 where prior_review_id is null;
create index ql247_test_pair_idx on public.owner_export_ql247_test_receipt_hold_watches
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql247_test_due_idx on public.owner_export_ql247_test_receipt_hold_watches(next_due_at);

create function icamp_private.ql247_test_receipt_hold_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; predecessor record; due_reference timestamptz; expected_repo text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,144144));
 select * into base from public.owner_export_ql246_exception_pin_hold_decisions
  where id=new.ql246_hold_decision_id;
 if base.id is null or base.review_kind<>'multi_application_hold_gate_decision'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.source_system<>new.source_system or base.repository<>new.repository
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.phase_b_test_authorized or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'QL-247 must root in same-tenant Build 143 independent HOLD gate'; end if;
 expected_repo:=case new.source_system
  when 'ai-data-platform' then 'RosevearCreations/ai-data-platform'
  when 'devilndove' then 'RosevearCreations/devilndove-site'
  when 'rosiedazzlers' then 'RosevearCreations/rosiedazzlers'
  when 'yw' then 'RosevearCreations/yw'
  when 'icamp' then 'RosevearCreations/iCamp'
  else 'RosevearCreations/rosevear-ai-hub' end;
 if new.repository<>expected_repo then raise exception 'Source/repository mismatch'; end if;
 if new.ci_run_url is not null and new.ci_run_url not like
  'https://github.com/'||expected_repo||'/actions/runs/%' then
  raise exception 'CI URL must correspond to the recorded source repository'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_review_id is null then
  if new.review_kind<>'nonproduction_test_authorization_evidence_intake' then
   raise exception 'Begin with nonproduction authorization evidence intake'; end if;
  due_reference:=base.next_due_at;
 else
  select * into predecessor from public.owner_export_ql247_test_receipt_hold_watches
   where id=new.prior_review_id;
  if predecessor.id is null or predecessor.ql246_hold_decision_id<>new.ql246_hold_decision_id
   or predecessor.source_campground_id<>new.source_campground_id
   or predecessor.target_campground_id<>new.target_campground_id
   or predecessor.source_system<>new.source_system or predecessor.repository<>new.repository then
   raise exception 'Immutable same-root tenant and source continuity required'; end if;
  if not ((predecessor.review_kind='nonproduction_test_authorization_evidence_intake'
    and new.review_kind='independent_seven_denial_receipt_reconciliation') or
   (predecessor.review_kind='independent_seven_denial_receipt_reconciliation'
    and new.review_kind='reversible_hold_decision_watch') or
   (predecessor.review_kind='reversible_hold_decision_watch'
    and new.review_kind='nonproduction_test_authorization_evidence_intake')) then
   raise exception 'Authorization, seven denial receipts and HOLD watch must be independently sequenced'; end if;
  if predecessor.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'Independent reviewer must differ from preceding author'; end if;
  due_reference:=predecessor.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'Build 143 author cannot self-verify authorization or denial evidence'; end if;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 select count(*) filter(where r.outcome_kind in
  ('proof_missing','proof_blocked','proof_exception_escalated','pin_not_provisioned',
   'pin_mismatch_escalated','six_app_exception_escalated','owner_test_authorization_absent'))::int,
  count(*) filter(where r.next_due_at<new.reviewed_at)::int
  into new.observed_open_143_exceptions,new.observed_overdue_143_leaves
  from public.owner_export_ql246_exception_pin_hold_decisions r
  where r.source_campground_id=new.source_campground_id
   and r.target_campground_id=new.target_campground_id
   and not exists(select 1 from public.owner_export_ql246_exception_pin_hold_decisions child
    where child.prior_review_id=r.id);
 if new.review_kind='nonproduction_test_authorization_evidence_intake' then
  if new.outcome_kind='authorization_not_given' and
    (new.authorization_reference_status<>'NOT_GIVEN' or new.source_revision_sha is not null) then
   raise exception 'No authorization cannot claim signed proof commit or test approval'; end if;
  if new.outcome_kind='authorization_reference_unverified' and
    new.authorization_reference_status<>'REFERENCE_UNVERIFIED' then
   raise exception 'Unverified test reference requires a real nonsecret reference'; end if;
  if new.outcome_kind='two_sha_transport_pending' and
    (new.two_sha_agreement_status<>'NOT_AGREED' or new.source_revision_sha is not null) then
   raise exception 'QL-248 amendment is proposed, not proof of an accepted source commit'; end if;
 end if;
 if new.review_kind='independent_seven_denial_receipt_reconciliation' then
  if cardinality(new.denial_receipt_ids)>7 or exists(
   select 1 from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id)
    where id is null or id !~ '^(nonce_replay_denied|stale_request_denied|cross_business_denied|cross_tenant_denied|revoked_key_denied|write_denied|dispatch_denied)[|]np-[A-Za-z0-9._:-]{5,157}$') or
   (select count(distinct pg_catalog.split_part(id,'|',1))
    from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id))
    <>cardinality(new.denial_receipt_ids) or
   (select count(distinct pg_catalog.split_part(id,'|',2))
    from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id))
    <>cardinality(new.denial_receipt_ids) then
   raise exception 'Only up to seven distinct nonsecret original denial receipt IDs'; end if;
  if new.outcome_kind='seven_denials_missing' and cardinality(new.denial_receipt_ids)>0 then
   raise exception 'Missing receipts cannot imply original denial IDs'; end if;
  if new.outcome_kind='denial_references_unverified' and
   (cardinality(new.denial_receipt_ids)<>7 or new.denial_witness_reference is null) then
   raise exception 'All seven original references and separate witness index required for UNVERIFIED review'; end if;
  if new.outcome_kind='denial_mismatch_escalated' and cardinality(new.denial_receipt_ids)=0 then
   raise exception 'Escalated denial mismatch requires at least one actual observed receipt ID'; end if;
 end if;
 if new.outcome_kind='hold_exception_escalated' and
  new.observed_open_143_exceptions=0 and new.observed_overdue_143_leaves=0 then
  raise exception 'Recurrence escalation requires database-observed Build 143 exceptions'; end if;
 if new.next_due_at<=new.reviewed_at or new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Independent follow-up must be due within 90 days'; end if;
 new.observed_denial_receipt_ids_provided:=cardinality(new.denial_receipt_ids);
 -- Public references, even seven of them, NEVER constitute witnessed original gateway proof.
 new.phase_b_test_authorized:=false;
 new.seven_denials_independently_witnessed:=false;
 new.source_proof_signature_verified:=false;
 new.two_sha_origin_verified:=false;
 new.original_gateway_receipts_verified:=false;
 new.scoped_key_revocation_verified:=false;
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql247_test_receipt_hold_guard before insert
 on public.owner_export_ql247_test_receipt_hold_watches for each row
 execute function icamp_private.ql247_test_receipt_hold_guard();
create trigger ql247_test_receipt_hold_immutable before update or delete
 on public.owner_export_ql247_test_receipt_hold_watches for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql247_test_receipt_hold_watches enable row level security;
alter table public.owner_export_ql247_test_receipt_hold_watches force row level security;
revoke all on public.owner_export_ql247_test_receipt_hold_watches from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql247_test_receipt_hold_watches from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql247_test_receipt_hold_watches to icamp_app;
create policy ql247_test_receipt_hold_select on public.owner_export_ql247_test_receipt_hold_watches
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql247_test_receipt_hold_insert on public.owner_export_ql247_test_receipt_hold_watches
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql247_test_receipt_hold_guard() from public;
