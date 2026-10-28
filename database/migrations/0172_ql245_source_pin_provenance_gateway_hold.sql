-- Build 142: QL-245/246 documentary source comparison, public pin provenance
-- and gateway HOLD escalation. Never authenticates external source claims.
create table public.owner_export_ql245_source_pin_hold_reviews (
 id uuid primary key,
 receipt_review_id uuid not null references public.owner_export_gateway_hold_receipt_reviews(id),
 prior_review_id uuid unique references public.owner_export_ql245_source_pin_hold_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in
  ('independent_source_receipt_comparison','trusted_pin_provenance_followup',
   'gateway_hold_recurrence_escalation')),
 outcome_kind text not null check(outcome_kind in
  ('source_metadata_unverified','source_metadata_syntax_aligned','source_metadata_mismatch',
   'pin_not_provisioned','pin_reference_unverified','pin_mismatch_escalated',
   'hold_renewal_documented','hold_recurrence_escalated','owner_evidence_requested')),
 next_due_at timestamptz not null,
 observed_base_receipt_age_days integer not null default 0 check(observed_base_receipt_age_days>=0),
 observed_proof_age_days integer not null default 0 check(observed_proof_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_open_141_exceptions integer not null default 0 check(observed_open_141_exceptions>=0),
 observed_overdue_141_leaves integer not null default 0 check(observed_overdue_141_leaves>=0),
 observed_newer_same_kind_receipts integer not null default 0 check(observed_newer_same_kind_receipts>=0),
 comparison_source_revision text check(comparison_source_revision is null
  or comparison_source_revision ~ '^[0-9a-f]{40}$'),
 comparison_ci_run_url text check(comparison_ci_run_url is null or comparison_ci_run_url ~
  '^https://github[.]com/RosevearCreations/iCamp/actions/runs/[0-9]{1,20}$'),
 public_source_pin_sha256 text check(public_source_pin_sha256 is null
  or public_source_pin_sha256 ~ '^[0-9a-f]{64}$'),
 separately_sourced_pin_sha256 text check(separately_sourced_pin_sha256 is null
  or separately_sourced_pin_sha256 ~ '^[0-9a-f]{64}$'),
 pin_provenance_ref text check(pin_provenance_ref is null
  or pin_provenance_ref ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 observed_source_metadata_match boolean not null default false,
 observed_public_pin_fingerprint_match boolean not null default false,
 source_signature_verified boolean not null default false check(source_signature_verified=false),
 independently_trusted_pin_verified boolean not null default false check(independently_trusted_pin_verified=false),
 original_gateway_get_verified boolean not null default false check(original_gateway_get_verified=false),
 owner_identity_verified boolean not null default false check(owner_identity_verified=false),
 owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false),
 dispatch_enabled boolean not null default false check(dispatch_enabled=false),
 connection_state text not null default 'DISCONNECTED' check(connection_state='DISCONNECTED'),
 gate_state text not null default 'HOLD' check(gate_state='HOLD'),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint ql245_source_pin_pair check(source_campground_id<>target_campground_id),
 constraint ql245_source_pin_outcomes check(
  (review_kind='independent_source_receipt_comparison' and outcome_kind in
   ('source_metadata_unverified','source_metadata_syntax_aligned','source_metadata_mismatch'))
  or (review_kind='trusted_pin_provenance_followup' and outcome_kind in
   ('pin_not_provisioned','pin_reference_unverified','pin_mismatch_escalated'))
  or (review_kind='gateway_hold_recurrence_escalation' and outcome_kind in
   ('hold_renewal_documented','hold_recurrence_escalated','owner_evidence_requested'))),
 constraint ql245_source_pin_metadata_only check(
  (review_kind='independent_source_receipt_comparison' or
    (comparison_source_revision is null and comparison_ci_run_url is null))
  and (review_kind='trusted_pin_provenance_followup' or
    (public_source_pin_sha256 is null and separately_sourced_pin_sha256 is null
     and pin_provenance_ref is null))),
 constraint ql245_source_pin_ci_pair check(
  (comparison_source_revision is null)=(comparison_ci_run_url is null)),
 constraint ql245_source_pin_pin_pair check(
  (public_source_pin_sha256 is null)=(separately_sourced_pin_sha256 is null))
);
create unique index ql245_source_pin_first_idx on
 public.owner_export_ql245_source_pin_hold_reviews(receipt_review_id)
 where prior_review_id is null;
create index ql245_source_pin_pair_idx on public.owner_export_ql245_source_pin_hold_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql245_source_pin_root_idx on public.owner_export_ql245_source_pin_hold_reviews
 (receipt_review_id,reviewed_at desc,id desc);
create index ql245_source_pin_due_idx on public.owner_export_ql245_source_pin_hold_reviews(next_due_at);

create function icamp_private.ql245_source_pin_hold_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; prior_record record; due_reference timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,142142));
 select * into base from public.owner_export_gateway_hold_receipt_reviews
  where id=new.receipt_review_id;
 if base.id is null or base.review_kind<>'owner_safe_receipt_verification_queue'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'Build 142 requires same-pair Build 141 owner-safe receipt queue HOLD root'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_review_id is null then
  if new.review_kind<>'independent_source_receipt_comparison' then
   raise exception 'Begin with independent QL-245 source receipt comparison'; end if;
  due_reference:=base.next_due_at;
 else
  select * into prior_record from public.owner_export_ql245_source_pin_hold_reviews
   where id=new.prior_review_id;
  if prior_record.id is null or prior_record.receipt_review_id<>new.receipt_review_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Build 142 must retain original independent same-pair receipt source'; end if;
  if not ((prior_record.review_kind='independent_source_receipt_comparison'
    and new.review_kind='trusted_pin_provenance_followup')
   or (prior_record.review_kind='trusted_pin_provenance_followup'
    and new.review_kind='gateway_hold_recurrence_escalation')
   or (prior_record.review_kind='gateway_hold_recurrence_escalation'
    and new.review_kind='independent_source_receipt_comparison')) then
   raise exception 'Source comparison, independently sourced pin, HOLD escalation must stay ordered'; end if;
  if prior_record.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'Independent reviewer must differ from preceding author'; end if;
  due_reference:=prior_record.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'Independent reviewer cannot attest to their own Build 141 receipt'; end if;
 new.observed_base_receipt_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 new.observed_proof_age_days:=base.observed_proof_age_days+new.observed_base_receipt_age_days;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 select count(*) filter(where r.outcome_kind in
  ('hold_evidence_stale','hold_evidence_missing','exception_recurrence_detected',
   'exception_recurrence_escalated','receipt_not_provisioned','receipt_missing','receipt_escalated'))::int,
  count(*) filter(where r.next_due_at<new.reviewed_at)::int
  into new.observed_open_141_exceptions,new.observed_overdue_141_leaves
  from public.owner_export_gateway_hold_receipt_reviews r
  where r.source_campground_id=new.source_campground_id
   and r.target_campground_id=new.target_campground_id
   and not exists(select 1 from public.owner_export_gateway_hold_receipt_reviews child
    where child.prior_review_id=r.id);
 select count(*)::int into new.observed_newer_same_kind_receipts
  from public.owner_export_gateway_hold_receipt_reviews r
  where r.gateway_review_id=base.gateway_review_id and r.receipt_kind=base.receipt_kind
   and r.reviewed_at>base.reviewed_at;
 if new.review_kind='independent_source_receipt_comparison' then
  new.observed_source_metadata_match:=base.receipt_kind='source_ci_revision'
   and base.source_revision is not null and base.ci_run_url is not null
   and new.comparison_source_revision=base.source_revision
   and new.comparison_ci_run_url=base.ci_run_url;
  if new.outcome_kind='source_metadata_syntax_aligned'
   and not coalesce(new.observed_source_metadata_match,false) then
   raise exception 'Metadata syntax match requires the same Build 141 SHA and CI URL; not external verification'; end if;
  if new.outcome_kind='source_metadata_mismatch' and
   (base.source_revision is null or new.comparison_source_revision is null
    or new.comparison_source_revision=base.source_revision) then
   raise exception 'Source mismatch requires two different observed 40-hex source revisions'; end if;
 end if;
 if new.review_kind='trusted_pin_provenance_followup' then
  new.observed_public_pin_fingerprint_match:=new.public_source_pin_sha256 is not null
   and new.separately_sourced_pin_sha256 is not null
   and new.public_source_pin_sha256=new.separately_sourced_pin_sha256;
  if new.outcome_kind='pin_not_provisioned' and
   (new.public_source_pin_sha256 is not null or new.pin_provenance_ref is not null) then
   raise exception 'Unprovisioned pin cannot claim a fingerprint or trust-channel reference'; end if;
  if new.outcome_kind='pin_reference_unverified' and
   (not coalesce(new.observed_public_pin_fingerprint_match,false)
    or new.pin_provenance_ref is null) then
   raise exception 'Documentary pin comparison requires two matching public pins and source reference'; end if;
  if new.outcome_kind='pin_mismatch_escalated' and
   (new.public_source_pin_sha256 is null
    or new.public_source_pin_sha256=new.separately_sourced_pin_sha256) then
   raise exception 'Pin mismatch escalation requires distinct observed public fingerprints'; end if;
 end if;
 if new.outcome_kind='hold_recurrence_escalated' and
  new.observed_open_141_exceptions=0 and new.observed_overdue_141_leaves=0
  and new.observed_newer_same_kind_receipts=0 then
  raise exception 'Recurrence escalation requires observed open, overdue or new source records'; end if;
 if new.next_due_at<=new.reviewed_at or
  new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Next independent source/pin/HOLD review must be due within 90 days'; end if;
 -- Documentary equality checks never authenticate an Ed25519 signature or trust channel.
 new.source_signature_verified:=false;
 new.independently_trusted_pin_verified:=false;
 new.original_gateway_get_verified:=false;
 new.owner_identity_verified:=false;
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql245_source_pin_hold_guard before insert
 on public.owner_export_ql245_source_pin_hold_reviews for each row
 execute function icamp_private.ql245_source_pin_hold_guard();
create trigger ql245_source_pin_hold_immutable before update or delete
 on public.owner_export_ql245_source_pin_hold_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql245_source_pin_hold_reviews enable row level security;
alter table public.owner_export_ql245_source_pin_hold_reviews force row level security;
revoke all on public.owner_export_ql245_source_pin_hold_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql245_source_pin_hold_reviews from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql245_source_pin_hold_reviews to icamp_app;
create policy ql245_source_pin_hold_select on public.owner_export_ql245_source_pin_hold_reviews
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql245_source_pin_hold_insert on public.owner_export_ql245_source_pin_hold_reviews
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql245_source_pin_hold_guard() from public;
