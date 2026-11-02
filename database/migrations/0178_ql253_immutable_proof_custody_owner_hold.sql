-- Build 148: immutable QL-253 public-proof retest, private custody challenge
-- claim review and owner TEST-only decision reconciliation. No live dispatch.
create table public.owner_export_ql253_proof_custody_owner_hold_reviews (
 id uuid primary key,
 ql252_review_id uuid not null references public.owner_export_ql252_proof_denial_hold_reviews(id),
 prior_review_id uuid unique references public.owner_export_ql253_proof_custody_owner_hold_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 source_system text not null check(source_system in
  ('ai-data-platform','devilndove','rosiedazzlers','yw','icamp','rosevear-ai-hub')),
 repository text not null,
 review_kind text not null check(review_kind in
  ('immutable_proof_publication_retest','independent_custody_pin_challenge_renewal',
   'owner_test_only_authorization_hold_reconciliation')),
 outcome_kind text not null check(outcome_kind in
  ('immutable_public_proof_404','published_candidate_origin_unverified','immutable_origin_or_ci_mismatch',
   'authenticated_custody_witness_missing','five_minute_nonce_claim_unverified',
   'custody_witness_pin_mismatch_escalated','owner_test_not_given_hold',
   'private_owner_test_review_requested_hold','owner_approval_receipt_claim_unverified_hold')),
 source_revision_sha text check(source_revision_sha is null or source_revision_sha~'^[a-f0-9]{40}$'),
 source_ci_run_url text,
 proof_commit_sha text check(proof_commit_sha is null or proof_commit_sha~'^[a-f0-9]{40}$'),
 proof_sha256 text check(proof_sha256 is null or proof_sha256~'^[a-f0-9]{64}$'),
 public_spki_sha256 text check(public_spki_sha256 is null or public_spki_sha256~'^[a-f0-9]{64}$'),
 proof_http_status text not null default 'NOT_CHECKED'
  check(proof_http_status in ('404','200','NOT_CHECKED')),
 source_audit_reference text check(source_audit_reference is null or source_audit_reference~'^np-[A-Za-z0-9._:-]{5,157}$'),
 custodian_receipt_id text check(custodian_receipt_id is null or custodian_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 distinct_witness_receipt_id text check(distinct_witness_receipt_id is null or distinct_witness_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 challenge_sha256 text check(challenge_sha256 is null or challenge_sha256~'^[a-f0-9]{64}$'),
 custody_pin_sha256 text check(custody_pin_sha256 is null or custody_pin_sha256~'^[a-f0-9]{64}$'),
 challenge_issued_at timestamptz,
 challenge_expires_at timestamptz,
 owner_test_receipt_id text check(owner_test_receipt_id is null or owner_test_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 test_tenant_id text check(test_tenant_id is null or test_tenant_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 test_window_start timestamptz,
 test_window_end timestamptz,
 allowed_methods text[] not null default array['GET']::text[] check(allowed_methods=array['GET']::text[]),
 allowed_paths text[] not null default array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]
  check(allowed_paths=array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]),
 observed_ql252_gap_count integer not null default 7 check(observed_ql252_gap_count between 0 and 7),
 observed_ql252_gap_age_days integer not null default 0 check(observed_ql252_gap_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 signed_proof_independently_trusted boolean not null default false check(signed_proof_independently_trusted=false),
 independent_custody_pin_verified boolean not null default false check(independent_custody_pin_verified=false),
 owner_test_authorized boolean not null default false check(owner_test_authorized=false),
 owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false),
 dispatch_enabled boolean not null default false check(dispatch_enabled=false),
 actual_gateway_test text not null default 'NOT_RUN' check(actual_gateway_test='NOT_RUN'),
 connection_state text not null default 'DISCONNECTED' check(connection_state='DISCONNECTED'),
 gate_state text not null default 'HOLD' check(gate_state='HOLD'),
 next_due_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint ql253_148_distinct_campgrounds check(source_campground_id<>target_campground_id),
 constraint ql253_148_kind_outcome check(
  (review_kind='immutable_proof_publication_retest' and outcome_kind in
   ('immutable_public_proof_404','published_candidate_origin_unverified','immutable_origin_or_ci_mismatch')) or
  (review_kind='independent_custody_pin_challenge_renewal' and outcome_kind in
   ('authenticated_custody_witness_missing','five_minute_nonce_claim_unverified','custody_witness_pin_mismatch_escalated')) or
  (review_kind='owner_test_only_authorization_hold_reconciliation' and outcome_kind in
   ('owner_test_not_given_hold','private_owner_test_review_requested_hold','owner_approval_receipt_claim_unverified_hold'))),
 constraint ql253_148_source_only check(review_kind='immutable_proof_publication_retest' or
  (source_revision_sha is null and source_ci_run_url is null and proof_commit_sha is null
   and proof_sha256 is null and public_spki_sha256 is null and source_audit_reference is null
   and proof_http_status='NOT_CHECKED')),
 constraint ql253_148_custody_only check(review_kind='independent_custody_pin_challenge_renewal' or
  (custodian_receipt_id is null and distinct_witness_receipt_id is null and challenge_sha256 is null
   and custody_pin_sha256 is null and challenge_issued_at is null and challenge_expires_at is null)),
 constraint ql253_148_owner_only check(review_kind='owner_test_only_authorization_hold_reconciliation' or
  (owner_test_receipt_id is null and test_tenant_id is null and test_window_start is null and test_window_end is null)),
 constraint ql253_148_ci_pair check((source_revision_sha is null and source_ci_run_url is null)
  or (source_revision_sha is not null and source_ci_run_url is not null)),
 constraint ql253_148_proof_pair check((proof_commit_sha is null and proof_sha256 is null)
  or (source_revision_sha is not null and proof_commit_sha is not null and proof_sha256 is not null
   and proof_commit_sha<>source_revision_sha)),
 constraint ql253_148_custody_window check(challenge_issued_at is null or
  (challenge_expires_at>challenge_issued_at
   and challenge_expires_at<=challenge_issued_at+interval '5 minutes')),
 constraint ql253_148_owner_window check(test_window_start is null or
  (test_window_end>test_window_start
   and test_window_end<=test_window_start+interval '30 minutes'))
);
create unique index ql253_148_first_review_idx
 on public.owner_export_ql253_proof_custody_owner_hold_reviews(ql252_review_id)
 where prior_review_id is null;
create index ql253_148_pair_idx on public.owner_export_ql253_proof_custody_owner_hold_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql253_148_due_idx on public.owner_export_ql253_proof_custody_owner_hold_reviews(next_due_at);

create function icamp_private.ql253_148_proof_custody_owner_hold_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; predecessor record; due_reference timestamptz; expected_repo text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,148253));
 select * into base from public.owner_export_ql252_proof_denial_hold_reviews
  where id=new.ql252_review_id;
 if base.id is null or base.review_kind<>'independent_owner_test_authorization_hold_review'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.source_system<>new.source_system or base.repository<>new.repository
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.owner_test_authorized or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'QL-253 root must be same-tenant Build 147 independent owner HOLD review'; end if;
 expected_repo:=case new.source_system
  when 'ai-data-platform' then 'RosevearCreations/ai-data-platform'
  when 'devilndove' then 'RosevearCreations/devilndove-site'
  when 'rosiedazzlers' then 'RosevearCreations/rosiedazzlers'
  when 'yw' then 'RosevearCreations/yw'
  when 'icamp' then 'RosevearCreations/iCamp'
  else 'RosevearCreations/rosevear-ai-hub' end;
 if new.repository<>expected_repo then raise exception 'QL-253 exact repository mismatch'; end if;
 if new.source_ci_run_url is not null and new.source_ci_run_url not like
  'https://github.com/'||expected_repo||'/actions/runs/%' then
  raise exception 'QL-253 source CI must match exact repository'; end if;
 new.reviewed_at:=clock_timestamp();
 new.observed_ql252_gap_count:=base.observed_root_gap_count;
 new.observed_ql252_gap_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 if new.prior_review_id is null then
  if new.review_kind<>'immutable_proof_publication_retest' then
   raise exception 'QL-253 must begin with public proof retest'; end if;
  due_reference:=base.next_due_at;
 else
  select * into predecessor from public.owner_export_ql253_proof_custody_owner_hold_reviews
   where id=new.prior_review_id;
  if predecessor.id is null or predecessor.ql252_review_id<>new.ql252_review_id
   or predecessor.source_campground_id<>new.source_campground_id
   or predecessor.target_campground_id<>new.target_campground_id
   or predecessor.source_system<>new.source_system or predecessor.repository<>new.repository then
   raise exception 'QL-253 prior reviewer chain must use exact root and tenant'; end if;
  if not ((predecessor.review_kind='immutable_proof_publication_retest'
    and new.review_kind='independent_custody_pin_challenge_renewal') or
   (predecessor.review_kind='independent_custody_pin_challenge_renewal'
    and new.review_kind='owner_test_only_authorization_hold_reconciliation') or
   (predecessor.review_kind='owner_test_only_authorization_hold_reconciliation'
    and new.review_kind='immutable_proof_publication_retest')) then
   raise exception 'QL-253 proof → custody → owner HOLD stages must cycle'; end if;
  if predecessor.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'QL-253 independent reviewer must differ from prior reviewer'; end if;
  due_reference:=predecessor.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'Build 147 owner HOLD reviewer cannot self-witness QL-253'; end if;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 if new.review_kind='immutable_proof_publication_retest' then
  if new.outcome_kind='immutable_public_proof_404' and
   (new.proof_http_status<>'404' or new.proof_commit_sha is not null
    or new.proof_sha256 is not null or new.public_spki_sha256 is not null
    or new.source_audit_reference is not null) then
   raise exception 'QL-253 404 cannot invent public proof B/digest/key'; end if;
  if new.outcome_kind='published_candidate_origin_unverified' and
   (new.proof_http_status<>'200' or new.source_revision_sha is null or new.source_ci_run_url is null
    or new.proof_commit_sha is null or new.proof_sha256 is null
    or new.public_spki_sha256 is null or new.source_audit_reference is null) then
   raise exception 'QL-253 candidate must have real public A/B/CI/pin/digest'; end if;
  if new.outcome_kind='immutable_origin_or_ci_mismatch' and new.source_audit_reference is null then
   raise exception 'QL-253 immutable mismatch requires original source audit index'; end if;
 end if;
 if new.review_kind='independent_custody_pin_challenge_renewal' then
  if new.outcome_kind='authenticated_custody_witness_missing' and
   (new.custodian_receipt_id is not null or new.distinct_witness_receipt_id is not null
    or new.challenge_sha256 is not null or new.custody_pin_sha256 is not null
    or new.challenge_issued_at is not null or new.challenge_expires_at is not null) then
   raise exception 'QL-253 missing custody cannot claim invented witness'; end if;
  if new.outcome_kind<>'authenticated_custody_witness_missing' and
   (new.custodian_receipt_id is null or new.distinct_witness_receipt_id is null
    or new.custodian_receipt_id=new.distinct_witness_receipt_id
    or new.challenge_sha256 is null or new.custody_pin_sha256 is null
    or new.challenge_issued_at is null or new.challenge_expires_at is null
    or new.challenge_issued_at>new.reviewed_at or new.challenge_expires_at>new.challenge_issued_at+interval '5 minutes') then
   raise exception 'QL-253 distinct custody and witness claim must bind a five-minute nonce'; end if;
 end if;
 if new.review_kind='owner_test_only_authorization_hold_reconciliation' then
  if new.outcome_kind='owner_test_not_given_hold' and
   (new.owner_test_receipt_id is not null or new.test_tenant_id is not null
    or new.test_window_start is not null or new.test_window_end is not null) then
   raise exception 'QL-253 owner NOT GIVEN cannot claim an authorization or window'; end if;
  if new.outcome_kind<>'owner_test_not_given_hold' and
   (new.test_tenant_id is null or new.test_window_start is null or new.test_window_end is null
    or new.test_window_start<=new.reviewed_at or new.test_window_end>new.test_window_start+interval '30 minutes'
    or (new.outcome_kind='owner_approval_receipt_claim_unverified_hold' and new.owner_test_receipt_id is null)
    or (new.outcome_kind='private_owner_test_review_requested_hold' and new.owner_test_receipt_id is not null)) then
   raise exception 'QL-253 owner TEST claim must be future GET-only nonproduction scope, never an approval'; end if;
 end if;
 if new.next_due_at<=new.reviewed_at or new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'QL-253 independent HOLD follow-up due within 90 days'; end if;
 -- No original authenticated out-of-band evidence, no rights granted.
 new.signed_proof_independently_trusted:=false;
 new.independent_custody_pin_verified:=false;
 new.owner_test_authorized:=false;
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 new.actual_gateway_test:='NOT_RUN';
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql253_148_proof_custody_owner_hold_guard before insert
 on public.owner_export_ql253_proof_custody_owner_hold_reviews for each row
 execute function icamp_private.ql253_148_proof_custody_owner_hold_guard();
create trigger ql253_148_proof_custody_owner_hold_immutable before update or delete
 on public.owner_export_ql253_proof_custody_owner_hold_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql253_proof_custody_owner_hold_reviews enable row level security;
alter table public.owner_export_ql253_proof_custody_owner_hold_reviews force row level security;
revoke all on public.owner_export_ql253_proof_custody_owner_hold_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql253_proof_custody_owner_hold_reviews from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql253_proof_custody_owner_hold_reviews to icamp_app;
create policy ql253_148_proof_custody_owner_select
 on public.owner_export_ql253_proof_custody_owner_hold_reviews for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql253_148_proof_custody_owner_insert
 on public.owner_export_ql253_proof_custody_owner_hold_reviews for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql253_148_proof_custody_owner_hold_guard() from public;
