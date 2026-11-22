-- iCamp Build 271 — original-host owner, source, guest closure and restore replay custody.
-- Append-only proofs never create passwords, grant permissions, initiate payments or restore data.
create table icamp_private.owner_ceremony271 (
 id uuid primary key default gen_random_uuid(),
 subject_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 event_kind text not null check(event_kind in
 ('contact_verified','credential_present','mfa_verified','platform_binding_verified')),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default statement_timestamp(),
 unique(subject_user_id,reviewer_user_id,event_kind,evidence_sha256)
);
create index owner_ceremony271_subject on
 icamp_private.owner_ceremony271(subject_user_id,recorded_at desc);
create function icamp_private.guard_owner_ceremony271()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Owner ceremony receipts are immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or actor=new.subject_user_id
   or not exists(
    select 1 from icamp_private.platform_operator_grants g
    join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
    join icamp_private.user_accounts a on a.id=g.user_id
    where g.user_id=actor and g.grant_state='active'
      and b.binding_state='verified' and a.account_state='active'
      and a.account_type='staff')
   or not exists(select 1 from icamp_private.user_accounts a
    where a.id=new.subject_user_id and a.username_normalized='rosevear'
    and a.account_type='staff')
 then raise exception 'Distinct verified platform owner required';end if;
 if new.event_kind='contact_verified' and not exists(
   select 1 from icamp_private.user_accounts a
    where a.id=new.subject_user_id and a.email_verified_at is not null
      and a.email_normalized not like '%%.invalid'
 ) then raise exception 'Source email is not independently verified';end if;
 if new.event_kind='credential_present' and not exists(
   select 1 from icamp_private.password_credentials p
    where p.user_id=new.subject_user_id
 ) then raise exception 'Original secure password verifier absent';end if;
 if new.event_kind='mfa_verified' and not exists(
   select 1 from icamp_private.mfa_factors f
    where f.user_id=new.subject_user_id and f.factor_state='verified'
 ) then raise exception 'Original MFA not verified';end if;
 if new.event_kind='platform_binding_verified' and not exists(
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
    where g.user_id=new.subject_user_id and g.grant_state='active'
     and b.binding_state='verified' and b.verified_by is not null
     and b.verified_by<>b.user_id
 ) then raise exception 'Original owner grant not independently approved';end if;
 return new;
end $$;
create trigger owner_ceremony271_guard before insert or update or delete
 on icamp_private.owner_ceremony271 for each row
 execute function icamp_private.guard_owner_ceremony271();

create table icamp_private.source_pair_proofs271 (
 id uuid primary key default gen_random_uuid(),
 campground_id uuid not null references public.campgrounds(id) on delete restrict,
 source_kind text not null check(source_kind in ('traffic','comms','payments')),
 source_id text not null check(source_id ~ '^[a-z0-9_-]{8,64}$'),
 nonce text not null check(nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 challenge_sha256 text not null check(challenge_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null,
 received_at timestamptz not null default statement_timestamp(),
 unique(campground_id,source_kind,source_id,nonce)
);
create index source_pair271_recent on
 icamp_private.source_pair_proofs271(campground_id,source_kind,received_at desc);
create function icamp_private.guard_source_pair271()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Source pairing receipts immutable';end if;
 if not exists(select 1 from public.campgrounds c
  where c.id=new.campground_id and lower(c.name)='camp rosevear'
   and c.lifecycle_state='active')
  or new.observed_at<statement_timestamp()-interval '2 minutes'
  or new.observed_at>statement_timestamp()+interval '1 minute'
 then raise exception 'Original active Camp Rosevear and fresh proof required';end if;
 if new.source_kind='traffic' and not exists(
   select 1 from icamp_private.telemetry_enrollment267 e
   where e.campground_id=new.campground_id and e.source_id=new.source_id
    and e.state='active'
 ) then raise exception 'Original tenant consent required';end if;
 return new;
end $$;
create trigger source_pair271_guard before insert or update or delete
 on icamp_private.source_pair_proofs271 for each row
 execute function icamp_private.guard_source_pair271();

create table icamp_private.certified_booking_closure271 (
 id uuid primary key default gen_random_uuid(),
 recovery_id uuid not null unique references icamp_private.booking_recovery268(id) on delete restrict,
 campground_id uuid not null references public.campgrounds(id) on delete restrict,
 requested_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 verified_at timestamptz not null default statement_timestamp()
);
create index certified_booking_closure271_scope on
 icamp_private.certified_booking_closure271(campground_id,verified_at desc);
create function icamp_private.guard_certified_booking_closure271()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Guest closure certification immutable';end if;
 if actor is null or actor<>new.reviewed_by_user_id
    or new.reviewed_by_user_id=new.requested_by_user_id
    or not icamp_private.has_campground_permission(new.campground_id,'campground.operations.manage')
    or not exists(select 1 from icamp_private.booking_recovery268 r
      where r.id=new.recovery_id and r.campground_id=new.campground_id
       and r.local_owner_user_id=new.requested_by_user_id
       and r.state<>'closed')
 then raise exception 'Two distinct original tenant operators required';end if;
 if not exists(
  select 1 from icamp_private.provider_trace270 t
   where t.recovery_id=new.recovery_id and t.campground_id=new.campground_id
    and t.result='provider_match'
 ) or not exists(
  select 1 from icamp_private.pilot_booking_witness269 w
   where w.recovery_id=new.recovery_id and w.campground_id=new.campground_id
    and w.stage='site_allocation'
 ) or not exists(
  select 1 from icamp_private.pilot_booking_witness269 w
   where w.recovery_id=new.recovery_id and w.campground_id=new.campground_id
    and w.stage='confirmation_delivery'
 ) or not exists(
  select 1 from icamp_private.pilot_booking_witness269 w
   where w.recovery_id=new.recovery_id and w.campground_id=new.campground_id
    and w.stage='guest_ack'
 ) then raise exception 'Source-checked payment, site, confirmation and guest outcome required';end if;
 return new;
end $$;
create trigger certified_booking_closure271_guard before insert or update or delete
 on icamp_private.certified_booking_closure271 for each row
 execute function icamp_private.guard_certified_booking_closure271();

-- Fail closed on new transition to closed; previously closed legacy rows remain unchanged.
create function icamp_private.require_certified_closure271()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.state='closed' and old.state<>'closed' then
  if new.outcome<>'confirmed' or not exists(
   select 1 from icamp_private.certified_booking_closure271 c
   where c.recovery_id=new.id and c.campground_id=new.campground_id
  ) then raise exception 'Independent guest recovery certification required before case closure';end if;
 end if;
 return new;
end $$;
create trigger certified_booking_close271_guard before update
 on icamp_private.booking_recovery268 for each row
 execute function icamp_private.require_certified_closure271();

create table icamp_private.restore_replay271 (
 id uuid primary key default gen_random_uuid(),
 original_backup_sha256 text not null check(original_backup_sha256 ~ '^[a-f0-9]{64}$'),
 snapshot_kind text not null check(snapshot_kind in ('original','isolated','production_readback')),
 evidence_kind text not null check(evidence_kind in
  ('tenant_isolation','reservation_integrity','payment_ledger','service_health')),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 source_fingerprint_sha256 text not null check(source_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null default statement_timestamp(),
 unique(original_backup_sha256,snapshot_kind,evidence_kind,actor_user_id)
);
create index restore_replay271_digest on
 icamp_private.restore_replay271(original_backup_sha256,snapshot_kind,observed_at);
create function icamp_private.guard_restore_replay271()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Restore replay receipts immutable';end if;
 if actor is null or actor<>new.actor_user_id or not exists(
   select 1 from icamp_private.platform_operator_grants g
    join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
    where g.user_id=actor and g.grant_state='active'
      and b.binding_state='verified' and b.verified_by<>b.user_id
 ) or not exists(
   select 1 from icamp_private.pilot_restore_witness269 w
   where w.original_backup_digest_sha256=new.original_backup_sha256
     and w.witness_kind='independent_review'
 ) then raise exception 'Independent original verified restore witness required';end if;
 return new;
end $$;
create trigger restore_replay271_guard before insert or update or delete
 on icamp_private.restore_replay271 for each row
 execute function icamp_private.guard_restore_replay271();

do $$
declare t text;
begin
 foreach t in array array[
 'owner_ceremony271','source_pair_proofs271',
 'certified_booking_closure271','restore_replay271'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',t);
  execute format('alter table icamp_private.%I force row level security',t);
  execute format('revoke all on icamp_private.%I from public',t);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',t||'_deny_direct',t);
 end loop;
end $$;
