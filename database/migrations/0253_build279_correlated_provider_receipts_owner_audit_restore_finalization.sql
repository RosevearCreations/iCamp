-- Build 279: immutable correlation and independent review only.
-- A matching original signed peer handshake is not independent provider custody certification;
-- restoration requires actual external provider and isolated host proof, not a database insert.

create table icamp_private.provider_receipt_correlation279 (
 id uuid primary key default gen_random_uuid(),
 field_review_id uuid not null unique
  references icamp_private.peer_field_review278(id) on delete restrict,
 signed_receipt_id uuid not null unique
  references icamp_private.signed_source_handshake275(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 independent_provider_evidence_sha256 text not null
  check(independent_provider_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_provider_receipt_correlation279()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Original provider correlations immutable'; end if;
 if actor is null or actor<>new.reviewer_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active'
   and b.binding_state='verified' and b.verified_by is not null
   and b.verified_by<>b.user_id
   and a.account_type='staff' and a.account_state='active'
 ) or not exists(
  select 1 from icamp_private.peer_field_review278 f
  join icamp_private.peer_challenge_response277 r on r.id=f.challenge_response_id
  join icamp_private.peer_challenge277 c on c.id=r.challenge_id
  join icamp_private.owner_peer_pin277 ownerpin on true
  join icamp_private.peer_signer_proposal276 p
   on p.id=ownerpin.proposal_id and p.source_id=c.source_id
   and p.key_id=c.key_id and p.commit_sha=c.commit_sha
  join icamp_private.peer_signer_review276 reviewerpin
   on reviewerpin.proposal_id=p.id
  join icamp_private.signed_source_handshake275 h
   on h.source_id=c.source_id and h.key_id=c.key_id and h.commit_sha=c.commit_sha
  where f.id=new.field_review_id and h.id=new.signed_receipt_id
   and r.source_id=c.source_id and h.nonce<>r.nonce
   and h.challenge_id<>c.challenge_id
   and r.accepted_at>=statement_timestamp()-interval '5 minutes'
   and h.received_at>=statement_timestamp()-interval '5 minutes'
   and h.received_at<=statement_timestamp()+interval '30 seconds'
   and abs(extract(epoch from (h.observed_at-r.observed_at)))<=300
   and f.observed_at>=r.accepted_at
   and f.reviewer_user_id<>actor
   and ownerpin.owner_user_id<>actor
   and p.proposed_by<>actor
   and reviewerpin.reviewed_by<>actor
 ) then raise exception 'Original peer signature receipt and independent correlated reviewer required';end if;
 return new;
end $$;
create trigger provider_receipt_correlation279_guard before insert or update or delete
 on icamp_private.provider_receipt_correlation279 for each row
 execute function icamp_private.guard_provider_receipt_correlation279();

create table icamp_private.owner_recovery_access_audit279 (
 id uuid primary key default gen_random_uuid(),
 mfa_readback_id uuid not null unique references
  icamp_private.owner_mfa_readback278(id) on delete restrict,
 auditor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 original_access_evidence_sha256 text not null check(original_access_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_owner_recovery_access_audit279()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Original owner access audits immutable';end if;
 if actor is null or actor<>new.auditor_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
   and a.account_type='staff' and a.account_state='active'
 ) or not exists(
  select 1 from icamp_private.owner_mfa_readback278 m
  join icamp_private.auth_sessions s on s.id=m.session_id
  join icamp_private.user_accounts a on a.id=m.owner_user_id
  join icamp_private.password_credentials pw on pw.user_id=a.id
  join icamp_private.platform_operator_grants g on g.user_id=a.id
  join icamp_private.platform_master_owner_bindings b on b.user_id=a.id
  join icamp_private.owner_login_witness272 w on w.session_id=s.id
  where m.id=new.mfa_readback_id and s.user_id=a.id
   and a.username_normalized='rosevear' and a.account_type='staff'
   and a.account_state='active' and a.mfa_required and a.email_verified_at is not null
   and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>a.id
   and s.assurance_level='aal2' and s.revoked_at is null
   and s.expires_at>statement_timestamp()
   and s.reauthenticated_at>=statement_timestamp()-interval '15 minutes'
   and m.owner_user_id<>actor and m.reviewer_user_id<>actor
   and w.subject_user_id=a.id and w.reviewer_user_id<>actor
   and exists(select 1 from icamp_private.mfa_factors f
    where f.user_id=a.id and f.factor_state='verified')
 ) then raise exception 'Live original Rosevear AAL2 login and separate access auditor required';end if;
 return new;
end $$;
create trigger owner_recovery_access_audit279_guard before insert or update or delete
 on icamp_private.owner_recovery_access_audit279 for each row
 execute function icamp_private.guard_owner_recovery_access_audit279();

create table icamp_private.isolated_restore_evidence279 (
 id uuid primary key default gen_random_uuid(),
 service_readback_id uuid not null unique
   references icamp_private.restore_service_readback278(id) on delete restrict,
 final_reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 original_backup_manifest_sha256 text not null check(original_backup_manifest_sha256 ~ '^[a-f0-9]{64}$'),
 tenant_isolation_sha256 text not null check(tenant_isolation_sha256 ~ '^[a-f0-9]{64}$'),
 reservation_integrity_sha256 text not null check(reservation_integrity_sha256 ~ '^[a-f0-9]{64}$'),
 payment_ledger_sha256 text not null check(payment_ledger_sha256 ~ '^[a-f0-9]{64}$'),
 service_health_sha256 text not null check(service_health_sha256 ~ '^[a-f0-9]{64}$'),
 independent_comparison_sha256 text not null check(independent_comparison_sha256 ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_isolated_restore_evidence279()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Original isolated restore evidence immutable';end if;
 if actor is null or actor<>new.final_reviewer_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
   and a.account_type='staff' and a.account_state='active'
 ) or not exists(
  select 1 from icamp_private.restore_service_readback278 s
  join icamp_private.external_restore_review277 e on e.id=s.external_review_id
  join icamp_private.restore_closure_review276 c on c.id=e.closure_review_id
  join icamp_private.restore_provider_attestation273 p on p.id=c.provider_attestation_id
  join icamp_private.restore_dryrun_review272 d on d.id=p.restore_review_id
  join icamp_private.pilot_restore_witness269 w
    on w.original_backup_digest_sha256=d.backup_sha256
      and w.witness_kind='independent_review'
  where s.id=new.service_readback_id
   and s.reviewer_user_id<>actor and e.reviewer_user_id<>actor
   and c.reviewed_by<>actor and d.reviewer_user_id<>actor
   and w.actor_user_id<>actor
   and e.source_host_sha256=p.source_host_sha256
   and e.isolated_host_sha256=p.isolated_host_sha256
   and p.source_host_sha256<>p.isolated_host_sha256
   and s.reviewed_at>=statement_timestamp()-interval '7 days'
 ) then raise exception 'Distinct reviewed original provider/isolated host chain required';end if;
 return new;
end $$;
create trigger isolated_restore_evidence279_guard before insert or update or delete
 on icamp_private.isolated_restore_evidence279 for each row
 execute function icamp_private.guard_isolated_restore_evidence279();

do $$
declare tab text;
begin
 foreach tab in array array[
  'provider_receipt_correlation279','owner_recovery_access_audit279',
  'isolated_restore_evidence279'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',
   tab||'_deny_direct',tab);
 end loop;
end $$;
