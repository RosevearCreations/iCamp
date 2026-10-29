-- Build 147: QL-252 public source-proof 404, original denial gap aging,
-- and independent owner TEST-only authorization HOLD review.
-- This cannot publish a QL-246 signature, witness a gateway call, or grant access.
create table public.owner_export_ql252_proof_denial_hold_reviews (
 id uuid not null,
 ql248_source_review_id uuid not null references public.owner_export_ql248_source_receipt_exception_reassessments(id),
 prior_review_id uuid unique references public.owner_export_ql252_proof_denial_hold_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 source_system text not null check(source_system in
  ('ai-data-platform','devilndove','rosiedazzlers','yw','icamp','rosevear-ai-hub')),
 repository text not null,
 review_kind text not null check(review_kind in
  ('public_source_proof_continuity_audit','seven_denial_exception_aging_renewal',
   'independent_owner_test_authorization_hold_review')),
 outcome_kind text not null check(outcome_kind in
  ('public_ql246_proof_404_reported','public_proof_candidate_unverified','source_ci_or_proof_origin_exception',
   'seven_original_denials_missing','original_denial_indexes_unverified','original_denial_discrepancy_escalated',
   'owner_test_not_given_hold','owner_private_review_requested_hold','owner_approval_claim_unverified_hold')),
 source_revision_sha text check(source_revision_sha is null or source_revision_sha~'^[a-f0-9]{40}$'),
 source_ci_run_url text check(source_ci_run_url is null or source_ci_run_url~
  '^https://github[.]com/RosevearCreations/[A-Za-z0-9-]+/actions/runs/[0-9]{1,20}$'),
 proof_commit_sha text check(proof_commit_sha is null or proof_commit_sha~'^[a-f0-9]{40}$'),
 proof_sha256 text check(proof_sha256 is null or proof_sha256~'^[a-f0-9]{64}$'),
 public_spki_sha256 text check(public_spki_sha256 is null or public_spki_sha256~'^[a-f0-9]{64}$'),
 source_audit_reference text check(source_audit_reference is null or
  source_audit_reference~'^np-[A-Za-z0-9._:-]{5,157}$'),
 denial_receipt_ids text[] not null default '{}',
 denial_witness_reference text check(denial_witness_reference is null or
  denial_witness_reference~'^np-[A-Za-z0-9._:-]{5,157}$'),
 owner_test_receipt_id text check(owner_test_receipt_id is null or
  owner_test_receipt_id~'^np-[A-Za-z0-9._:-]{5,157}$'),
 observed_root_gap_count integer not null default 7 check(observed_root_gap_count between 0 and 7),
 observed_current_gap_count integer check(observed_current_gap_count between 0 and 7),
 observed_gap_age_days integer not null default 0 check(observed_gap_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_open_146_exceptions integer not null default 0 check(observed_open_146_exceptions>=0),
 observed_overdue_146_leaves integer not null default 0 check(observed_overdue_146_leaves>=0),
 original_proof_signature_verified boolean not null default false check(original_proof_signature_verified=false),
 independent_source_ci_verified boolean not null default false check(independent_source_ci_verified=false),
 proof_ancestry_verified boolean not null default false check(proof_ancestry_verified=false),
 independent_custody_pin_verified boolean not null default false check(independent_custody_pin_verified=false),
 seven_denials_independently_witnessed boolean not null default false check(seven_denials_independently_witnessed=false),
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
 constraint ql252_147_pair_distinct check(source_campground_id<>target_campground_id),
 constraint ql252_147_stage_outcome check(
  (review_kind='public_source_proof_continuity_audit' and outcome_kind in
   ('public_ql246_proof_404_reported','public_proof_candidate_unverified','source_ci_or_proof_origin_exception')) or
  (review_kind='seven_denial_exception_aging_renewal' and outcome_kind in
   ('seven_original_denials_missing','original_denial_indexes_unverified','original_denial_discrepancy_escalated')) or
  (review_kind='independent_owner_test_authorization_hold_review' and outcome_kind in
   ('owner_test_not_given_hold','owner_private_review_requested_hold','owner_approval_claim_unverified_hold'))),
 constraint ql252_147_stage_source_only check(review_kind='public_source_proof_continuity_audit' or
  (source_revision_sha is null and source_ci_run_url is null and proof_commit_sha is null
   and proof_sha256 is null and public_spki_sha256 is null and source_audit_reference is null)),
 constraint ql252_147_stage_denial_only check(review_kind='seven_denial_exception_aging_renewal'
  or (cardinality(denial_receipt_ids)=0 and denial_witness_reference is null)),
 constraint ql252_147_stage_owner_only check(review_kind='independent_owner_test_authorization_hold_review'
  or owner_test_receipt_id is null),
 constraint ql252_147_source_ci_pair check((source_revision_sha is null and source_ci_run_url is null)
  or (source_revision_sha is not null and source_ci_run_url is not null)),
 constraint ql252_147_source_proof_pair check((proof_commit_sha is null and proof_sha256 is null)
  or (source_revision_sha is not null and proof_commit_sha is not null
   and source_revision_sha<>proof_commit_sha and proof_sha256 is not null)),
 primary key(id)
);
create unique index ql252_147_first_review_idx on public.owner_export_ql252_proof_denial_hold_reviews(ql248_source_review_id)
 where prior_review_id is null;
create index ql252_147_pair_review_idx on public.owner_export_ql252_proof_denial_hold_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql252_147_due_idx on public.owner_export_ql252_proof_denial_hold_reviews(next_due_at);

create function icamp_private.ql252_147_proof_denial_hold_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; predecessor record; due_reference timestamptz; expected_repo text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,147252));
 select * into base from public.owner_export_ql248_source_receipt_exception_reassessments
  where id=new.ql248_source_review_id;
 if base.id is null or base.review_kind<>'independent_hold_exception_reassessment'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.source_system<>new.source_system or base.repository<>new.repository
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.phase_b_test_authorized or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'QL-252 must root in same-tenant Build 146 independent HOLD reassessment'; end if;
 expected_repo:=case new.source_system
  when 'ai-data-platform' then 'RosevearCreations/ai-data-platform'
  when 'devilndove' then 'RosevearCreations/devilndove-site'
  when 'rosiedazzlers' then 'RosevearCreations/rosiedazzlers'
  when 'yw' then 'RosevearCreations/yw'
  when 'icamp' then 'RosevearCreations/iCamp'
  else 'RosevearCreations/rosevear-ai-hub' end;
 if new.repository<>expected_repo then raise exception 'QL-252 source repository mismatch'; end if;
 if new.source_ci_run_url is not null and new.source_ci_run_url not like
  'https://github.com/'||expected_repo||'/actions/runs/%' then
  raise exception 'QL-252 source CI URL must match exact source repository'; end if;
 select r.observed_current_gap_count into new.observed_root_gap_count
  from public.owner_export_ql248_source_receipt_exception_reassessments r
  where r.id=base.prior_review_id and r.review_kind='original_source_receipt_escalation_followup';
 if new.observed_root_gap_count is null then
  raise exception 'Build 146 independent HOLD root lacks original denial gap observation'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_review_id is null then
  if new.review_kind<>'public_source_proof_continuity_audit' then
   raise exception 'Begin Build 147 with immutable public source proof recheck'; end if;
  due_reference:=base.next_due_at;
 else
  select * into predecessor from public.owner_export_ql252_proof_denial_hold_reviews
   where id=new.prior_review_id;
  if predecessor.id is null or predecessor.ql248_source_review_id<>new.ql248_source_review_id
   or predecessor.source_campground_id<>new.source_campground_id
   or predecessor.target_campground_id<>new.target_campground_id
   or predecessor.source_system<>new.source_system or predecessor.repository<>new.repository then
   raise exception 'QL-252 previous review must belong to immutable same source and tenant'; end if;
  if not ((predecessor.review_kind='public_source_proof_continuity_audit'
    and new.review_kind='seven_denial_exception_aging_renewal') or
   (predecessor.review_kind='seven_denial_exception_aging_renewal'
    and new.review_kind='independent_owner_test_authorization_hold_review') or
   (predecessor.review_kind='independent_owner_test_authorization_hold_review'
    and new.review_kind='public_source_proof_continuity_audit')) then
   raise exception 'QL-252 proof → seven-denial → independent owner HOLD stages must cycle'; end if;
  if predecessor.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'QL-252 next reviewer must be independent from preceding author'; end if;
  due_reference:=predecessor.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'Build 146 HOLD author cannot self-review QL-252 source/owner evidence'; end if;
 new.observed_gap_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 select count(*) filter(where r.outcome_kind in
  ('original_receipts_missing','source_receipt_mismatch_escalated',
   'hold_reaffirmed_authorization_not_given','hold_exception_escalated'))::int,
  count(*) filter(where r.next_due_at<new.reviewed_at)::int
  into new.observed_open_146_exceptions,new.observed_overdue_146_leaves
  from public.owner_export_ql248_source_receipt_exception_reassessments r
  where r.source_campground_id=new.source_campground_id and r.target_campground_id=new.target_campground_id
   and not exists(select 1 from public.owner_export_ql248_source_receipt_exception_reassessments child
    where child.prior_review_id=r.id);
 if new.review_kind='public_source_proof_continuity_audit' then
  if new.outcome_kind='public_ql246_proof_404_reported' and
   (new.proof_commit_sha is not null or new.proof_sha256 is not null
    or new.public_spki_sha256 is not null or new.source_audit_reference is not null) then
   raise exception 'Public 404 must not invent signed proof B/digest or a signer pin'; end if;
  if new.outcome_kind='public_proof_candidate_unverified' and
   (new.source_revision_sha is null or new.source_ci_run_url is null
    or new.proof_commit_sha is null or new.proof_sha256 is null
    or new.public_spki_sha256 is null or new.source_audit_reference is null) then
   raise exception 'Unverified source proof candidate requires A/CI, distinct B, raw digest and public pin'; end if;
  if new.outcome_kind='source_ci_or_proof_origin_exception' and new.source_audit_reference is null then
   raise exception 'Source/CI provenance exception requires an actual nonsecret evidence index'; end if;
 else
  if new.review_kind='seven_denial_exception_aging_renewal' then
   if cardinality(new.denial_receipt_ids)>7 or exists(
    select 1 from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id)
     where id is null or id !~ '^(nonce_replay_denied|stale_request_denied|cross_business_denied|cross_tenant_denied|revoked_key_denied|write_denied|dispatch_denied)[|]np-[A-Za-z0-9._:-]{5,157}$') or
    (select count(distinct pg_catalog.split_part(id,'|',1)) from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id))<>cardinality(new.denial_receipt_ids) or
    (select count(distinct pg_catalog.split_part(id,'|',2)) from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id))<>cardinality(new.denial_receipt_ids) then
    raise exception 'QL-252 seven denial indexes must be unique and original'; end if;
   if new.outcome_kind='seven_original_denials_missing' and
    (cardinality(new.denial_receipt_ids)>0 or new.denial_witness_reference is not null) then
    raise exception 'Missing original receipts cannot be fabricated'; end if;
   if new.outcome_kind='original_denial_indexes_unverified' and
    (cardinality(new.denial_receipt_ids)<>7 or new.denial_witness_reference is null) then
    raise exception 'Seven originals plus audit index required, still unverified'; end if;
   if new.outcome_kind='original_denial_discrepancy_escalated' and cardinality(new.denial_receipt_ids)=0 then
    raise exception 'Denial exception requires actual original source receipt'; end if;
   new.observed_current_gap_count:=7-cardinality(new.denial_receipt_ids);
  else
   new.observed_current_gap_count:=null;
  end if;
 end if;
 if new.outcome_kind='owner_test_not_given_hold' and new.owner_test_receipt_id is not null then
  raise exception 'Owner test NOT GIVEN cannot have approval receipt'; end if;
 if new.outcome_kind='owner_approval_claim_unverified_hold' and new.owner_test_receipt_id is null then
  raise exception 'Unverified owner claim requires real index and never grants test permission'; end if;
 if new.next_due_at<=new.reviewed_at or new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'QL-252 owner HOLD recheck due within 90 days'; end if;
 -- Claimed source evidence and owner review NEVER unlock Phase B or pilot.
 new.original_proof_signature_verified:=false;
 new.independent_source_ci_verified:=false;
 new.proof_ancestry_verified:=false;
 new.independent_custody_pin_verified:=false;
 new.seven_denials_independently_witnessed:=false;
 new.owner_test_authorized:=false;
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 new.actual_gateway_test:='NOT_RUN';
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql252_147_proof_denial_hold_guard before insert
 on public.owner_export_ql252_proof_denial_hold_reviews for each row
 execute function icamp_private.ql252_147_proof_denial_hold_guard();
create trigger ql252_147_proof_denial_hold_immutable before update or delete
 on public.owner_export_ql252_proof_denial_hold_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql252_proof_denial_hold_reviews enable row level security;
alter table public.owner_export_ql252_proof_denial_hold_reviews force row level security;
revoke all on public.owner_export_ql252_proof_denial_hold_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql252_proof_denial_hold_reviews from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql252_proof_denial_hold_reviews to icamp_app;
create policy ql252_147_proof_denial_hold_select
 on public.owner_export_ql252_proof_denial_hold_reviews for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql252_147_proof_denial_hold_insert
 on public.owner_export_ql252_proof_denial_hold_reviews for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql252_147_proof_denial_hold_guard() from public;
