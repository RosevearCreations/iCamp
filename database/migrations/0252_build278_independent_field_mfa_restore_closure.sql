-- Build 278: append-only independent reviews of original source field challenges,
-- real original owner MFA login, and externally observed restore service readbacks.
-- An attestation receipt never generates credentials or restores production.

create table icamp_private.peer_field_review278 (
 id uuid primary key default gen_random_uuid(),
 challenge_response_id uuid not null unique references icamp_private.peer_challenge_response277(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 external_source_digest_sha256 text not null check (external_source_digest_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_peer_field_review278()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Original field reviews are immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
    and b.verified_by is not null and b.verified_by<>actor
 ) or not exists(
  select 1 from icamp_private.peer_challenge_response277 r
  join icamp_private.peer_challenge277 c on c.id=r.challenge_id
  join icamp_private.peer_signer_proposal276 p
   on p.source_id=c.source_id and p.key_id=c.key_id and p.commit_sha=c.commit_sha
  join icamp_private.owner_peer_pin277 pin on pin.proposal_id=p.id
  where r.id=new.challenge_response_id
   and r.source_id=c.source_id
   and r.accepted_at<=c.expires_at
   and r.accepted_at>=c.issued_at
   and r.accepted_at>=statement_timestamp()-interval '5 minutes'
   and pin.owner_user_id<>actor
 ) then raise exception 'Fresh original field source and independent operator required';end if;
 return new;
end $$;
create trigger peer_field_review278_guard before insert or update or delete
 on icamp_private.peer_field_review278 for each row
 execute function icamp_private.guard_peer_field_review278();

create table icamp_private.owner_mfa_readback278 (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null unique references icamp_private.auth_sessions(id) on delete restrict,
 owner_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 external_evidence_sha256 text not null check(external_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_owner_mfa_readback278()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Owner login completion reviews are immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or actor=new.owner_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
    and b.verified_by is not null and b.verified_by<>actor
 ) or not exists(
  select 1 from icamp_private.user_accounts a
  join icamp_private.auth_sessions s on s.user_id=a.id
  join icamp_private.platform_operator_grants g on g.user_id=a.id
  join icamp_private.platform_master_owner_bindings b on b.user_id=a.id
  join icamp_private.owner_login_witness272 w on w.session_id=s.id
   where a.id=new.owner_user_id and a.username_normalized='rosevear'
    and a.account_type='staff' and a.account_state='active'
    and a.mfa_required and a.email_verified_at is not null
    and s.id=new.session_id and s.assurance_level='aal2'
    and s.revoked_at is null and s.expires_at>statement_timestamp()
    and s.reauthenticated_at>statement_timestamp()-interval '15 minutes'
    and g.grant_state='active' and b.binding_state='verified'
    and b.verified_by is not null and b.verified_by<>a.id
    and w.subject_user_id=a.id and w.reviewer_user_id<>a.id
 ) then raise exception 'Real recent Rosevear MFA session and a different independent reviewer required';end if;
 return new;
end $$;
create trigger owner_mfa_readback278_guard before insert or update or delete
 on icamp_private.owner_mfa_readback278 for each row
 execute function icamp_private.guard_owner_mfa_readback278();

create table icamp_private.restore_service_readback278 (
 id uuid primary key default gen_random_uuid(),
 external_review_id uuid not null unique references icamp_private.external_restore_review277(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 provider_service_evidence_sha256 text not null check(provider_service_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 isolated_service_evidence_sha256 text not null check(isolated_service_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 readback_evidence_sha256 text not null check(readback_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp(),
 check(provider_service_evidence_sha256<>isolated_service_evidence_sha256)
);
create function icamp_private.guard_restore_service_readback278()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Restore service readback immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
 ) or not exists(
  select 1 from icamp_private.external_restore_review277 e
  join icamp_private.restore_closure_review276 c on c.id=e.closure_review_id
  join icamp_private.restore_provider_attestation273 p on p.id=c.provider_attestation_id
  join icamp_private.restore_dryrun_review272 d on d.id=p.restore_review_id
  where e.id=new.external_review_id
   and e.reviewer_user_id<>actor and c.reviewed_by<>actor
   and d.reviewer_user_id<>actor
   and p.source_host_sha256=e.source_host_sha256
   and p.isolated_host_sha256=e.isolated_host_sha256
   and e.reviewed_at>=statement_timestamp()-interval '7 days'
 ) then raise exception 'Original signed provider, isolated host and distinct service reviewer required';end if;
 return new;
end $$;
create trigger restore_service_readback278_guard before insert or update or delete
 on icamp_private.restore_service_readback278 for each row
 execute function icamp_private.guard_restore_service_readback278();

do $$
declare tab text;
begin
 foreach tab in array array[
  'peer_field_review278','owner_mfa_readback278','restore_service_readback278'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',
   tab||'_deny_direct',tab);
 end loop;
end $$;
