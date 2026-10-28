-- Build 143: documentary QL-246 source exceptions, separately pinned public
-- signing-key challenge references, and six-system HOLD decisions.
-- Never authorizes Phase B nonproduction tests or a Phase C owner pilot.
create table public.owner_export_ql246_exception_pin_hold_decisions (
 id uuid primary key,
 source_pin_review_id uuid not null references public.owner_export_ql245_source_pin_hold_reviews(id),
 prior_review_id uuid unique references public.owner_export_ql246_exception_pin_hold_decisions(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check (review_kind in
  ('independent_source_proof_exception_intake','out_of_band_pin_challenge_reconciliation',
   'multi_application_hold_gate_decision')),
 outcome_kind text not null check (outcome_kind in
  ('proof_missing','proof_blocked','proof_unverified','proof_exception_escalated',
   'pin_not_provisioned','pin_independence_unverified','pin_mismatch_escalated',
   'six_app_hold_reaffirmed','six_app_exception_escalated','owner_test_authorization_absent')),
 source_system text not null check (source_system in
  ('ai-data-platform','devilndove','rosiedazzlers','yw','icamp','rosevear-ai-hub')),
 repository text not null check (repository in
  ('RosevearCreations/ai-data-platform','RosevearCreations/devilndove-site',
   'RosevearCreations/rosiedazzlers','RosevearCreations/yw',
   'RosevearCreations/iCamp','RosevearCreations/rosevear-ai-hub')),
 source_revision text check (source_revision is null or source_revision ~ '^[a-f0-9]{40}$'),
 ci_run_url text check (ci_run_url is null or ci_run_url ~
  '^https://github[.]com/RosevearCreations/[A-Za-z0-9-]+/actions/runs/[0-9]{1,20}$'),
 proof_raw_json_sha256 text check (proof_raw_json_sha256 is null or proof_raw_json_sha256 ~ '^[a-f0-9]{64}$'),
 source_proof_status text not null default 'MISSING' check (source_proof_status in
  ('MISSING','BLOCKED','PRESENT_UNVERIFIED')),
 public_signer_spki_sha256 text check (public_signer_spki_sha256 is null or public_signer_spki_sha256 ~ '^[a-f0-9]{64}$'),
 out_of_band_spki_sha256 text check (out_of_band_spki_sha256 is null or out_of_band_spki_sha256 ~ '^[a-f0-9]{64}$'),
 out_of_band_reference text check (out_of_band_reference is null or out_of_band_reference ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 operator_challenge_id text check (operator_challenge_id is null or operator_challenge_id ~ '^np-[A-Za-z0-9._:-]{5,157}$'),
 operator_challenge_sha256 text check (operator_challenge_sha256 is null or operator_challenge_sha256 ~ '^[a-f0-9]{64}$'),
 observed_public_pin_string_match boolean not null default false,
 observed_prior_overdue_days integer not null default 0 check(observed_prior_overdue_days>=0),
 observed_open_142_exceptions integer not null default 0 check(observed_open_142_exceptions>=0),
 observed_overdue_142_leaves integer not null default 0 check(observed_overdue_142_leaves>=0),
 observed_six_app_source_kinds integer not null default 0 check(observed_six_app_source_kinds between 0 and 6),
 observed_six_app_proofs_independently_verified integer not null default 0 check(observed_six_app_proofs_independently_verified=0),
 source_proof_signature_verified boolean not null default false check(source_proof_signature_verified=false),
 independent_pin_channel_verified boolean not null default false check(independent_pin_channel_verified=false),
 seven_denials_witnessed boolean not null default false check(seven_denials_witnessed=false),
 nonproduction_gateway_get_verified boolean not null default false check(nonproduction_gateway_get_verified=false),
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
 constraint ql246_exception_pin_pair check(source_campground_id<>target_campground_id),
 constraint ql246_exception_pin_outcome check(
  (review_kind='independent_source_proof_exception_intake' and outcome_kind in
   ('proof_missing','proof_blocked','proof_unverified','proof_exception_escalated')) or
  (review_kind='out_of_band_pin_challenge_reconciliation' and outcome_kind in
   ('pin_not_provisioned','pin_independence_unverified','pin_mismatch_escalated')) or
  (review_kind='multi_application_hold_gate_decision' and outcome_kind in
   ('six_app_hold_reaffirmed','six_app_exception_escalated','owner_test_authorization_absent'))),
 constraint ql246_exception_pin_stage_fields check(
  (review_kind='independent_source_proof_exception_intake' or
   (source_revision is null and ci_run_url is null and proof_raw_json_sha256 is null)) and
  (review_kind='out_of_band_pin_challenge_reconciliation' or
   (public_signer_spki_sha256 is null and out_of_band_spki_sha256 is null
    and out_of_band_reference is null and operator_challenge_id is null
    and operator_challenge_sha256 is null))),
 constraint ql246_exception_source_sha_pair check((source_revision is null)=(ci_run_url is null)),
 constraint ql246_exception_pin_sha_pair check((public_signer_spki_sha256 is null)=(out_of_band_spki_sha256 is null)),
 constraint ql246_exception_challenge_pair check((operator_challenge_id is null)=(operator_challenge_sha256 is null))
);
create unique index ql246_exception_first_idx on public.owner_export_ql246_exception_pin_hold_decisions(source_pin_review_id,source_system)
 where prior_review_id is null;
create index ql246_exception_pair_idx on public.owner_export_ql246_exception_pin_hold_decisions
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index ql246_exception_root_idx on public.owner_export_ql246_exception_pin_hold_decisions
 (source_pin_review_id,reviewed_at desc,id desc);
create index ql246_exception_due_idx on public.owner_export_ql246_exception_pin_hold_decisions(next_due_at);

create function icamp_private.ql246_exception_pin_hold_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare base record; prior_record record; due_reference timestamptz; expected_repo text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,143143));
 select * into base from public.owner_export_ql245_source_pin_hold_reviews
  where id=new.source_pin_review_id;
 if base.id is null or base.review_kind<>'gateway_hold_recurrence_escalation'
  or base.source_campground_id<>new.source_campground_id
  or base.target_campground_id<>new.target_campground_id
  or base.connection_state<>'DISCONNECTED' or base.gate_state<>'HOLD'
  or base.owner_pilot_authorized or base.dispatch_enabled then
  raise exception 'Build 143 must root in a same-pair independent Build 142 HOLD escalation'; end if;
 new.reviewed_at:=clock_timestamp();
 expected_repo:=case new.source_system
  when 'ai-data-platform' then 'RosevearCreations/ai-data-platform'
  when 'devilndove' then 'RosevearCreations/devilndove-site'
  when 'rosiedazzlers' then 'RosevearCreations/rosiedazzlers'
  when 'yw' then 'RosevearCreations/yw'
  when 'icamp' then 'RosevearCreations/iCamp'
  else 'RosevearCreations/rosevear-ai-hub' end;
 if new.repository<>expected_repo then raise exception 'QL-247 source system/repository mismatch'; end if;
 if new.ci_run_url is not null and new.ci_run_url not like
  'https://github.com/'||expected_repo||'/actions/runs/%' then
  raise exception 'QL-247 CI run URL must belong to its exact source repository'; end if;
 if new.prior_review_id is null then
  if new.review_kind<>'independent_source_proof_exception_intake' then
   raise exception 'Begin with independent QL-246 source-proof exception intake'; end if;
  due_reference:=base.next_due_at;
 else
  select * into prior_record from public.owner_export_ql246_exception_pin_hold_decisions
   where id=new.prior_review_id;
  if prior_record.id is null or prior_record.source_pin_review_id<>new.source_pin_review_id
   or prior_record.source_system<>new.source_system or prior_record.repository<>new.repository
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id then
   raise exception 'Retain immutable same-root, same-system source identity'; end if;
  if not ((prior_record.review_kind='independent_source_proof_exception_intake'
    and new.review_kind='out_of_band_pin_challenge_reconciliation') or
   (prior_record.review_kind='out_of_band_pin_challenge_reconciliation'
    and new.review_kind='multi_application_hold_gate_decision') or
   (prior_record.review_kind='multi_application_hold_gate_decision'
    and new.review_kind='independent_source_proof_exception_intake')) then
   raise exception 'QL-246 intake, pin challenge and six-app HOLD decision are sequential'; end if;
  if prior_record.reviewed_by_user_id=new.reviewed_by_user_id then
   raise exception 'Independent follow-up author must differ from preceding reviewer'; end if;
  due_reference:=prior_record.next_due_at;
 end if;
 if base.reviewed_by_user_id=new.reviewed_by_user_id then
  raise exception 'Independent author cannot self-review the Build 142 receipt'; end if;
 new.observed_prior_overdue_days:=greatest(0,floor(extract(epoch from
  (new.reviewed_at-due_reference))/86400))::int;
 select count(*) filter(where r.outcome_kind in
  ('source_metadata_mismatch','pin_mismatch_escalated','hold_recurrence_escalated',
   'owner_evidence_requested'))::int,
  count(*) filter(where r.next_due_at<new.reviewed_at)::int
  into new.observed_open_142_exceptions,new.observed_overdue_142_leaves
  from public.owner_export_ql245_source_pin_hold_reviews r
  where r.source_campground_id=new.source_campground_id
   and r.target_campground_id=new.target_campground_id
   and not exists(select 1 from public.owner_export_ql245_source_pin_hold_reviews child
    where child.prior_review_id=r.id);
 select count(distinct r.source_system)::int into new.observed_six_app_source_kinds
  from public.owner_export_ql246_exception_pin_hold_decisions r
  where r.source_campground_id=new.source_campground_id
   and r.target_campground_id=new.target_campground_id
   and r.review_kind='independent_source_proof_exception_intake';
 if new.review_kind='independent_source_proof_exception_intake' then
  if new.outcome_kind='proof_missing' and (new.proof_raw_json_sha256 is not null
   or new.source_proof_status<>'MISSING') then
   raise exception 'Missing proof cannot claim a signed JSON digest'; end if;
  if new.outcome_kind='proof_blocked' and new.source_proof_status<>'BLOCKED' then
   raise exception 'Blocked proof must remain explicitly BLOCKED'; end if;
  if new.outcome_kind='proof_unverified' and
   (new.source_proof_status<>'PRESENT_UNVERIFIED' or new.proof_raw_json_sha256 is null
    or new.source_revision is null) then
   raise exception 'PRESENT_UNVERIFIED requires actual source/CI and JSON digest'; end if;
  if new.outcome_kind='proof_exception_escalated' and
   new.source_proof_status not in('MISSING','BLOCKED','PRESENT_UNVERIFIED') then
   raise exception 'Proof exception must retain its actual documentary state'; end if;
 end if;
 if new.review_kind='out_of_band_pin_challenge_reconciliation' then
  new.observed_public_pin_string_match:=new.public_signer_spki_sha256 is not null
   and new.public_signer_spki_sha256=new.out_of_band_spki_sha256;
  if new.outcome_kind='pin_not_provisioned' and
   (new.public_signer_spki_sha256 is not null or new.out_of_band_reference is not null
    or new.operator_challenge_id is not null) then
   raise exception 'Do not invent keys or challenges for unprovisioned pins'; end if;
  if new.outcome_kind='pin_independence_unverified' and
   (not coalesce(new.observed_public_pin_string_match,false)
    or new.out_of_band_reference is null) then
   raise exception 'Documentary public pins must match with a real independent-channel reference'; end if;
  if new.outcome_kind='pin_mismatch_escalated' and
   (new.public_signer_spki_sha256 is null
    or new.public_signer_spki_sha256=new.out_of_band_spki_sha256) then
   raise exception 'Observed public signer pin mismatch requires two distinct public fingerprints'; end if;
 end if;
 if new.outcome_kind='six_app_exception_escalated' and
  new.observed_open_142_exceptions=0 and new.observed_overdue_142_leaves=0 then
  raise exception 'Six-app recurrence escalation requires observed Build 142 exceptions'; end if;
 if new.next_due_at<=new.reviewed_at or
  new.next_due_at>new.reviewed_at+interval '90 days' then
  raise exception 'QL-246 independent follow-up must be due within 90 days'; end if;
 -- Never elevate documentary metadata into independently verified gateway proof.
 new.observed_six_app_proofs_independently_verified:=0;
 new.source_proof_signature_verified:=false;
 new.independent_pin_channel_verified:=false;
 new.seven_denials_witnessed:=false;
 new.nonproduction_gateway_get_verified:=false;
 new.phase_b_test_authorized:=false;
 new.owner_pilot_authorized:=false;
 new.dispatch_enabled:=false;
 new.connection_state:='DISCONNECTED';
 new.gate_state:='HOLD';
 return new;
end $$;
create trigger ql246_exception_pin_hold_guard before insert
 on public.owner_export_ql246_exception_pin_hold_decisions for each row
 execute function icamp_private.ql246_exception_pin_hold_guard();
create trigger ql246_exception_pin_hold_immutable before update or delete
 on public.owner_export_ql246_exception_pin_hold_decisions for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_ql246_exception_pin_hold_decisions enable row level security;
alter table public.owner_export_ql246_exception_pin_hold_decisions force row level security;
revoke all on public.owner_export_ql246_exception_pin_hold_decisions from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_ql246_exception_pin_hold_decisions from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_ql246_exception_pin_hold_decisions to icamp_app;
create policy ql246_exception_pin_hold_select on public.owner_export_ql246_exception_pin_hold_decisions
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy ql246_exception_pin_hold_insert on public.owner_export_ql246_exception_pin_hold_decisions
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.ql246_exception_pin_hold_guard() from public;
