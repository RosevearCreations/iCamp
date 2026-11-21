-- iCamp Build 270 — source-gated delivery and immutable financial/restore custody.
-- The original owner login remains protected: no implicit password or grant activation.
create table icamp_private.support_delivery_attempts270 (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references icamp_private.support_sla_outbox268(id) on delete restrict,
  source_id text not null check (source_id ~ '^[a-z0-9_-]{8,64}$'),
  idempotency_reference text not null check (char_length(trim(idempotency_reference)) between 12 and 180),
  attempt_status text not null default 'prepared'
    check (attempt_status in ('prepared','accepted','uncertain')),
  claimed_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  remote_receipt_reference text,
  row_version integer not null default 1 check(row_version>=1),
  unique(outbox_id),
  unique(source_id,idempotency_reference)
);
create index support_delivery_attempts270_status
  on icamp_private.support_delivery_attempts270(attempt_status,claimed_at);

create function icamp_private.guard_support_delivery_attempt270()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Outbound custody cannot be deleted'; end if;
 if tg_op='INSERT' then
   if new.attempt_status<>'prepared' or new.row_version<>1
   or new.remote_receipt_reference is not null or new.completed_at is not null
   or not exists (select 1 from icamp_private.support_sla_outbox268 s
     where s.id=new.outbox_id and s.delivery_state='queued')
   then raise exception 'Only a queued original notice may be prepared'; end if;
 else
   if new.id<>old.id or new.outbox_id<>old.outbox_id or
     new.source_id<>old.source_id or
     new.idempotency_reference<>old.idempotency_reference or
     old.attempt_status<>'prepared' or
     new.attempt_status not in ('accepted','uncertain') or
     new.completed_at is null or new.row_version<>old.row_version+1
   then raise exception 'Invalid original attempt custody transition'; end if;
   if new.attempt_status='accepted' and
     nullif(trim(new.remote_receipt_reference),'') is null
   then raise exception 'Comms accepted receipt reference required'; end if;
 end if;
 return new;
end $$;
create trigger guard_support_delivery_attempt270
 before insert or update or delete on icamp_private.support_delivery_attempts270
 for each row execute function icamp_private.guard_support_delivery_attempt270();

create table icamp_private.provider_trace270 (
 id uuid primary key default gen_random_uuid(),
 recovery_id uuid not null references icamp_private.booking_recovery268(id) on delete restrict,
 campground_id uuid not null references public.campgrounds(id) on delete restrict,
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 payment_id uuid not null references public.reservation_payments(id) on delete restrict,
 result text not null check(result in ('provider_match','provider_mismatch','provider_unavailable')),
 provider_response_sha256 text not null check(provider_response_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null default statement_timestamp(),
 unique(recovery_id,payment_id,provider_response_sha256)
);
create index provider_trace270_recovery on
 icamp_private.provider_trace270(campground_id,recovery_id,observed_at desc);
create function icamp_private.guard_provider_trace270()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Provider comparison is immutable'; end if;
 if actor is null or actor<>new.actor_user_id or
   not icamp_private.has_campground_permission(new.campground_id,'campground.operations.manage')
   or not exists(
     select 1 from icamp_private.booking_recovery268 r
     join public.reservation_payments p on
      p.reservation_id=r.reservation_id and p.campground_id=r.campground_id
      and p.organization_id=r.organization_id
     where r.id=new.recovery_id and r.campground_id=new.campground_id
       and p.id=new.payment_id)
 then raise exception 'Original campground, reservation and payment evidence must match'; end if;
 return new;
end $$;
create trigger guard_provider_trace270
 before insert or update or delete on icamp_private.provider_trace270
 for each row execute function icamp_private.guard_provider_trace270();

create table icamp_private.original_restore_evidence270 (
 id uuid primary key default gen_random_uuid(),
 backup_digest_sha256 text not null check(backup_digest_sha256 ~ '^[a-f0-9]{64}$'),
 evidence_digest_sha256 text not null check(evidence_digest_sha256 ~ '^[a-f0-9]{64}$'),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 validation_kind text not null check(validation_kind in
 ('source_consistency','tenant_boundary','reservation_integrity','service_recovery')),
 evidence_state text not null default 'recorded'
   check(evidence_state='recorded'),
 observed_at timestamptz not null default statement_timestamp(),
 unique(backup_digest_sha256,validation_kind,actor_user_id)
);
create index original_restore_evidence270_digest
 on icamp_private.original_restore_evidence270(backup_digest_sha256,observed_at);
create function icamp_private.guard_restore_evidence270()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Original restoration evidence immutable';end if;
 if actor is null or new.actor_user_id<>actor or not exists(
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   where g.user_id=actor and g.grant_state='active' and
   b.binding_state='verified' and b.owner_slot in ('ree','jack'))
 then raise exception 'Original verified platform reviewer required';end if;
 if not exists (
    select 1 from icamp_private.pilot_restore_witness269 w
    where w.original_backup_digest_sha256=new.backup_digest_sha256
      and w.witness_kind='independent_review')
 then raise exception 'Original distinct restore witness chain required';end if;
 return new;
end $$;
create trigger guard_restore_evidence270
 before insert or update or delete on icamp_private.original_restore_evidence270
 for each row execute function icamp_private.guard_restore_evidence270();

do $$
declare tab text;
begin
 foreach tab in array array[
  'support_delivery_attempts270','provider_trace270','original_restore_evidence270'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',tab||'_deny_direct',tab);
 end loop;
end $$;
