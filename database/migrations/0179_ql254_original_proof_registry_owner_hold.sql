-- Build 149 QL-254: original source-publication, independent private pin
-- registry/witness and owner TEST continuity. Claims never enable connection.
create table public.owner_export_ql254_original_proof_registry_owner_hold_reviews (
 id uuid primary key,
 ql253_review_id uuid not null references public.owner_export_ql253_proof_custody_owner_hold_reviews(id),
 prior_review_id uuid unique references public.owner_export_ql254_original_proof_registry_owner_hold_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 source_system text not null check(source_system in
  ('ai-data-platform','devilndove','rosiedazzlers','yw','icamp','rosevear-ai-hub')),
 repository text not null,
 review_kind text not null check(review_kind in
  ('original_immutable_source_proof_refresh','private_registry_custody_witness_aging',
   'private_owner_test_decision_continuity')),
 outcome_kind text not null check(outcome_kind in
  ('immutable_proof_still_404','signed_proof_candidate_untrusted',
   'original_source_ci_ancestry_exception','original_registry_witness_missing',
   'registry_snapshot_claim_unverified','private_pin_witness_discrepancy_escalated',
   'owner_test_not_given_hold','private_test_review_requested_hold',
   'owner_receipt_claim_unverified_hold')),
 main_revision_sha text check(main_revision_sha is null or main_revision_sha~'^[a-f0-9]{40}$'),
 source_revision_sha text check(source_revision_sha is null or source_revision_sha~'^[a-f0-9]{40}$'),
 source_ci_run_url text,
 proof_commit_sha text check(proof_commit_sha is null or proof_commit_sha~'^[a-f0-9]{40}$'),
 proof_sha256 text check(proof_sha256 is null or proof_sha256~'^[a-f0-9]{64}$'),
 public_spki_sha256 text check(public_spki_sha256 is null or public_spki_sha256~'^[a-f0-9]{64}$'),
 proof_http_status text not null default 'NOT_CHECKED' check(proof_http_status in ('404','200','NOT_CHECKED')),
 source_audit_reference text check(source_audit_reference is null or source_audit_reference~'^np-[A-Za-z0-9._:-]{5,157}$'),
 registry_snapshot_sha256 text check(registry_snapshot_sha256 is null or registry_snapshot_sha256~'^[a-f0-9]{64}$'),
 registry_receipt_id text check(registry_receipt_id is null or registry_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 custodian_receipt_id text check(custodian_receipt_id is null or custodian_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 witness_receipt_id text check(witness_receipt_id is null or witness_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 registry_pin_sha256 text check(registry_pin_sha256 is null or registry_pin_sha256~'^[a-f0-9]{64}$'),
 nonce_challenge_sha256 text check(nonce_challenge_sha256 is null or nonce_challenge_sha256~'^[a-f0-9]{64}$'),
 nonce_issued_at timestamptz,
 nonce_expires_at timestamptz,
 owner_test_receipt_id text check(owner_test_receipt_id is null or owner_test_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 test_tenant_id text check(test_tenant_id is null or test_tenant_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 test_window_start timestamptz,
 test_window_end timestamptz,
 relay_readiness text not null default 'NOT_CONFIGURED' check(relay_readiness in ('NOT_CONFIGURED','PRIVATE_PLAN_ONLY')),
 allowed_methods text[] not null default array['GET']::text[] check(allowed_methods=array['GET']::text[]),
 allowed_paths text[] not null default array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]
  check(allowed_paths=array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]),
 observed_original_denial_gap integer not null default 7 check(observed_original_denial_gap between 0 and 7),
 observed_custody_evidence_age_days integer not null default 0 check(observed_custody_evidence_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_private_receipt_index_gap integer not null default 3 check(observed_private_receipt_index_gap between 0 and 3),
 original_public_proof_trusted boolean not null default false check(original_public_proof_trusted=false),
 private_pin_registry_independently_verified boolean not null default false check(private_pin_registry_independently_verified=false),
 private_custodian_witness_verified boolean not null default false check(private_custodian_witness_verified=false),
 owner_test_authorized boolean not null default false check(owner_test_authorized=false),
 owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false),
 relay_running boolean not null default false check(relay_running=false),
 home_endpoint_exposed boolean not null default false check(home_endpoint_exposed=false),
 dispatch_enabled boolean not null default false check(dispatch_enabled=false),
 actual_gateway_test text not null default 'NOT_RUN' check(actual_gateway_test='NOT_RUN'),
 connection_state text not null default 'DISCONNECTED' check(connection_state='DISCONNECTED'),
 gate_state text not null default 'HOLD' check(gate_state='HOLD'),
 next_due_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint ql254_149_campgrounds_distinct check(source_campground_id<>target_campground_id),
 constraint ql254_149_stage_outcome check(
  (review_kind='original_immutable_source_proof_refresh' and outcome_kind in
   ('immutable_proof_still_404','signed_proof_candidate_untrusted','original_source_ci_ancestry_exception')) or
  (review_kind='private_registry_custody_witness_aging' and outcome_kind in
   ('original_registry_witness_missing','registry_snapshot_claim_unverified','private_pin_witness_discrepancy_escalated')) or
  (review_kind='private_owner_test_decision_continuity' and outcome_kind in
   ('owner_test_not_given_hold','private_test_review_requested_hold','owner_receipt_claim_unverified_hold'))),
 constraint ql254_149_source_stage_only check(review_kind='original_immutable_source_proof_refresh' or
  (main_revision_sha is null and source_revision_sha is null and source_ci_run_url is null
   and proof_commit_sha is null and proof_sha256 is null and public_spki_sha256 is null
   and proof_http_status='NOT_CHECKED' and source_audit_reference is null)),
 constraint ql254_149_registry_stage_only check(review_kind='private_registry_custody_witness_aging' or
  (registry_snapshot_sha256 is null and registry_receipt_id is null and custodian_receipt_id is null
   and witness_receipt_id is null and registry_pin_sha256 is null and nonce_challenge_sha256 is null
   and nonce_issued_at is null and nonce_expires_at is null)),
 constraint ql254_149_owner_stage_only check(review_kind='private_owner_test_decision_continuity' or
  (owner_test_receipt_id is null and test_tenant_id is null and test_window_start is null
   and test_window_end is null and relay_readiness='NOT_CONFIGURED')),
 constraint ql254_149_source_ci_pair check((source_revision_sha is null and source_ci_run_url is null)
  or (source_revision_sha is not null and source_ci_run_url is not null)),
 constraint ql254_149_proof_b_pair check((proof_commit_sha is null and proof_sha256 is null)
  or (source_revision_sha is not null and proof_commit_sha is not null and proof_sha256 is not null
   and source_revision_sha<>proof_commit_sha)),
 constraint ql254_149_nonce_window check(nonce_issued_at is null or
  (nonce_expires_at>nonce_issued_at and nonce_expires_at<=nonce_issued_at+interval '5 minutes')),
 constraint ql254_149_test_window check(test_window_start is null or
  (test_window_end>test_window_start and test_window_end<=test_window_start+interval '30 minutes'))
);
create unique index ql254_149_first_idx on public.owner_export_ql254_original_proof_registry_owner_hold_reviews(ql253_review_id)
 where prior_review_id is null;
create index ql254_149_pair_idx on public.owner_export_ql254_original_proof_registry_owner_hold_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql254_149_due_idx on public.owner_export_ql254_original_proof_registry_owner_hold_reviews(next_due_at);

create function icamp_private.ql254_149_original_proof_registry_owner_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; predecessor record; due_reference timestamptz; expected_repo text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,149254));
 select * into base from public.owner_export_ql253_proof_custody_owner_hold_reviews
  where id=new.ql253_review_id;
 if base.id is null or base.review_kind<>'owner_test_only_authorization_hold_reconciliation'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.source_system<>new.source_system or base.repository<>new.repository
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.owner_test_authorized or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'QL-254 root must be same-tenant Build 148 independent owner HOLD'; end if;
 expected_repo:=case new.source_system
  when 'ai-data-platform' then 'RosevearCreations/ai-data-platform'
  when 'devilndove' then 'RosevearCreations/devilndove-site'
  when 'rosiedazzlers' then 'RosevearCreations/rosiedazzlers'
  when 'yw' then 'RosevearCreations/yw'
  when 'icamp' then 'RosevearCreations/iCamp'
  else 'RosevearCreations/rosevear-ai-hub' end;
 if new.repository<>expected_repo then raise exception 'QL-254 exact repository mismatch'; end if;
 if new.source_ci_run_url is not null and new.source_ci_run_url not like
  'https://github.com/'||expected_repo||'/actions/runs/%' then
  raise exception 'QL-254 source A CI must belong to same repository'; end if;
 new.reviewed_at:=clock_timestamp();
 new.observed_original_denial_gap:=base.observed_ql252_gap_count;
 new.observed_custody_evidence_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 if new.prior_review_id is null then
  if new.review_kind<>'original_immutable_source_proof_refresh' then
   raise exception 'QL-254 begins with the immutable original source recheck'; end if;
  due_reference:=base.next_due_at;
 else
  select * into predecessor from public.owner_export_ql254_original_proof_registry_owner_hold_reviews
   where id=new.prior_review_id;
  if predecessor.id is null or predecessor.ql253_review_id<>new.ql253_review_id
   or predecessor.source_campground_id<>new.source_campground_id
   or predecessor.target_campground_id<>new.target_campground_id
   or predecessor.source_system<>new.source_system or predecessor.repository<>new.repository then
   raise exception 'QL-254 reviewer chain must use exact original tenant and root'; end if;
  if not ((predecessor.review_kind='original_immutable_source_proof_refresh'
    and new.review_kind='private_registry_custody_witness_aging') or
   (predecessor.review_kind='private_registry_custody_witness_aging'
    and new.review_kind='private_owner_test_decision_continuity') or
   (predecessor.review_kind='private_owner_test_decision_continuity'
    and new.review_kind='original_immutable_source_proof_refresh')) then
   raise exception 'QL-254 source → registry → private owner stages must cycle'; end if;
  if predecessor.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'QL-254 next independent reviewer must differ from prior author'; end if;
  due_reference:=predecessor.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'Build 148 owner HOLD author cannot self-witness QL-254'; end if;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 if new.review_kind='original_immutable_source_proof_refresh' then
  if new.main_revision_sha is null or new.source_revision_sha is null or new.source_ci_run_url is null then
   raise exception 'QL-254 original main SHA, A, and CI must be recorded'; end if;
  if new.outcome_kind='immutable_proof_still_404' and
   (new.proof_http_status<>'404' or new.proof_commit_sha is not null
    or new.proof_sha256 is not null or new.public_spki_sha256 is not null
    or new.source_audit_reference is not null) then
   raise exception 'QL-254 public 404 must not invent B/digest/pin'; end if;
  if new.outcome_kind='signed_proof_candidate_untrusted' and
   (new.proof_http_status<>'200' or new.proof_commit_sha is null
    or new.proof_sha256 is null or new.public_spki_sha256 is null
    or new.source_audit_reference is null) then
   raise exception 'QL-254 real public candidate requires B, raw digest, public pin and index'; end if;
  if new.outcome_kind='original_source_ci_ancestry_exception' and new.source_audit_reference is null then
   raise exception 'QL-254 source CI/ancestry exception requires original index'; end if;
 end if;
 if new.review_kind='private_registry_custody_witness_aging' then
  if new.outcome_kind='original_registry_witness_missing' and
   (new.registry_snapshot_sha256 is not null or new.registry_receipt_id is not null
    or new.custodian_receipt_id is not null or new.witness_receipt_id is not null
    or new.registry_pin_sha256 is not null or new.nonce_challenge_sha256 is not null
    or new.nonce_issued_at is not null or new.nonce_expires_at is not null) then
   raise exception 'QL-254 missing registry/witness cannot fabricate private evidence'; end if;
  if new.outcome_kind<>'original_registry_witness_missing' and
   (new.registry_snapshot_sha256 is null or new.registry_receipt_id is null
    or new.custodian_receipt_id is null or new.witness_receipt_id is null
    or new.registry_pin_sha256 is null or new.nonce_challenge_sha256 is null
    or new.nonce_issued_at is null or new.nonce_expires_at is null
    or new.registry_receipt_id=new.custodian_receipt_id
    or new.registry_receipt_id=new.witness_receipt_id
    or new.custodian_receipt_id=new.witness_receipt_id
    or new.nonce_issued_at>new.reviewed_at
    or new.nonce_expires_at>new.nonce_issued_at+interval '5 minutes') then
   raise exception 'QL-254 unverified registry claim requires three distinct receipts and bounded nonce'; end if;
  new.observed_private_receipt_index_gap:=3-(
    (new.registry_receipt_id is not null)::int+
    (new.custodian_receipt_id is not null)::int+
    (new.witness_receipt_id is not null)::int);
 end if;
 if new.review_kind='private_owner_test_decision_continuity' then
  if new.outcome_kind='owner_test_not_given_hold' and
   (new.owner_test_receipt_id is not null or new.test_tenant_id is not null
    or new.test_window_start is not null or new.test_window_end is not null) then
   raise exception 'QL-254 NOT_GIVEN cannot contain owner approval or trial scope'; end if;
  if new.outcome_kind<>'owner_test_not_given_hold' and
   (new.test_tenant_id is null or new.test_window_start is null or new.test_window_end is null
    or new.test_window_start<=new.reviewed_at or new.test_window_end>new.test_window_start+interval '30 minutes'
    or (new.outcome_kind='private_test_review_requested_hold' and new.owner_test_receipt_id is not null)
    or (new.outcome_kind='owner_receipt_claim_unverified_hold' and new.owner_test_receipt_id is null)) then
   raise exception 'QL-254 owner claim needs future scoped GET-only test tenant; no rights granted'; end if;
 end if;
 if new.next_due_at<=new.reviewed_at or new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'QL-254 HOLD follow-up due within 90 days'; end if;
 -- Registry lookup, challenge and owner identity require external authenticators.
 new.original_public_proof_trusted:=false;
 new.private_pin_registry_independently_verified:=false;
 new.private_custodian_witness_verified:=false;
 new.owner_test_authorized:=false;
 new.owner_pilot_authorized:=false;
 new.relay_running:=false;
 new.home_endpoint_exposed:=false;
 new.dispatch_enabled:=false;
 new.actual_gateway_test:='NOT_RUN';
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql254_149_original_proof_registry_owner_guard before insert
 on public.owner_export_ql254_original_proof_registry_owner_hold_reviews for each row
 execute function icamp_private.ql254_149_original_proof_registry_owner_guard();
create trigger ql254_149_original_proof_registry_owner_immutable before update or delete
 on public.owner_export_ql254_original_proof_registry_owner_hold_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql254_original_proof_registry_owner_hold_reviews enable row level security;
alter table public.owner_export_ql254_original_proof_registry_owner_hold_reviews force row level security;
revoke all on public.owner_export_ql254_original_proof_registry_owner_hold_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql254_original_proof_registry_owner_hold_reviews from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql254_original_proof_registry_owner_hold_reviews to icamp_app;
create policy ql254_149_original_proof_registry_owner_select
 on public.owner_export_ql254_original_proof_registry_owner_hold_reviews for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql254_149_original_proof_registry_owner_insert
 on public.owner_export_ql254_original_proof_registry_owner_hold_reviews for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql254_149_original_proof_registry_owner_guard() from public;
