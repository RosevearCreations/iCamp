-- Build 276: immutable, independently reviewed original peer signer and restore receipts.
-- A reviewer receipt is not a credential, new user grant, live backup restore or source certification.

create table icamp_private.peer_signer_proposal276 (
 id uuid primary key default gen_random_uuid(),
 source_id text not null check (source_id in (
   'ai-data-platform','rosevear-comms-hub','rosevear-ai-hub',
   'yard-workers','rosie-dazzlers','devil-n-dove','icamp'
 )),
 key_id text not null check (key_id ~ '^[a-z0-9_-]{8,80}$'),
 commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40}$'),
 public_key_pem text not null check (char_length(public_key_pem) between 80 and 1200),
 key_fingerprint_sha256 text not null check (key_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
 evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
 proposed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 proposed_at timestamptz not null default statement_timestamp(),
 unique (source_id,key_id,commit_sha)
);
create function icamp_private.guard_peer_signer_proposal276()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Signer proposals are immutable'; end if;
 if actor is null or actor <> new.proposed_by or not exists (
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
     and b.verified_by is not null and b.verified_by<>b.user_id
 ) or new.public_key_pem not like '-----BEGIN PUBLIC KEY-----%END PUBLIC KEY-----%'
   or new.public_key_pem like '%PRIVATE KEY%'
 then raise exception 'Original verified operator and public key required'; end if;
 return new;
end $$;
create trigger peer_signer_proposal276_guard before insert or update or delete
 on icamp_private.peer_signer_proposal276 for each row
 execute function icamp_private.guard_peer_signer_proposal276();

create table icamp_private.peer_signer_review276 (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique references icamp_private.peer_signer_proposal276(id) on delete restrict,
 reviewed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 review_evidence_sha256 text not null check (review_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_peer_signer_review276()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Signer reviews are immutable'; end if;
 if actor is null or actor <> new.reviewed_by or not exists (
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
     and b.verified_by is not null and b.verified_by<>b.user_id
 ) or not exists (
   select 1 from icamp_private.peer_signer_proposal276 p
   where p.id=new.proposal_id and p.proposed_by<>actor
     and p.proposed_at >= statement_timestamp()-interval '7 days'
 ) then raise exception 'Independent second-person original source review required'; end if;
 return new;
end $$;
create trigger peer_signer_review276_guard before insert or update or delete
 on icamp_private.peer_signer_review276 for each row
 execute function icamp_private.guard_peer_signer_review276();

create table icamp_private.restore_closure_review276 (
 id uuid primary key default gen_random_uuid(),
 provider_attestation_id uuid not null unique
   references icamp_private.restore_provider_attestation273(id) on delete restrict,
 reviewed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 independent_evidence_sha256 text not null check (independent_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_restore_closure_review276()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Original restore review immutable'; end if;
 if actor is null or actor<>new.reviewed_by or not exists (
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
     and b.verified_by is not null and b.verified_by<>b.user_id
 ) or not exists (
   select 1 from icamp_private.restore_provider_attestation273 p
   join icamp_private.restore_dryrun_review272 d on d.id=p.restore_review_id
   join icamp_private.pilot_restore_witness269 w
    on w.original_backup_digest_sha256=d.backup_sha256
      and w.witness_kind='independent_review'
   where p.id=new.provider_attestation_id
     and d.reviewer_user_id<>actor and w.actor_user_id<>actor
     and p.source_host_sha256<>p.isolated_host_sha256
     and p.recorded_at>=statement_timestamp()-interval '7 days'
 ) then raise exception 'Original distinct reviewer, provider and isolated four-scope evidence required'; end if;
 return new;
end $$;
create trigger restore_closure_review276_guard before insert or update or delete
 on icamp_private.restore_closure_review276 for each row
 execute function icamp_private.guard_restore_closure_review276();

do $$
declare tab text;
begin
 foreach tab in array array[
  'peer_signer_proposal276','peer_signer_review276','restore_closure_review276'
 ] loop
  execute format('alter table icamp_private.%I enable row level security', tab);
  execute format('alter table icamp_private.%I force row level security', tab);
  execute format('revoke all on icamp_private.%I from public', tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',tab||'_deny_direct',tab);
 end loop;
end $$;
