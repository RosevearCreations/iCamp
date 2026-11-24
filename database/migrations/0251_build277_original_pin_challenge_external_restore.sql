-- Build 277: source pin adoption requires real Rosevear AAL2 session + independent
-- witnessed owner login; field challenge and response are immutable, one-use.
-- Does not touch users, payments, source secrets, guest data or restore databases.

create table icamp_private.owner_peer_pin277 (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique references icamp_private.peer_signer_proposal276(id) on delete restrict,
 owner_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 owner_session_id uuid not null references icamp_private.auth_sessions(id) on delete restrict,
 external_proof_sha256 text not null check (external_proof_sha256 ~ '^[a-f0-9]{64}$'),
 adopted_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_owner_peer_pin277()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Owner source pins are immutable';end if;
 if actor is null or actor<>new.owner_user_id or not exists(
  select 1 from icamp_private.user_accounts a
  join icamp_private.auth_sessions s on s.user_id=a.id
  join icamp_private.platform_operator_grants g on g.user_id=a.id
  join icamp_private.platform_master_owner_bindings b on b.user_id=a.id
  join icamp_private.owner_login_witness272 w on w.session_id=s.id
  where a.id=actor and a.username_normalized='rosevear' and a.account_type='staff'
   and a.account_state='active' and a.mfa_required and a.email_verified_at is not null
   and s.id=new.owner_session_id and s.assurance_level='aal2'
   and s.revoked_at is null and s.expires_at>statement_timestamp()
   and s.reauthenticated_at>statement_timestamp()-interval '15 minutes'
   and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
   and w.subject_user_id=actor and w.reviewer_user_id<>actor
 ) or not exists(
  select 1 from icamp_private.peer_signer_proposal276 p
  join icamp_private.peer_signer_review276 r on r.proposal_id=p.id
  where p.id=new.proposal_id and p.proposed_by<>r.reviewed_by
   and r.reviewed_at>=statement_timestamp()-interval '7 days'
 ) then raise exception 'Actual original Rosevear MFA login, witnessed session and independently enrolled peer required'; end if;
 return new;
end $$;
create trigger owner_peer_pin277_guard before insert or update or delete
 on icamp_private.owner_peer_pin277 for each row execute function icamp_private.guard_owner_peer_pin277();

create table icamp_private.peer_challenge277 (
 id uuid primary key default gen_random_uuid(),
 source_id text not null check(source_id in (
  'ai-data-platform','rosevear-comms-hub','rosevear-ai-hub',
  'yard-workers','rosie-dazzlers','devil-n-dove','icamp'
 )),
 key_id text not null check(key_id ~ '^[a-z0-9_-]{8,80}$'),
 commit_sha text not null check(commit_sha ~ '^[a-f0-9]{40}$'),
 challenge_id text not null unique check(challenge_id ~ '^[A-Za-z0-9_-]{16,96}$'),
 request_nonce text not null check(request_nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 request_sha256 text not null check(request_sha256 ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz not null default statement_timestamp(),
 expires_at timestamptz not null default statement_timestamp()+interval '90 seconds',
 unique (source_id,request_nonce),
 check (expires_at>issued_at and expires_at<=issued_at+interval '90 seconds')
);
create function icamp_private.guard_peer_challenge277()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Original peer challenges are immutable';end if;
 if not exists(
  select 1 from icamp_private.owner_peer_pin277 pin
  join icamp_private.peer_signer_proposal276 p on p.id=pin.proposal_id
  where p.source_id=new.source_id and p.key_id=new.key_id
   and p.commit_sha=new.commit_sha
 ) then raise exception 'Original peer not owner-pinned';end if;
 return new;
end $$;
create trigger peer_challenge277_guard before insert or update or delete
 on icamp_private.peer_challenge277 for each row execute function icamp_private.guard_peer_challenge277();

create table icamp_private.peer_challenge_response277 (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null unique references icamp_private.peer_challenge277(id) on delete restrict,
 source_id text not null,
 nonce text not null check(nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 signed_body text not null check(char_length(signed_body) between 80 and 2400),
 signature_b64url text not null check(signature_b64url ~ '^[A-Za-z0-9_-]{86}$'),
 body_sha256 text not null check(body_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null,
 accepted_at timestamptz not null default statement_timestamp(),
 unique (source_id,nonce)
);
create function icamp_private.guard_peer_challenge_response277()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Field challenge receipts are immutable';end if;
 if encode(public.digest(new.signed_body,'sha256'),'hex')<>new.body_sha256
    or new.observed_at<statement_timestamp()-interval '2 minutes'
    or new.observed_at>statement_timestamp()+interval '30 seconds'
    or not exists(
    select 1 from icamp_private.peer_challenge277 c
    where c.id=new.challenge_id and c.source_id=new.source_id
     and c.expires_at>=statement_timestamp()
     and c.issued_at<=new.observed_at
     and c.request_nonce<>new.nonce
    )
 then raise exception 'Original server challenge expired, mismatched, invalid or replayed';end if;
 return new;
end $$;
create trigger peer_challenge_response277_guard before insert or update or delete
 on icamp_private.peer_challenge_response277 for each row
 execute function icamp_private.guard_peer_challenge_response277();

create table icamp_private.external_restore_review277 (
 id uuid primary key default gen_random_uuid(),
 closure_review_id uuid not null unique references icamp_private.restore_closure_review276(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 external_evidence_sha256 text not null check(external_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 source_host_sha256 text not null check(source_host_sha256 ~ '^[a-f0-9]{64}$'),
 isolated_host_sha256 text not null check(isolated_host_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp(),
 check(source_host_sha256<>isolated_host_sha256)
);
create function icamp_private.guard_external_restore_review277()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'External restore reviews are immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
 ) or not exists(
  select 1 from icamp_private.restore_closure_review276 c
  join icamp_private.restore_provider_attestation273 p on p.id=c.provider_attestation_id
  join icamp_private.restore_dryrun_review272 d on d.id=p.restore_review_id
  where c.id=new.closure_review_id and c.reviewed_by<>actor
   and d.reviewer_user_id<>actor
   and p.source_host_sha256=new.source_host_sha256
   and p.isolated_host_sha256=new.isolated_host_sha256
   and p.recorded_at>=statement_timestamp()-interval '7 days'
 ) then raise exception 'Real original/isolated host fingerprints and distinct operator required';end if;
 return new;
end $$;
create trigger external_restore_review277_guard before insert or update or delete
 on icamp_private.external_restore_review277 for each row
 execute function icamp_private.guard_external_restore_review277();

do $$
declare tab text;
begin
 foreach tab in array array[
  'owner_peer_pin277','peer_challenge277','peer_challenge_response277',
  'external_restore_review277'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',
    tab||'_deny_direct',tab);
 end loop;
end $$;
