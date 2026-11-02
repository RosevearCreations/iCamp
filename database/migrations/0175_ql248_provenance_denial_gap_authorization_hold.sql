-- Build 145: source-of-truth QL-248 provenance and denial-gap aging audit.
-- This is documentary evidence intake, not a Phase B/Phase C gateway switch.
create table public.owner_export_ql248_provenance_gap_hold_renewals (
 id uuid primary key,
 ql247_watch_id uuid not null references public.owner_export_ql247_test_receipt_hold_watches(id),
 prior_review_id uuid unique references public.owner_export_ql248_provenance_gap_hold_renewals(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 source_system text not null check(source_system in
  ('ai-data-platform','devilndove','rosiedazzlers','yw','icamp','rosevear-ai-hub')),
 repository text not null,
 review_kind text not null check(review_kind in
  ('two_sha_public_proof_provenance_recheck','seven_denial_source_receipt_gap_aging',
   'independent_authorization_hold_renewal')),
 outcome_kind text not null check(outcome_kind in
  ('public_proof_missing','two_sha_reference_unverified','provenance_mismatch_escalated',
   'seven_denials_missing','denial_source_references_unverified','denial_gap_escalated',
   'authorization_not_given_hold_renewed','authorization_reference_unverified_hold',
   'authorization_exception_escalated')),
 proof_public_reference text check(proof_public_reference is null or
  proof_public_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 source_revision_sha text check(source_revision_sha is null or source_revision_sha ~ '^[a-f0-9]{40}$'),
 proof_commit_sha text check(proof_commit_sha is null or proof_commit_sha ~ '^[a-f0-9]{40}$'),
 proof_sha256 text check(proof_sha256 is null or proof_sha256 ~ '^[a-f0-9]{64}$'),
 source_ci_run_url text check(source_ci_run_url is null or source_ci_run_url ~
  '^https://github[.]com/RosevearCreations/[A-Za-z0-9-]+/actions/runs/[0-9]{1,20}$'),
 signer_pin_sha256 text check(signer_pin_sha256 is null or signer_pin_sha256 ~ '^[a-f0-9]{64}$'),
 signer_pin_reference text check(signer_pin_reference is null or
  signer_pin_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 consumer_agreement_reference text check(consumer_agreement_reference is null or
  consumer_agreement_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 denial_receipt_ids text[] not null default '{}',
 denial_witness_reference text check(denial_witness_reference is null or
  denial_witness_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 owner_test_authorization_reference text check(owner_test_authorization_reference is null or
  owner_test_authorization_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 rollback_reference text check(rollback_reference is null or
  rollback_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 revocation_reference text check(revocation_reference is null or
  revocation_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 observed_denial_gap_count integer check(observed_denial_gap_count between 0 and 7),
 observed_gap_age_days integer not null default 0 check(observed_gap_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_open_144_exceptions integer not null default 0 check(observed_open_144_exceptions>=0),
 observed_overdue_144_leaves integer not null default 0 check(observed_overdue_144_leaves>=0),
 public_source_origin_verified boolean not null default false check(public_source_origin_verified=false),
 independent_signer_pin_verified boolean not null default false check(independent_signer_pin_verified=false),
 seven_denials_independently_witnessed boolean not null default false check(seven_denials_independently_witnessed=false),
 original_gateway_receipts_verified boolean not null default false check(original_gateway_receipts_verified=false),
 phase_b_test_authorized boolean not null default false check(phase_b_test_authorized=false),
 owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false),
 dispatch_enabled boolean not null default false check(dispatch_enabled=false),
 connection_state text not null default 'DISCONNECTED' check(connection_state='DISCONNECTED'),
 gate_state text not null default 'HOLD' check(gate_state='HOLD'),
 next_due_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint ql248_distinct_campgrounds check(source_campground_id<>target_campground_id),
 constraint ql248_outcome_stage check(
  (review_kind='two_sha_public_proof_provenance_recheck' and outcome_kind in
   ('public_proof_missing','two_sha_reference_unverified','provenance_mismatch_escalated')) or
  (review_kind='seven_denial_source_receipt_gap_aging' and outcome_kind in
   ('seven_denials_missing','denial_source_references_unverified','denial_gap_escalated')) or
  (review_kind='independent_authorization_hold_renewal' and outcome_kind in
   ('authorization_not_given_hold_renewed','authorization_reference_unverified_hold',
    'authorization_exception_escalated'))),
 constraint ql248_proof_stage_only check(review_kind='two_sha_public_proof_provenance_recheck' or
  (proof_public_reference is null and source_revision_sha is null and proof_commit_sha is null
   and proof_sha256 is null and source_ci_run_url is null and signer_pin_sha256 is null
   and signer_pin_reference is null and consumer_agreement_reference is null)),
 constraint ql248_denial_stage_only check(review_kind='seven_denial_source_receipt_gap_aging' or
  (cardinality(denial_receipt_ids)=0 and denial_witness_reference is null)),
 constraint ql248_renewal_stage_only check(review_kind='independent_authorization_hold_renewal' or
  (owner_test_authorization_reference is null and rollback_reference is null
   and revocation_reference is null)),
 constraint ql248_transport_pair check(
  (source_revision_sha is null and proof_commit_sha is null and proof_sha256 is null
   and source_ci_run_url is null and proof_public_reference is null) or
  (source_revision_sha is not null and proof_commit_sha is not null and
   source_revision_sha<>proof_commit_sha and proof_sha256 is not null and
   source_ci_run_url is not null and proof_public_reference is not null)),
 constraint ql248_signer_pair check(
  (signer_pin_sha256 is null and signer_pin_reference is null) or
  (signer_pin_sha256 is not null and signer_pin_reference is not null))
);
create unique index ql248_first_review_idx
 on public.owner_export_ql248_provenance_gap_hold_renewals(ql247_watch_id)
 where prior_review_id is null;
create index ql248_pair_review_idx
 on public.owner_export_ql248_provenance_gap_hold_renewals
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql248_due_idx
 on public.owner_export_ql248_provenance_gap_hold_renewals(next_due_at);

create function icamp_private.ql248_provenance_gap_hold_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; predecessor record; due_reference timestamptz; expected_repo text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,145145));
 select * into base from public.owner_export_ql247_test_receipt_hold_watches
  where id=new.ql247_watch_id;
 if base.id is null or base.review_kind<>'reversible_hold_decision_watch'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.source_system<>new.source_system or base.repository<>new.repository
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.phase_b_test_authorized or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'QL-248 must root in the same-tenant Build 144 independent HOLD watch'; end if;
 expected_repo:=case new.source_system
  when 'ai-data-platform' then 'RosevearCreations/ai-data-platform'
  when 'devilndove' then 'RosevearCreations/devilndove-site'
  when 'rosiedazzlers' then 'RosevearCreations/rosiedazzlers'
  when 'yw' then 'RosevearCreations/yw'
  when 'icamp' then 'RosevearCreations/iCamp'
  else 'RosevearCreations/rosevear-ai-hub' end;
 if new.repository<>expected_repo then raise exception 'QL-248 source repository mismatch'; end if;
 if new.source_ci_run_url is not null and new.source_ci_run_url not like
  'https://github.com/'||expected_repo||'/actions/runs/%' then
  raise exception 'QL-248 original CI must belong to the earlier source repository'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_review_id is null then
  if new.review_kind<>'two_sha_public_proof_provenance_recheck' then
   raise exception 'Begin with an independent two-SHA provenance recheck'; end if;
  due_reference:=base.next_due_at;
 else
  select * into predecessor from public.owner_export_ql248_provenance_gap_hold_renewals
   where id=new.prior_review_id;
  if predecessor.id is null or predecessor.ql247_watch_id<>new.ql247_watch_id
   or predecessor.source_campground_id<>new.source_campground_id
   or predecessor.target_campground_id<>new.target_campground_id
   or predecessor.source_system<>new.source_system or predecessor.repository<>new.repository then
   raise exception 'Build 145 requires immutable same-root tenant and source continuity'; end if;
  if not ((predecessor.review_kind='two_sha_public_proof_provenance_recheck'
     and new.review_kind='seven_denial_source_receipt_gap_aging') or
   (predecessor.review_kind='seven_denial_source_receipt_gap_aging'
     and new.review_kind='independent_authorization_hold_renewal') or
   (predecessor.review_kind='independent_authorization_hold_renewal'
     and new.review_kind='two_sha_public_proof_provenance_recheck')) then
   raise exception 'Build 145 provenance, receipt gap, HOLD renewal must be sequenced'; end if;
  if predecessor.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'Independent reviewer cannot self-verify the preceding stage'; end if;
  due_reference:=predecessor.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'Build 144 HOLD author cannot independently approve Build 145'; end if;
 new.observed_gap_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 select count(*) filter(where r.outcome_kind in
  ('authorization_not_given','authorization_exception_escalated','seven_denials_missing',
   'denial_mismatch_escalated','hold_exception_escalated','hold_rollback_watch_due'))::int,
  count(*) filter(where r.next_due_at<new.reviewed_at)::int
  into new.observed_open_144_exceptions,new.observed_overdue_144_leaves
  from public.owner_export_ql247_test_receipt_hold_watches r
  where r.source_campground_id=new.source_campground_id
   and r.target_campground_id=new.target_campground_id
   and not exists(select 1 from public.owner_export_ql247_test_receipt_hold_watches child
    where child.prior_review_id=r.id);
 if new.review_kind='two_sha_public_proof_provenance_recheck' then
  if new.outcome_kind='public_proof_missing' and new.source_revision_sha is not null then
   raise exception 'Missing public proof cannot invent a source or proof SHA'; end if;
  if new.outcome_kind='two_sha_reference_unverified' and new.source_revision_sha is null then
   raise exception 'Unverified two-SHA evidence must include real public references'; end if;
 end if;
 if new.review_kind='seven_denial_source_receipt_gap_aging' then
  if cardinality(new.denial_receipt_ids)>7 or exists(
   select 1 from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id)
    where id is null or id !~ '^(nonce_replay_denied|stale_request_denied|cross_business_denied|cross_tenant_denied|revoked_key_denied|write_denied|dispatch_denied)[|]np-[A-Za-z0-9._:-]{5,157}$') or
   (select count(distinct pg_catalog.split_part(id,'|',1))
    from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id))
    <>cardinality(new.denial_receipt_ids) or
   (select count(distinct pg_catalog.split_part(id,'|',2))
    from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id))
    <>cardinality(new.denial_receipt_ids) then
   raise exception 'Seven original denial IDs must be distinct and nonsecret'; end if;
  if new.outcome_kind='seven_denials_missing' and cardinality(new.denial_receipt_ids)>0 then
   raise exception 'Missing receipts cannot assert real denial IDs'; end if;
  if new.outcome_kind='denial_source_references_unverified' and
   (cardinality(new.denial_receipt_ids)<>7 or new.denial_witness_reference is null) then
   raise exception 'All seven references and independent witness index required'; end if;
  if new.outcome_kind='denial_gap_escalated' and cardinality(new.denial_receipt_ids)=0 then
   raise exception 'Receipt mismatch escalation needs at least one original ID'; end if;
  new.observed_denial_gap_count:=7-cardinality(new.denial_receipt_ids);
 else
  new.observed_denial_gap_count:=null;
 end if;
 if new.outcome_kind='authorization_not_given_hold_renewed'
  and new.owner_test_authorization_reference is not null then
  raise exception 'Owner approval NOT GIVEN cannot assert an authorization reference'; end if;
 if new.outcome_kind='authorization_reference_unverified_hold'
  and new.owner_test_authorization_reference is null then
  raise exception 'Unverified authorization requires a real evidence reference'; end if;
 if new.next_due_at<=new.reviewed_at or new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Independent QL-248 follow-up must be due within 90 days'; end if;
 -- Even a full set of public receipt IDs does not prove source-of-truth origin.
 new.public_source_origin_verified:=false;
 new.independent_signer_pin_verified:=false;
 new.seven_denials_independently_witnessed:=false;
 new.original_gateway_receipts_verified:=false;
 new.phase_b_test_authorized:=false;
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql248_provenance_gap_hold_guard before insert
 on public.owner_export_ql248_provenance_gap_hold_renewals for each row
 execute function icamp_private.ql248_provenance_gap_hold_guard();
create trigger ql248_provenance_gap_hold_immutable before update or delete
 on public.owner_export_ql248_provenance_gap_hold_renewals for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql248_provenance_gap_hold_renewals enable row level security;
alter table public.owner_export_ql248_provenance_gap_hold_renewals force row level security;
revoke all on public.owner_export_ql248_provenance_gap_hold_renewals from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql248_provenance_gap_hold_renewals from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql248_provenance_gap_hold_renewals to icamp_app;
create policy ql248_provenance_gap_hold_select
 on public.owner_export_ql248_provenance_gap_hold_renewals for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql248_provenance_gap_hold_insert
 on public.owner_export_ql248_provenance_gap_hold_renewals for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql248_provenance_gap_hold_guard() from public;
