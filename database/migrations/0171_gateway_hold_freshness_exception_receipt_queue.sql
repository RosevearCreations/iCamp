-- Build 141: owner-only documentary QL-245 follow-up. Not a source connection.
-- No secret material, source GET, real denial or externally witnessed proof is created here.
create table public.owner_export_gateway_hold_receipt_reviews (
 id uuid primary key,
 gateway_review_id uuid not null references public.owner_export_proof_renewal_gate_reviews(id),
 prior_review_id uuid unique references public.owner_export_gateway_hold_receipt_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in
  ('independent_gateway_hold_freshness_review','aged_exception_recurrence_watch',
   'owner_safe_receipt_verification_queue')),
 outcome_kind text not null check(outcome_kind in
  ('hold_evidence_unverified','hold_evidence_stale','hold_evidence_missing',
   'no_new_exception_observed','exception_recurrence_detected','exception_recurrence_escalated',
   'receipt_reference_unverified','receipt_not_provisioned','receipt_missing','receipt_escalated')),
 next_due_at timestamptz not null,
 observed_gateway_review_age_days integer not null default 0 check(observed_gateway_review_age_days>=0),
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_proof_age_days integer not null default 0 check(observed_proof_age_days>=0),
 observed_open_140_exceptions integer not null default 0 check(observed_open_140_exceptions>=0),
 observed_overdue_140_leaves integer not null default 0 check(observed_overdue_140_leaves>=0),
 observed_newer_gateway_reviews integer not null default 0 check(observed_newer_gateway_reviews>=0),
 receipt_kind text check(receipt_kind in
  ('source_ci_revision','nonprod_registry','source_public_signer_pin',
   'source_health','source_capabilities','gateway_audit','source_signed_return',
   'denial_nonce_replay','denial_stale_request','denial_wrong_business',
   'denial_wrong_tenant','denial_revoked_key','denial_prohibited_write',
   'denial_prohibited_dispatch','independent_assessor','independent_witness')),
 receipt_reference text check(receipt_reference is null or
  (receipt_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$' and char_length(receipt_reference)<=160)),
 source_revision text check(source_revision is null or source_revision ~ '^[0-9a-f]{40}$'),
 ci_run_url text check(ci_run_url is null or ci_run_url ~
  '^https://github[.]com/RosevearCreations/iCamp/actions/runs/[0-9]{1,20}$'),
 receipt_proof_state text not null default 'UNVERIFIED' check(receipt_proof_state='UNVERIFIED'),
 connection_state text not null default 'DISCONNECTED' check(connection_state='DISCONNECTED'),
 gate_state text not null default 'HOLD' check(gate_state='HOLD'),
 owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false),
 dispatch_enabled boolean not null default false check(dispatch_enabled=false),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint gateway_hold_receipt_pair check(source_campground_id<>target_campground_id),
 constraint gateway_hold_receipt_outcomes check(
  (review_kind='independent_gateway_hold_freshness_review' and outcome_kind in
    ('hold_evidence_unverified','hold_evidence_stale','hold_evidence_missing'))
  or (review_kind='aged_exception_recurrence_watch' and outcome_kind in
    ('no_new_exception_observed','exception_recurrence_detected','exception_recurrence_escalated'))
  or (review_kind='owner_safe_receipt_verification_queue' and outcome_kind in
    ('receipt_reference_unverified','receipt_not_provisioned','receipt_missing','receipt_escalated'))),
 constraint gateway_hold_receipt_metadata_only check(
  (review_kind='owner_safe_receipt_verification_queue' and receipt_kind is not null)
  or (review_kind<>'owner_safe_receipt_verification_queue' and receipt_kind is null
   and receipt_reference is null and source_revision is null and ci_run_url is null)),
 constraint gateway_hold_receipt_source_revision_only check(
  receipt_kind='source_ci_revision' or (source_revision is null and ci_run_url is null)),
 constraint gateway_hold_receipt_source_revision_pair check(
  (source_revision is null)=(ci_run_url is null)),
 constraint gateway_hold_receipt_reference_truth check(
  (outcome_kind='receipt_reference_unverified' and
   (receipt_reference is not null or (source_revision is not null and ci_run_url is not null)))
  or (outcome_kind in ('receipt_not_provisioned','receipt_missing') and
   receipt_reference is null and source_revision is null and ci_run_url is null)
  or outcome_kind in ('receipt_escalated','hold_evidence_unverified',
   'hold_evidence_stale','hold_evidence_missing','no_new_exception_observed',
   'exception_recurrence_detected','exception_recurrence_escalated'))
);
create unique index gateway_hold_receipt_first_idx on
 public.owner_export_gateway_hold_receipt_reviews(gateway_review_id)
 where prior_review_id is null;
create index gateway_hold_receipt_pair_idx on public.owner_export_gateway_hold_receipt_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index gateway_hold_receipt_root_idx on public.owner_export_gateway_hold_receipt_reviews
 (gateway_review_id,reviewed_at desc,id desc);
create index gateway_hold_receipt_due_idx on public.owner_export_gateway_hold_receipt_reviews(next_due_at);

create function icamp_private.gateway_hold_receipt_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; prior_record record; current_proof timestamptz;
 due_reference timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,141141));
 select * into base from public.owner_export_proof_renewal_gate_reviews
  where id=new.gateway_review_id;
 if base.id is null or base.review_kind<>'cross_system_read_only_gate_review'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.gate_state<>'HOLD' or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'Build 141 requires a same-pair Build 140 read-only HOLD gate receipt'; end if;
 new.reviewed_at:=clock_timestamp();
 if new.prior_review_id is null then
  if new.review_kind<>'independent_gateway_hold_freshness_review' then
   raise exception 'Begin with independent HOLD evidence freshness review'; end if;
  due_reference:=base.next_due_at;
 else
  select * into prior_record from public.owner_export_gateway_hold_receipt_reviews
   where id=new.prior_review_id;
  if prior_record.id is null or prior_record.gateway_review_id<>new.gateway_review_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Build 141 follow-up must preserve the original gate and campground pair'; end if;
  if not ((prior_record.review_kind='independent_gateway_hold_freshness_review'
    and new.review_kind='aged_exception_recurrence_watch')
   or (prior_record.review_kind='aged_exception_recurrence_watch'
    and new.review_kind='owner_safe_receipt_verification_queue')
   or (prior_record.review_kind='owner_safe_receipt_verification_queue'
    and new.review_kind in('owner_safe_receipt_verification_queue',
     'independent_gateway_hold_freshness_review'))) then
   raise exception 'Follow freshness, aging, receipt verification queue and independent renewal order'; end if;
  if prior_record.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'A new independent owner reviewer must differ from the preceding author'; end if;
  due_reference:=prior_record.next_due_at;
 end if;
 if new.reviewed_by_user_id=base.reviewed_by_user_id then
  raise exception 'Independent owner cannot review their own Build 140 gate'; end if;
 new.observed_gateway_review_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-base.reviewed_at))/86400))::int;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 select max(e.recorded_at) into current_proof from public.owner_export_proof_renewal_gate_reviews p
  join public.owner_export_closure_recurrence_events e on e.id=p.verified_renewal_event_id
  where p.owner_reconciliation_id=base.owner_reconciliation_id
   and e.recorded_at<=new.reviewed_at;
 if current_proof is null then
  select e.recorded_at into current_proof from public.owner_export_continuity_evidence_reconciliations c
   join public.owner_export_closure_recurrence_events e on e.id=c.verified_source_event_id
   where c.id=base.owner_reconciliation_id;
 end if;
 new.observed_proof_age_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-coalesce(current_proof,base.reviewed_at)))/86400))::int;
 select count(*) filter(where p.outcome_kind in
  ('renewal_source_drift','renewal_escalated','aged_exception_overdue',
   'aged_exception_escalated','gateway_evidence_missing','gateway_review_escalated'))::int,
  count(*) filter(where p.next_due_at<new.reviewed_at)::int
  into new.observed_open_140_exceptions,new.observed_overdue_140_leaves
  from public.owner_export_proof_renewal_gate_reviews p
  where p.source_campground_id=new.source_campground_id
   and p.target_campground_id=new.target_campground_id
   and not exists(select 1 from public.owner_export_proof_renewal_gate_reviews child
    where child.prior_review_id=p.id);
 select count(*)::int into new.observed_newer_gateway_reviews
  from public.owner_export_proof_renewal_gate_reviews p
  where p.owner_reconciliation_id=base.owner_reconciliation_id
   and p.review_kind='cross_system_read_only_gate_review'
   and p.reviewed_at>base.reviewed_at;
 if new.outcome_kind='no_new_exception_observed' and
  (new.observed_open_140_exceptions>0 or new.observed_overdue_140_leaves>0
   or new.observed_newer_gateway_reviews>0) then
  raise exception 'Cannot claim no new exceptions with open, overdue or newer gateway evidence'; end if;
 if new.outcome_kind='exception_recurrence_detected' and
  new.observed_open_140_exceptions=0 and new.observed_overdue_140_leaves=0
  and new.observed_newer_gateway_reviews=0 then
  raise exception 'Recurrence detection needs an observed unresolved or overdue gateway exception'; end if;
 if new.outcome_kind='hold_evidence_stale' and
  new.observed_proof_age_days<=30 and new.observed_prior_overdue_days=0
  and new.observed_overdue_140_leaves=0 then
  raise exception 'Stale HOLD evidence requires observed proof age or overdue review'; end if;
 if new.next_due_at<=new.reviewed_at or
  new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'Next independent HOLD receipt review must be due within 90 days'; end if;
 -- Documentary queue only. Source and gateway signatures are never verified by this table.
 new.receipt_proof_state:='UNVERIFIED';
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 return new;
end $$;
create trigger gateway_hold_receipt_review_guard before insert
 on public.owner_export_gateway_hold_receipt_reviews for each row
 execute function icamp_private.gateway_hold_receipt_review_guard();
create trigger gateway_hold_receipt_review_immutable before update or delete
 on public.owner_export_gateway_hold_receipt_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_gateway_hold_receipt_reviews enable row level security;
alter table public.owner_export_gateway_hold_receipt_reviews force row level security;
revoke all on public.owner_export_gateway_hold_receipt_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_gateway_hold_receipt_reviews from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_gateway_hold_receipt_reviews to icamp_app;
create policy gateway_hold_receipt_review_select on public.owner_export_gateway_hold_receipt_reviews
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy gateway_hold_receipt_review_insert on public.owner_export_gateway_hold_receipt_reviews
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.gateway_hold_receipt_review_guard() from public;
