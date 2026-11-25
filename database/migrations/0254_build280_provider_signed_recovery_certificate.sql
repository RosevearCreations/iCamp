-- Build 280: require a real separately enrolled external Ed25519 provider, independently
-- witnessed original Rosevear MFA session and original isolated restore evidence.
-- App cryptographically checks provider signature BEFORE inserting. SQL enforces
-- immutable, original, independently verified authorization and evidence lineage.
-- This is a controlled evidence-review certificate, NOT a production restore.

create table icamp_private.external_provider_key_proposal280 (
 id uuid primary key default gen_random_uuid(),
 provider_id text not null check(provider_id ~ '^[a-z0-9_-]{8,64}$'),
 key_id text not null check(key_id ~ '^[a-z0-9_-]{8,80}$'),
 public_key_pem text not null check(char_length(public_key_pem) between 80 and 1200),
 key_fingerprint_sha256 text not null check(key_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
 independent_source_evidence_sha256 text not null check(independent_source_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 proposed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 proposed_at timestamptz not null default statement_timestamp(),
 unique(provider_id,key_id)
);
create function icamp_private.guard_external_provider_key_proposal280()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Provider key proposals immutable';end if;
 if actor is null or actor<>new.proposed_by or
  new.public_key_pem not like '-----BEGIN PUBLIC KEY-----%END PUBLIC KEY-----%' or
  new.public_key_pem like '%PRIVATE KEY%' or not exists(
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   join icamp_private.user_accounts a on a.id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
    and b.verified_by is not null and b.verified_by<>actor
    and a.account_state='active' and a.account_type='staff'
  ) then raise exception 'Only original approved operator may propose external public key';end if;
 return new;
end $$;
create trigger external_provider_key_proposal280_guard before insert or update or delete
 on icamp_private.external_provider_key_proposal280 for each row
 execute function icamp_private.guard_external_provider_key_proposal280();

create table icamp_private.external_provider_key_review280 (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique references icamp_private.external_provider_key_proposal280(id) on delete restrict,
 reviewed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 verified_out_of_band_sha256 text not null check(verified_out_of_band_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_external_provider_key_review280()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Provider key reviews immutable';end if;
 if actor is null or actor<>new.reviewed_by or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
    and b.verified_by is not null and b.verified_by<>actor
    and a.account_state='active' and a.account_type='staff'
 ) or not exists(
  select 1 from icamp_private.external_provider_key_proposal280 p
  where p.id=new.proposal_id and p.proposed_by<>actor
   and p.proposed_at>=statement_timestamp()-interval '7 days'
 ) then raise exception 'Different qualified out-of-band provider key reviewer required';end if;
 return new;
end $$;
create trigger external_provider_key_review280_guard before insert or update or delete
 on icamp_private.external_provider_key_review280 for each row
 execute function icamp_private.guard_external_provider_key_review280();

create table icamp_private.external_provider_signed_closure280 (
 id uuid primary key default gen_random_uuid(),
 key_review_id uuid not null references icamp_private.external_provider_key_review280(id) on delete restrict,
 isolated_evidence_id uuid not null unique references icamp_private.isolated_restore_evidence279(id) on delete restrict,
 provider_id text not null check(provider_id ~ '^[a-z0-9_-]{8,64}$'),
 provider_event_id text not null check(char_length(provider_event_id) between 16 and 160),
 nonce text not null check(nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 signed_body text not null check(char_length(signed_body) between 120 and 3000),
 signature_b64url text not null check(signature_b64url ~ '^[A-Za-z0-9_-]{86}$'),
 body_sha256 text not null check(body_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 unique(provider_id,provider_event_id),unique(provider_id,nonce)
);
create function icamp_private.guard_external_provider_signed_closure280()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Provider signed closure immutable';end if;
 if actor is null or actor<>new.reviewed_by or
  encode(public.digest(new.signed_body,'sha256'),'hex')<>new.body_sha256 or
  not exists(
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   join icamp_private.user_accounts a on a.id=g.user_id
    where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
     and b.verified_by is not null and b.verified_by<>actor
     and a.account_state='active' and a.account_type='staff'
  ) or not exists(
   select 1 from icamp_private.external_provider_key_review280 k
   join icamp_private.external_provider_key_proposal280 p on p.id=k.proposal_id
   join icamp_private.isolated_restore_evidence279 e on e.id=new.isolated_evidence_id
   join icamp_private.restore_service_readback278 s on s.id=e.service_readback_id
   join icamp_private.external_restore_review277 r on r.id=s.external_review_id
   join icamp_private.restore_closure_review276 c on c.id=r.closure_review_id
   join icamp_private.restore_provider_attestation273 a on a.id=c.provider_attestation_id
    where k.id=new.key_review_id and p.provider_id=new.provider_id
     and a.provider_id=new.provider_id
     and p.proposed_by<>actor and k.reviewed_by<>actor
     and e.final_reviewer_user_id<>actor and s.reviewer_user_id<>actor
     and r.reviewer_user_id<>actor and c.reviewed_by<>actor
     and a.source_host_sha256=r.source_host_sha256
     and a.isolated_host_sha256=r.isolated_host_sha256
     and a.source_host_sha256<>a.isolated_host_sha256
     and e.recorded_at>=statement_timestamp()-interval '7 days'
  ) then raise exception 'Real separate signed provider original isolation chain and distinct reviewer required';end if;
 return new;
end $$;
create trigger external_provider_signed_closure280_guard before insert or update or delete
 on icamp_private.external_provider_signed_closure280 for each row
 execute function icamp_private.guard_external_provider_signed_closure280();

create table icamp_private.owner_recovery_witness280 (
 id uuid primary key default gen_random_uuid(),
 owner_audit_id uuid not null unique references icamp_private.owner_recovery_access_audit279(id) on delete restrict,
 witness_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 original_recovery_evidence_sha256 text not null check(original_recovery_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 witnessed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_owner_recovery_witness280()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Original account recovery witness immutable';end if;
 if actor is null or actor<>new.witness_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
   and a.account_state='active' and a.account_type='staff'
 ) or not exists(
  select 1 from icamp_private.owner_recovery_access_audit279 a
  join icamp_private.owner_mfa_readback278 m on m.id=a.mfa_readback_id
  join icamp_private.owner_login_witness272 w on w.session_id=m.session_id
  join icamp_private.auth_sessions s on s.id=m.session_id
  join icamp_private.user_accounts o on o.id=m.owner_user_id
  join icamp_private.platform_operator_grants g on g.user_id=o.id
  join icamp_private.platform_master_owner_bindings b on b.user_id=o.id
  where a.id=new.owner_audit_id and o.id=s.user_id and o.username_normalized='rosevear'
   and o.account_state='active' and o.account_type='staff'
   and o.email_verified_at is not null and o.mfa_required=true
   and g.grant_state='active' and b.binding_state='verified' and b.verified_by<>o.id
   and s.assurance_level='aal2' and s.revoked_at is null
   and s.expires_at>statement_timestamp()
   and s.reauthenticated_at>=statement_timestamp()-interval '15 minutes'
   and m.reviewer_user_id<>actor and a.auditor_user_id<>actor
   and w.reviewer_user_id<>actor and m.owner_user_id<>actor
   and exists(select 1 from icamp_private.mfa_factors f
      where f.user_id=o.id and f.factor_state='verified')
 ) then raise exception 'Active original Rosevear MFA and separate completion witness required';end if;
 return new;
end $$;
create trigger owner_recovery_witness280_guard before insert or update or delete
 on icamp_private.owner_recovery_witness280 for each row
 execute function icamp_private.guard_owner_recovery_witness280();

create table icamp_private.isolated_restore_certificate280 (
 id uuid primary key default gen_random_uuid(),
 provider_closure_id uuid not null unique references icamp_private.external_provider_signed_closure280(id) on delete restrict,
 owner_witness_id uuid not null unique references icamp_private.owner_recovery_witness280(id) on delete restrict,
 certificate_evidence_sha256 text not null check(certificate_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 certified_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_isolated_restore_certificate280()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Isolated review certificate immutable';end if;
 if actor is null or actor<>new.certified_by or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
    and b.verified_by is not null and b.verified_by<>actor
    and a.account_state='active' and a.account_type='staff'
 ) or not exists(
  select 1 from icamp_private.external_provider_signed_closure280 p
  join icamp_private.external_provider_key_review280 k on k.id=p.key_review_id
  join icamp_private.external_provider_key_proposal280 kp on kp.id=k.proposal_id
  join icamp_private.isolated_restore_evidence279 r on r.id=p.isolated_evidence_id
  join icamp_private.owner_recovery_witness280 w on w.id=new.owner_witness_id
  join icamp_private.owner_recovery_access_audit279 a on a.id=w.owner_audit_id
  join icamp_private.owner_mfa_readback278 m on m.id=a.mfa_readback_id
  join icamp_private.auth_sessions s on s.id=m.session_id
  where p.id=new.provider_closure_id
   and p.reviewed_by<>actor and k.reviewed_by<>actor and kp.proposed_by<>actor
   and r.final_reviewer_user_id<>actor and w.witness_user_id<>actor
   and a.auditor_user_id<>actor and m.reviewer_user_id<>actor
   and s.assurance_level='aal2' and s.revoked_at is null
   and s.expires_at>statement_timestamp()
   and s.reauthenticated_at>=statement_timestamp()-interval '15 minutes'
   and p.recorded_at>=statement_timestamp()-interval '7 days'
   and w.witnessed_at>=statement_timestamp()-interval '15 minutes'
 ) or (select count(distinct h.source_id) from icamp_private.provider_receipt_correlation279 c
  join icamp_private.signed_source_handshake275 h on h.id=c.signed_receipt_id
   where c.reviewed_at>=statement_timestamp()-interval '5 minutes'
  )<>7 then raise exception 'Seven original correlations, signed provider, active owner and independent certificate reviewer required';end if;
 return new;
end $$;
create trigger isolated_restore_certificate280_guard before insert or update or delete
 on icamp_private.isolated_restore_certificate280 for each row
 execute function icamp_private.guard_isolated_restore_certificate280();

do $$
declare tab text;
begin
 foreach tab in array array[
  'external_provider_key_proposal280','external_provider_key_review280',
  'external_provider_signed_closure280','owner_recovery_witness280',
  'isolated_restore_certificate280'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',
   tab||'_deny_direct',tab);
 end loop;
end $$;
