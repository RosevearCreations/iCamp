-- Build 281: append-only, fail-closed ORIGINAL provider custody, owner MFA continuity,
-- provider-signed external restore ACK, and independently witnessed monitor snapshots.
-- Provider Ed25519 signatures are verified in the application before insertion and
-- on every readback. No production restore, account grant or credential mutation.
create table icamp_private.provider_custody_review281 (
 id uuid primary key default gen_random_uuid(),
 provider_closure_id uuid not null unique
   references icamp_private.external_provider_signed_closure280(id) on delete restrict,
 reviewed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 original_custody_evidence_sha256 text not null check(original_custody_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_provider_custody_review281()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Original provider custody reviews immutable';end if;
 if actor is null or actor<>new.reviewed_by or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
   and a.account_state='active' and a.account_type='staff'
 ) or not exists(
  select 1 from icamp_private.external_provider_signed_closure280 c
  join icamp_private.external_provider_key_review280 k on k.id=c.key_review_id
  join icamp_private.external_provider_key_proposal280 p on p.id=k.proposal_id
  join icamp_private.isolated_restore_evidence279 e on e.id=c.isolated_evidence_id
  where c.id=new.provider_closure_id and p.provider_id=c.provider_id
   and k.reviewed_by<>actor and p.proposed_by<>actor
   and c.reviewed_by<>actor and e.final_reviewer_user_id<>actor
   and c.recorded_at>=statement_timestamp()-interval '7 days'
 ) then raise exception 'Independently reviewed original provider key, signature, isolate required';end if;
 return new;
end $$;
create trigger provider_custody_review281_guard before insert or update or delete
 on icamp_private.provider_custody_review281 for each row
 execute function icamp_private.guard_provider_custody_review281();

create table icamp_private.owner_mfa_continuity281 (
 id uuid primary key default gen_random_uuid(),
 original_witness_id uuid not null unique
  references icamp_private.owner_recovery_witness280(id) on delete restrict,
 session_id uuid not null references icamp_private.auth_sessions(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 continuity_evidence_sha256 text not null check(continuity_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 witnessed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_owner_mfa_continuity281()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Original MFA continuity immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
   and a.account_state='active' and a.account_type='staff'
 ) or not exists(
  select 1 from icamp_private.owner_recovery_witness280 w
  join icamp_private.owner_recovery_access_audit279 a on a.id=w.owner_audit_id
  join icamp_private.owner_mfa_readback278 m on m.id=a.mfa_readback_id
  join icamp_private.auth_sessions s on s.id=m.session_id
  join icamp_private.user_accounts owner on owner.id=m.owner_user_id
  join icamp_private.platform_operator_grants grant_owner on grant_owner.user_id=owner.id
  join icamp_private.platform_master_owner_bindings bind_owner on bind_owner.user_id=owner.id
  where w.id=new.original_witness_id and s.id=new.session_id
   and s.user_id=owner.id and owner.username_normalized='rosevear'
   and owner.account_type='staff' and owner.account_state='active'
   and owner.email_verified_at is not null and owner.mfa_required
   and grant_owner.grant_state='active' and bind_owner.binding_state='verified'
   and bind_owner.verified_by<>owner.id
   and s.assurance_level='aal2' and s.revoked_at is null
   and s.expires_at>statement_timestamp()
   and s.reauthenticated_at>=statement_timestamp()-interval '15 minutes'
   and w.witnessed_at>=statement_timestamp()-interval '15 minutes'
   and w.witness_user_id<>actor and a.auditor_user_id<>actor
   and m.reviewer_user_id<>actor and owner.id<>actor
   and exists(select 1 from icamp_private.mfa_factors f
    where f.user_id=owner.id and f.factor_state='verified')
 ) then raise exception 'Live original Rosevear AAL2 and fresh independent continuity required';end if;
 return new;
end $$;
create trigger owner_mfa_continuity281_guard before insert or update or delete
 on icamp_private.owner_mfa_continuity281 for each row
 execute function icamp_private.guard_owner_mfa_continuity281();

create table icamp_private.external_restore_final_ack281 (
 id uuid primary key default gen_random_uuid(),
 certificate_id uuid not null unique references icamp_private.isolated_restore_certificate280(id) on delete restrict,
 custody_review_id uuid not null unique references icamp_private.provider_custody_review281(id) on delete restrict,
 owner_continuity_id uuid not null unique references icamp_private.owner_mfa_continuity281(id) on delete restrict,
 provider_id text not null check(provider_id ~ '^[a-z0-9_-]{8,64}$'),
 provider_event_id text not null check(provider_event_id ~ '^[A-Za-z0-9_-]{16,160}$'),
 nonce text not null check(nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 signed_body text not null check(char_length(signed_body) between 120 and 3200),
 signature_b64url text not null check(signature_b64url ~ '^[A-Za-z0-9_-]{86}$'),
 body_sha256 text not null check(body_sha256 ~ '^[a-f0-9]{64}$'),
 independently_reviewed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 unique(provider_id,provider_event_id),unique(provider_id,nonce)
);
create function icamp_private.guard_external_restore_final_ack281()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Original external provider final ACK immutable';end if;
 if actor is null or actor<>new.independently_reviewed_by or
  encode(public.digest(new.signed_body,'sha256'),'hex')<>new.body_sha256
  or not exists(
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   join icamp_private.user_accounts a on a.id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
    and b.verified_by<>actor and b.verified_by is not null
    and a.account_state='active' and a.account_type='staff'
 ) or not exists(
  select 1 from icamp_private.isolated_restore_certificate280 cert
  join icamp_private.external_provider_signed_closure280 c on c.id=cert.provider_closure_id
  join icamp_private.external_provider_key_review280 k on k.id=c.key_review_id
  join icamp_private.external_provider_key_proposal280 p on p.id=k.proposal_id
  join icamp_private.provider_custody_review281 pc on pc.provider_closure_id=c.id
  join icamp_private.owner_mfa_continuity281 om on om.id=new.owner_continuity_id
  join icamp_private.owner_recovery_witness280 w on w.id=om.original_witness_id
   and w.id=cert.owner_witness_id
  join icamp_private.auth_sessions s on s.id=om.session_id
  where cert.id=new.certificate_id and pc.id=new.custody_review_id
   and c.provider_id=new.provider_id and p.provider_id=c.provider_id
   and k.reviewed_by<>actor and p.proposed_by<>actor
   and c.reviewed_by<>actor and pc.reviewed_by<>actor
   and cert.certified_by<>actor and om.reviewer_user_id<>actor
   and w.witness_user_id<>actor
   and s.assurance_level='aal2' and s.revoked_at is null
   and s.expires_at>statement_timestamp()
   and s.reauthenticated_at>=statement_timestamp()-interval '15 minutes'
   and om.witnessed_at>=statement_timestamp()-interval '15 minutes'
   and pc.reviewed_at>=statement_timestamp()-interval '7 days'
 ) then raise exception 'Distinct original signer custody, live Rosevear and certificate required';end if;
 return new;
end $$;
create trigger external_restore_final_ack281_guard before insert or update or delete
 on icamp_private.external_restore_final_ack281 for each row
 execute function icamp_private.guard_external_restore_final_ack281();

create table icamp_private.original_restore_monitor_sample281 (
 id uuid primary key default gen_random_uuid(),
 external_ack_id uuid not null references icamp_private.external_restore_final_ack281(id) on delete restrict,
 sampler_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 original_review_evidence_sha256 text not null check(original_review_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_original_restore_monitor_sample281()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Original monitored samples immutable';end if;
 if actor is null or actor<>new.sampler_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by<>actor and b.verified_by is not null
   and a.account_state='active' and a.account_type='staff'
 ) or not exists(
  select 1 from icamp_private.external_restore_final_ack281 x
  join icamp_private.owner_mfa_continuity281 oc on oc.id=x.owner_continuity_id
  join icamp_private.auth_sessions s on s.id=oc.session_id
  where x.id=new.external_ack_id
   and x.recorded_at>=statement_timestamp()-interval '5 minutes'
   and oc.witnessed_at>=statement_timestamp()-interval '15 minutes'
   and s.assurance_level='aal2' and s.revoked_at is null
   and s.expires_at>statement_timestamp()
   and s.reauthenticated_at>=statement_timestamp()-interval '15 minutes'
   and x.independently_reviewed_by<>actor
   and oc.reviewer_user_id<>actor
 ) or (select count(distinct h.source_id) from icamp_private.provider_receipt_correlation279 c
  join icamp_private.signed_source_handshake275 h on h.id=c.signed_receipt_id
  where c.reviewed_at>=statement_timestamp()-interval '5 minutes')<>7
 then raise exception 'Fresh signed external ACK, seven sources and genuine original MFA required';end if;
 return new;
end $$;
create trigger original_restore_monitor_sample281_guard before insert or update or delete
 on icamp_private.original_restore_monitor_sample281 for each row
 execute function icamp_private.guard_original_restore_monitor_sample281();

do $$
declare tab text;
begin
 foreach tab in array array[
  'provider_custody_review281','owner_mfa_continuity281',
  'external_restore_final_ack281','original_restore_monitor_sample281'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',
   tab||'_deny_direct',tab);
 end loop;
end $$;
