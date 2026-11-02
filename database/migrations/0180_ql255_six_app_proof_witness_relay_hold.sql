-- Build 150 QL-255: source-origin, private witness and reversible relay
-- readiness findings. Entire chain is a documentary HOLD, never approval.
create table public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews (
 id uuid primary key,
 ql254_review_id uuid not null references public.owner_export_ql254_original_proof_registry_owner_hold_reviews(id),
 prior_review_id uuid unique references public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 source_system text not null check(source_system in ('ai-data-platform','devilndove','rosiedazzlers','yw','icamp','rosevear-ai-hub')),
 repository text not null,
 review_kind text not null check(review_kind in
  ('six_app_original_proof_disposition','private_witness_custody_exception_escalation','reversible_private_relay_test_readiness')),
 outcome_kind text not null check(outcome_kind in
  ('immutable_original_proof_404_hold','public_json_candidate_untrusted_hold','public_source_origin_exception_hold',
  'original_witness_missing_hold','witness_receipts_claimed_unverified_hold','signer_witness_pin_discrepancy_hold',
  'private_relay_not_configured_hold','synthetic_rollback_plan_only_hold','private_owner_review_requested_hold')),
 observed_main_sha text check(observed_main_sha is null or observed_main_sha~'^[a-f0-9]{40}$'),
 source_sha_a text check(source_sha_a is null or source_sha_a~'^[a-f0-9]{40}$'),
 source_ci_run_url text,
 proof_commit_sha_b text check(proof_commit_sha_b is null or proof_commit_sha_b~'^[a-f0-9]{40}$'),
 proof_sha256 text check(proof_sha256 is null or proof_sha256~'^[a-f0-9]{64}$'),
 proof_http_status text not null default 'NOT_CHECKED' check(proof_http_status in ('404','200','UNAVAILABLE','NOT_CHECKED')),
 public_audit_reference text check(public_audit_reference is null or public_audit_reference~'^np-[A-Za-z0-9._:-]{5,157}$'),
 registry_snapshot_sha256 text check(registry_snapshot_sha256 is null or registry_snapshot_sha256~'^[a-f0-9]{64}$'),
 signer_pin_sha256 text check(signer_pin_sha256 is null or signer_pin_sha256~'^[a-f0-9]{64}$'),
 witness_pin_sha256 text check(witness_pin_sha256 is null or witness_pin_sha256~'^[a-f0-9]{64}$'),
 custodian_receipt_id text check(custodian_receipt_id is null or custodian_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 witness_receipt_id text check(witness_receipt_id is null or witness_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 registry_receipt_id text check(registry_receipt_id is null or registry_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 nonce_challenge_sha256 text check(nonce_challenge_sha256 is null or nonce_challenge_sha256~'^[a-f0-9]{64}$'),
 nonce_issued_at timestamptz,
 nonce_expires_at timestamptz,
 relay_plan_kind text not null default 'NOT_CONFIGURED' check(relay_plan_kind in
  ('NOT_CONFIGURED','OUTBOUND_PLAN_ONLY','SYNTHETIC_ROLLBACK_REHEARSED')),
 relay_plan_reference text check(relay_plan_reference is null or relay_plan_reference~'^np-[A-Za-z0-9._:-]{5,157}$'),
 health_interval_seconds integer check(health_interval_seconds is null or health_interval_seconds between 30 and 300),
 test_tenant_id text check(test_tenant_id is null or test_tenant_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 test_window_start timestamptz,
 test_window_end timestamptz,
 allowed_methods text[] not null default array['GET']::text[] check(allowed_methods=array['GET']::text[]),
 allowed_paths text[] not null default array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]
  check(allowed_paths=array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]),
 observed_original_denial_gap integer not null default 7 check(observed_original_denial_gap between 0 and 7),
 observed_private_receipt_index_gap integer not null default 3 check(observed_private_receipt_index_gap between 0 and 3),
 observed_custody_age_days integer not null default 0 check(observed_custody_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 source_proof_independently_trusted boolean not null default false check(source_proof_independently_trusted=false),
 custody_privately_verified boolean not null default false check(custody_privately_verified=false),
 witness_real_world_identity_verified boolean not null default false check(witness_real_world_identity_verified=false),
 owner_test_authorized boolean not null default false check(owner_test_authorized=false),
 owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false),
 relay_installed boolean not null default false check(relay_installed=false),
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
 constraint ql255_150_two_tenants check(source_campground_id<>target_campground_id),
 constraint ql255_150_stage_outcome check(
  (review_kind='six_app_original_proof_disposition' and outcome_kind in
   ('immutable_original_proof_404_hold','public_json_candidate_untrusted_hold','public_source_origin_exception_hold')) or
  (review_kind='private_witness_custody_exception_escalation' and outcome_kind in
   ('original_witness_missing_hold','witness_receipts_claimed_unverified_hold','signer_witness_pin_discrepancy_hold')) or
  (review_kind='reversible_private_relay_test_readiness' and outcome_kind in
   ('private_relay_not_configured_hold','synthetic_rollback_plan_only_hold','private_owner_review_requested_hold'))),
 constraint ql255_150_source_only check(review_kind='six_app_original_proof_disposition' or
  (observed_main_sha is null and source_sha_a is null and source_ci_run_url is null
   and proof_commit_sha_b is null and proof_sha256 is null and proof_http_status='NOT_CHECKED'
   and public_audit_reference is null)),
 constraint ql255_150_witness_only check(review_kind='private_witness_custody_exception_escalation' or
  (registry_snapshot_sha256 is null and signer_pin_sha256 is null and witness_pin_sha256 is null
   and custodian_receipt_id is null and witness_receipt_id is null and registry_receipt_id is null
   and nonce_challenge_sha256 is null and nonce_issued_at is null and nonce_expires_at is null)),
 constraint ql255_150_relay_only check(review_kind='reversible_private_relay_test_readiness' or
  (relay_plan_kind='NOT_CONFIGURED' and relay_plan_reference is null and health_interval_seconds is null
   and test_tenant_id is null and test_window_start is null and test_window_end is null)),
 constraint ql255_150_source_ci_pair check((source_sha_a is null and source_ci_run_url is null)
  or (source_sha_a is not null and source_ci_run_url is not null)),
 constraint ql255_150_nonce_bound check(nonce_issued_at is null or
  (nonce_expires_at>nonce_issued_at and nonce_expires_at<=nonce_issued_at+interval '5 minutes')),
 constraint ql255_150_test_bound check(test_window_start is null or
  (test_window_end>test_window_start and test_window_end<=test_window_start+interval '30 minutes'))
);
create unique index ql255_150_first_idx on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews(ql254_review_id)
 where prior_review_id is null;
create index ql255_150_pair_idx on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql255_150_due_idx on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews(next_due_at);

create function icamp_private.ql255_150_six_app_proof_witness_relay_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; predecessor record; due_reference timestamptz; expected_repo text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,150255));
 select * into base from public.owner_export_ql254_original_proof_registry_owner_hold_reviews
  where id=new.ql254_review_id;
 if base.id is null or base.review_kind<>'private_owner_test_decision_continuity'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.source_system<>new.source_system or base.repository<>new.repository
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.owner_test_authorized or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'QL-255 must continue a same-tenant Build 149 private owner HOLD'; end if;
 expected_repo:=case new.source_system
  when 'ai-data-platform' then 'RosevearCreations/ai-data-platform'
  when 'devilndove' then 'RosevearCreations/devilndove-site'
  when 'rosiedazzlers' then 'RosevearCreations/rosiedazzlers'
  when 'yw' then 'RosevearCreations/yw'
  when 'icamp' then 'RosevearCreations/iCamp'
  else 'RosevearCreations/rosevear-ai-hub' end;
 if new.repository<>expected_repo then raise exception 'QL-255 original repository mismatch'; end if;
 if new.source_ci_run_url is not null and new.source_ci_run_url not like
  'https://github.com/'||expected_repo||'/actions/runs/%' then
  raise exception 'QL-255 original CI belongs to another repository'; end if;
 new.reviewed_at:=clock_timestamp();
 new.observed_original_denial_gap:=base.observed_original_denial_gap;
 new.observed_private_receipt_index_gap:=base.observed_private_receipt_index_gap;
 new.observed_custody_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 if new.prior_review_id is null then
  if new.review_kind<>'six_app_original_proof_disposition' then
   raise exception 'QL-255 begins with public origin disposition'; end if;
  due_reference:=base.next_due_at;
 else
  select * into predecessor from public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews
   where id=new.prior_review_id;
  if predecessor.id is null or predecessor.ql254_review_id<>new.ql254_review_id
   or predecessor.source_campground_id<>new.source_campground_id
   or predecessor.target_campground_id<>new.target_campground_id
   or predecessor.source_system<>new.source_system or predecessor.repository<>new.repository then
   raise exception 'QL-255 immutable chain needs same original tenant/source'; end if;
  if not ((predecessor.review_kind='six_app_original_proof_disposition' and
   new.review_kind='private_witness_custody_exception_escalation') or
   (predecessor.review_kind='private_witness_custody_exception_escalation' and
   new.review_kind='reversible_private_relay_test_readiness') or
   (predecessor.review_kind='reversible_private_relay_test_readiness' and
   new.review_kind='six_app_original_proof_disposition')) then
   raise exception 'QL-255 source → witness → relay stage order violated'; end if;
  if predecessor.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'QL-255 requires independent next reviewer'; end if;
  due_reference:=predecessor.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'QL-255 reviewer cannot self-attest the Build 149 owner root'; end if;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 if new.review_kind='six_app_original_proof_disposition' then
  if new.observed_main_sha is null then raise exception 'QL-255 requires exact public main SHA'; end if;
  if new.outcome_kind='immutable_original_proof_404_hold' and
   (new.proof_http_status<>'404' or new.proof_commit_sha_b is not null
    or new.proof_sha256 is not null or new.public_audit_reference is not null) then
   raise exception 'Original 404 cannot carry invented B or signature bytes'; end if;
  if new.outcome_kind='public_json_candidate_untrusted_hold' and
   (new.proof_http_status<>'200' or new.source_sha_a is null or new.proof_commit_sha_b is null
    or new.proof_sha256 is null or new.public_audit_reference is null
    or new.source_sha_a=new.proof_commit_sha_b) then
   raise exception 'QL-255 200 still untrusted, needs authentic A/CI/B and raw digest'; end if;
  if new.outcome_kind='public_source_origin_exception_hold' and new.public_audit_reference is null then
   raise exception 'Public origin exception needs original nonsecret index'; end if;
 end if;
 if new.review_kind='private_witness_custody_exception_escalation' then
  if new.outcome_kind='original_witness_missing_hold' and
   (new.registry_snapshot_sha256 is not null or new.signer_pin_sha256 is not null
    or new.witness_pin_sha256 is not null or new.custodian_receipt_id is not null
    or new.witness_receipt_id is not null or new.registry_receipt_id is not null
    or new.nonce_challenge_sha256 is not null or new.nonce_issued_at is not null
    or new.nonce_expires_at is not null) then
   raise exception 'QL-255 cannot fabricate a missing witness'; end if;
  if new.outcome_kind<>'original_witness_missing_hold' and
   (new.registry_snapshot_sha256 is null or new.signer_pin_sha256 is null
    or new.witness_pin_sha256 is null or new.custodian_receipt_id is null
    or new.witness_receipt_id is null or new.registry_receipt_id is null
    or new.nonce_challenge_sha256 is null or new.nonce_issued_at is null
    or new.nonce_expires_at is null or new.signer_pin_sha256=new.witness_pin_sha256
    or new.custodian_receipt_id=new.witness_receipt_id
    or new.custodian_receipt_id=new.registry_receipt_id
    or new.witness_receipt_id=new.registry_receipt_id
    or new.nonce_issued_at>new.reviewed_at) then
   raise exception 'QL-255 private witness claim needs independent distinct original indexes'; end if;
 end if;
 if new.review_kind='reversible_private_relay_test_readiness' then
  if new.relay_plan_kind='NOT_CONFIGURED' and
   (new.relay_plan_reference is not null or new.health_interval_seconds is not null) then
   raise exception 'QL-255 no service was configured'; end if;
  if new.relay_plan_kind<>'NOT_CONFIGURED' and
   (new.relay_plan_reference is null or new.health_interval_seconds is null
    or new.health_interval_seconds not between 30 and 300) then
   raise exception 'QL-255 requires nonsecret private relay planning only'; end if;
  if new.outcome_kind='private_owner_review_requested_hold' and
   (new.test_tenant_id is null or new.test_window_start is null or new.test_window_end is null
    or new.test_window_start<=new.reviewed_at) then
   raise exception 'QL-255 owner review needs nonproduction future ≤30m scope'; end if;
  if new.outcome_kind<>'private_owner_review_requested_hold' and
   (new.test_tenant_id is not null or new.test_window_start is not null or new.test_window_end is not null) then
   raise exception 'QL-255 no owner TEST scope unless privately requested'; end if;
 end if;
 if new.next_due_at<=new.reviewed_at or new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'QL-255 independent follow-up must be due in 90 days'; end if;
 new.source_proof_independently_trusted:=false;
 new.custody_privately_verified:=false;
 new.witness_real_world_identity_verified:=false;
 new.owner_test_authorized:=false;
 new.owner_pilot_authorized:=false;
 new.relay_installed:=false;
 new.relay_running:=false;
 new.home_endpoint_exposed:=false;
 new.dispatch_enabled:=false;
 new.actual_gateway_test:='NOT_RUN';
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql255_150_six_app_proof_witness_relay_guard before insert
 on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews for each row
 execute function icamp_private.ql255_150_six_app_proof_witness_relay_guard();
create trigger ql255_150_six_app_proof_witness_relay_immutable before update or delete
 on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews enable row level security;
alter table public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews force row level security;
revoke all on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews to icamp_app;
create policy ql255_150_six_app_proof_witness_relay_select
 on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql255_150_six_app_proof_witness_relay_insert
 on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql255_150_six_app_proof_witness_relay_guard() from public;
