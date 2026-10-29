-- Build 146: original source-denial receipt follow-up and independently held
-- exception reassessment. References remain UNVERIFIED; no gateway activation.
create table public.owner_export_ql248_source_receipt_exception_reassessments (
 id uuid not null,
 ql248_renewal_id uuid not null references public.owner_export_ql248_provenance_gap_hold_renewals(id),
 prior_review_id uuid unique references public.owner_export_ql248_source_receipt_exception_reassessments(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 source_system text not null check(source_system in
  ('ai-data-platform','devilndove','rosiedazzlers','yw','icamp','rosevear-ai-hub')),
 repository text not null,
 review_kind text not null check(review_kind in
  ('original_source_receipt_escalation_followup','independent_hold_exception_reassessment')),
 outcome_kind text not null check(outcome_kind in
  ('original_receipts_missing','original_references_unverified','source_receipt_mismatch_escalated',
   'hold_reaffirmed_authorization_not_given','owner_reference_unverified_hold','hold_exception_escalated')),
 denial_receipt_ids text[] not null default '{}',
 source_audit_reference text check(source_audit_reference is null or
  source_audit_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 owner_authorization_reference text check(owner_authorization_reference is null or
  owner_authorization_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 rollback_reference text check(rollback_reference is null or
  rollback_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 revocation_reference text check(revocation_reference is null or
  revocation_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 observed_prior_gap_count integer not null default 7 check(observed_prior_gap_count between 0 and 7),
 observed_current_gap_count integer check(observed_current_gap_count between 0 and 7),
 observed_gap_age_days integer not null default 0 check(observed_gap_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_open_145_exceptions integer not null default 0 check(observed_open_145_exceptions>=0),
 observed_overdue_145_leaves integer not null default 0 check(observed_overdue_145_leaves>=0),
 original_source_receipts_verified boolean not null default false check(original_source_receipts_verified=false),
 seven_denials_independently_witnessed boolean not null default false check(seven_denials_independently_witnessed=false),
 public_proof_origin_verified boolean not null default false check(public_proof_origin_verified=false),
 owner_authorization_verified boolean not null default false check(owner_authorization_verified=false),
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
 constraint ql248_146_distinct_pair check(source_campground_id<>target_campground_id),
 constraint ql248_146_outcome_stage check(
  (review_kind='original_source_receipt_escalation_followup' and outcome_kind in
   ('original_receipts_missing','original_references_unverified','source_receipt_mismatch_escalated')) or
  (review_kind='independent_hold_exception_reassessment' and outcome_kind in
   ('hold_reaffirmed_authorization_not_given','owner_reference_unverified_hold','hold_exception_escalated'))),
 constraint ql248_146_receipt_stage_only check(review_kind='original_source_receipt_escalation_followup'
  or (cardinality(denial_receipt_ids)=0 and source_audit_reference is null)),
 constraint ql248_146_hold_stage_only check(review_kind='independent_hold_exception_reassessment'
  or (owner_authorization_reference is null and rollback_reference is null and revocation_reference is null)),
 primary key(id)
);
create unique index ql248_146_first_review_idx
 on public.owner_export_ql248_source_receipt_exception_reassessments(ql248_renewal_id)
 where prior_review_id is null;
create index ql248_146_pair_review_idx on public.owner_export_ql248_source_receipt_exception_reassessments
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql248_146_due_idx on public.owner_export_ql248_source_receipt_exception_reassessments(next_due_at);

create function icamp_private.ql248_146_source_receipt_hold_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; predecessor record; due_reference timestamptz; expected_repo text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,146146));
 select * into base from public.owner_export_ql248_provenance_gap_hold_renewals
  where id=new.ql248_renewal_id;
 if base.id is null or base.review_kind<>'independent_authorization_hold_renewal'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.source_system<>new.source_system or base.repository<>new.repository
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.phase_b_test_authorized or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'Build 146 must root in same-tenant independent Build 145 HOLD renewal'; end if;
 expected_repo:=case new.source_system
  when 'ai-data-platform' then 'RosevearCreations/ai-data-platform'
  when 'devilndove' then 'RosevearCreations/devilndove-site'
  when 'rosiedazzlers' then 'RosevearCreations/rosiedazzlers'
  when 'yw' then 'RosevearCreations/yw'
  when 'icamp' then 'RosevearCreations/iCamp'
  else 'RosevearCreations/rosevear-ai-hub' end;
 if new.repository<>expected_repo then raise exception 'Build 146 source repository mismatch'; end if;
 select r.observed_denial_gap_count into new.observed_prior_gap_count
  from public.owner_export_ql248_provenance_gap_hold_renewals r
  where r.id=base.prior_review_id and r.review_kind='seven_denial_source_receipt_gap_aging';
 if new.observed_prior_gap_count is null then
  raise exception 'Missing original Build 145 seven-denial gap observation'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_review_id is null then
  if new.review_kind<>'original_source_receipt_escalation_followup' then
   raise exception 'Begin with original source receipt escalation follow-up'; end if;
  due_reference:=base.next_due_at;
 else
  select * into predecessor from public.owner_export_ql248_source_receipt_exception_reassessments
   where id=new.prior_review_id;
  if predecessor.id is null or predecessor.ql248_renewal_id<>new.ql248_renewal_id
   or predecessor.source_campground_id<>new.source_campground_id
   or predecessor.target_campground_id<>new.target_campground_id
   or predecessor.source_system<>new.source_system or predecessor.repository<>new.repository then
   raise exception 'Build 146 requires immutable same-root source/campground continuity'; end if;
  if not ((predecessor.review_kind='original_source_receipt_escalation_followup'
    and new.review_kind='independent_hold_exception_reassessment') or
   (predecessor.review_kind='independent_hold_exception_reassessment'
    and new.review_kind='original_source_receipt_escalation_followup')) then
   raise exception 'Original source receipt and HOLD reassessment stages must alternate'; end if;
  if predecessor.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'Build 146 independent reviewer must differ from preceding author'; end if;
  due_reference:=predecessor.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'Build 145 HOLD author cannot self-review original receipts or HOLD'; end if;
 new.observed_gap_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 select count(*) filter(where r.outcome_kind in
  ('public_proof_missing','provenance_mismatch_escalated','seven_denials_missing',
   'denial_gap_escalated','authorization_not_given_hold_renewed','authorization_exception_escalated'))::int,
  count(*) filter(where r.next_due_at<new.reviewed_at)::int
  into new.observed_open_145_exceptions,new.observed_overdue_145_leaves
  from public.owner_export_ql248_provenance_gap_hold_renewals r
  where r.source_campground_id=new.source_campground_id
   and r.target_campground_id=new.target_campground_id
   and not exists(select 1 from public.owner_export_ql248_provenance_gap_hold_renewals child
    where child.prior_review_id=r.id);
 if new.review_kind='original_source_receipt_escalation_followup' then
  if cardinality(new.denial_receipt_ids)>7 or exists(
   select 1 from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id)
    where id is null or id !~ '^(nonce_replay_denied|stale_request_denied|cross_business_denied|cross_tenant_denied|revoked_key_denied|write_denied|dispatch_denied)[|]np-[A-Za-z0-9._:-]{5,157}$') or
   (select count(distinct pg_catalog.split_part(id,'|',1))
    from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id))<>cardinality(new.denial_receipt_ids) or
   (select count(distinct pg_catalog.split_part(id,'|',2))
    from pg_catalog.unnest(new.denial_receipt_ids) as receipt(id))<>cardinality(new.denial_receipt_ids) then
   raise exception 'Build 146 requires distinct, genuine, nonsecret original denial IDs'; end if;
  if new.outcome_kind='original_receipts_missing' and cardinality(new.denial_receipt_ids)>0 then
   raise exception 'Missing receipts must not manufacture original source IDs'; end if;
  if new.outcome_kind='original_references_unverified' and
   (cardinality(new.denial_receipt_ids)<>7 or new.source_audit_reference is null) then
   raise exception 'All seven original IDs plus independent audit index required'; end if;
  if new.outcome_kind='source_receipt_mismatch_escalated' and cardinality(new.denial_receipt_ids)=0 then
   raise exception 'Source mismatch escalation needs a genuine original receipt'; end if;
  new.observed_current_gap_count:=7-cardinality(new.denial_receipt_ids);
 else
  new.observed_current_gap_count:=null;
 end if;
 if new.outcome_kind='hold_reaffirmed_authorization_not_given'
  and new.owner_authorization_reference is not null then
  raise exception 'No owner authorization cannot claim an approval reference'; end if;
 if new.outcome_kind='owner_reference_unverified_hold'
  and new.owner_authorization_reference is null then
  raise exception 'Unverified owner authorization must reference actual nonsecret evidence'; end if;
 if new.next_due_at<=new.reviewed_at or new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Independent HOLD recheck must be due within 90 days'; end if;
 -- Indexed source IDs and apparent authorizations can never open the gateway.
 new.original_source_receipts_verified:=false;
 new.seven_denials_independently_witnessed:=false;
 new.public_proof_origin_verified:=false;
 new.owner_authorization_verified:=false;
 new.phase_b_test_authorized:=false;
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql248_146_source_receipt_hold_guard before insert
 on public.owner_export_ql248_source_receipt_exception_reassessments for each row
 execute function icamp_private.ql248_146_source_receipt_hold_guard();
create trigger ql248_146_source_receipt_hold_immutable before update or delete
 on public.owner_export_ql248_source_receipt_exception_reassessments for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql248_source_receipt_exception_reassessments enable row level security;
alter table public.owner_export_ql248_source_receipt_exception_reassessments force row level security;
revoke all on public.owner_export_ql248_source_receipt_exception_reassessments from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql248_source_receipt_exception_reassessments from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql248_source_receipt_exception_reassessments to icamp_app;
create policy ql248_146_source_receipt_hold_select
 on public.owner_export_ql248_source_receipt_exception_reassessments for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql248_146_source_receipt_hold_insert
 on public.owner_export_ql248_source_receipt_exception_reassessments for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql248_146_source_receipt_hold_guard() from public;
