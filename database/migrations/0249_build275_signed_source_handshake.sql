-- Build 275 original signed peer receipts; no owner, tenant or payment mutations.
create table icamp_private.signed_source_handshake275 (
 id uuid primary key default gen_random_uuid(),
 source_id text not null check (source_id in (
  'ai-data-platform','rosevear-comms-hub','rosevear-ai-hub',
  'yard-workers','rosie-dazzlers','devil-n-dove','icamp'
 )),
 key_id text not null check (key_id ~ '^[a-z0-9_-]{8,80}$'),
 commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40}$'),
 challenge_id text not null check (challenge_id ~ '^[A-Za-z0-9_-]{16,96}$'),
 nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 observed_at timestamptz not null,
 signed_body text not null check (char_length(signed_body) between 80 and 2400),
 signature_b64url text not null check (signature_b64url ~ '^[A-Za-z0-9_-]{86}$'),
 body_sha256 text not null check (body_sha256 ~ '^[a-f0-9]{64}$'),
 received_at timestamptz not null default statement_timestamp(),
 unique (source_id,nonce),
 unique (source_id,challenge_id)
);
create index source_handshake275_recent
 on icamp_private.signed_source_handshake275(source_id,observed_at desc);
create function icamp_private.guard_signed_source_handshake275()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op <> 'INSERT' then raise exception 'Signed source receipt immutable'; end if;
 if new.observed_at < statement_timestamp()-interval '2 minutes'
   or new.observed_at > statement_timestamp()+interval '30 seconds'
   or encode(public.digest(new.signed_body,'sha256'),'hex') <> new.body_sha256
 then raise exception 'Receipt freshness or digest mismatch'; end if;
 return new;
end $$;
create trigger signed_source_handshake275_guard
 before insert or update or delete on icamp_private.signed_source_handshake275
 for each row execute function icamp_private.guard_signed_source_handshake275();
alter table icamp_private.signed_source_handshake275 enable row level security;
alter table icamp_private.signed_source_handshake275 force row level security;
revoke all on icamp_private.signed_source_handshake275 from public;
create policy signed_source_handshake275_deny_direct
 on icamp_private.signed_source_handshake275 for all to icamp_app
 using(false) with check(false);
