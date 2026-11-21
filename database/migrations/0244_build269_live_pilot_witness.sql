-- iCamp 269: append-only, consent-scoped performance and independently witnessed records.
-- Witness assertions do not create payments, refunds, reservations, messages or restores.
create table icamp_private.traffic_stage269 (
  id uuid primary key default gen_random_uuid(),
  campground_id uuid not null references public.campgrounds(id) on delete restrict,
  source_id text not null check(source_id ~ '^[a-z0-9_-]{8,64}$'),
  nonce text not null check(nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
  stage text not null check(stage in ('guest_search','guest_checkout','staff_action','health_probe')),
  observed_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  requests integer not null check(requests between 0 and 10000000),
  errors integer not null check(errors between 0 and requests),
  latency_p95_ms integer not null check(latency_p95_ms between 0 and 600000),
  unique(campground_id,source_id,nonce)
);
create index traffic_stage269_recent_idx
 on icamp_private.traffic_stage269(campground_id,received_at desc);
create function icamp_private.guard_traffic_stage269()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Traffic evidence is immutable'; end if;
 if not exists(
  select 1 from icamp_private.telemetry_enrollment267 e
   join public.campgrounds c on c.id=e.campground_id
   where e.campground_id=new.campground_id and e.source_id=new.source_id
    and e.state='active' and c.lifecycle_state='active'
 ) or new.observed_at<statement_timestamp()-interval '5 minutes'
   or new.observed_at>statement_timestamp()+interval '1 minute'
 then raise exception 'No original active and fresh enrolled traffic source'; end if;
 return new;
end $$;
create trigger traffic_stage269_guard before insert or update or delete
 on icamp_private.traffic_stage269 for each row
 execute function icamp_private.guard_traffic_stage269();

create table icamp_private.support_delivery_receipts269 (
 id uuid primary key default gen_random_uuid(),
 outbox_id uuid not null references icamp_private.support_sla_outbox268(id) on delete restrict,
 source_id text not null check(source_id ~ '^[a-z0-9_-]{8,64}$'),
 provider_event_id text not null check(char_length(trim(provider_event_id)) between 12 and 160),
 event_kind text not null check(event_kind in ('delivered','failed')),
 nonce text not null check(nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 observed_at timestamptz not null,
 received_at timestamptz not null default statement_timestamp(),
 unique(source_id,provider_event_id),
 unique(source_id,nonce)
);
create index support_delivery269_scope on
 icamp_private.support_delivery_receipts269(outbox_id,received_at desc);
create function icamp_private.guard_support_delivery269()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Provider delivery evidence is immutable'; end if;
 if not exists(select 1 from icamp_private.support_sla_outbox268 o
   where o.id=new.outbox_id and o.delivery_state='attempted' and o.attempted_at is not null)
  or new.observed_at<statement_timestamp()-interval '5 minutes'
  or new.observed_at>statement_timestamp()+interval '1 minute'
 then raise exception 'Invalid original notice or stale provider event'; end if;
 return new;
end $$;
create trigger support_delivery269_guard before insert or update or delete
 on icamp_private.support_delivery_receipts269 for each row
 execute function icamp_private.guard_support_delivery269();

create table icamp_private.pilot_booking_witness269 (
 id uuid primary key default gen_random_uuid(),
 recovery_id uuid not null references icamp_private.booking_recovery268(id) on delete restrict,
 campground_id uuid not null references public.campgrounds(id) on delete restrict,
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 stage text not null check(stage in
   ('processor_settlement','site_allocation','confirmation_delivery','guest_ack')),
 evidence_digest_sha256 text not null check(evidence_digest_sha256 ~ '^[a-f0-9]{64}$'),
 witnessed_at timestamptz not null default statement_timestamp(),
 unique(recovery_id,stage,evidence_digest_sha256)
);
create index pilot_booking_witness269_case on
 icamp_private.pilot_booking_witness269(recovery_id,witnessed_at);
create function icamp_private.guard_pilot_booking269()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Pilot case witness is immutable'; end if;
 if actor is null or actor<>new.actor_user_id
  or not icamp_private.has_campground_permission(new.campground_id,'campground.operations.manage')
  or not exists(select 1 from icamp_private.booking_recovery268 r
    where r.id=new.recovery_id and r.campground_id=new.campground_id)
 then raise exception 'Tenant operator and original recovery case required'; end if;
 return new;
end $$;
create trigger pilot_booking269_guard before insert or update or delete
 on icamp_private.pilot_booking_witness269 for each row
 execute function icamp_private.guard_pilot_booking269();

create table icamp_private.pilot_restore_witness269 (
 id uuid primary key default gen_random_uuid(),
 witness_kind text not null check(witness_kind in
   ('original_backup','isolated_restore','independent_review')),
 original_backup_digest_sha256 text not null check(original_backup_digest_sha256 ~ '^[a-f0-9]{64}$'),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 evidence_digest_sha256 text not null check(evidence_digest_sha256 ~ '^[a-f0-9]{64}$'),
 witnessed_at timestamptz not null default statement_timestamp(),
 unique(witness_kind,original_backup_digest_sha256,actor_user_id)
);
create index pilot_restore269_check on
 icamp_private.pilot_restore_witness269(original_backup_digest_sha256,witnessed_at);
create function icamp_private.guard_restore_witness269()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Restore witness receipts immutable'; end if;
 if actor is null or actor<>new.actor_user_id or not exists(
   select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   where g.user_id=actor and g.grant_state='active'
    and b.binding_state='verified' and b.owner_slot in ('ree','jack')
 ) then raise exception 'Verified platform owner witness required'; end if;
 if new.witness_kind='isolated_restore' and not exists(
    select 1 from icamp_private.pilot_restore_witness269 w
    where w.witness_kind='original_backup'
     and w.original_backup_digest_sha256=new.original_backup_digest_sha256
 ) then raise exception 'Original backup receipt required before restore'; end if;
 if new.witness_kind='independent_review' and not exists(
   select 1 from icamp_private.pilot_restore_witness269 w
    where w.witness_kind='isolated_restore'
     and w.original_backup_digest_sha256=new.original_backup_digest_sha256
     and w.actor_user_id<>new.actor_user_id
 ) then raise exception 'Distinct operator must attest same original isolated restore'; end if;
 return new;
end $$;
create trigger pilot_restore269_guard before insert or update or delete
 on icamp_private.pilot_restore_witness269 for each row
 execute function icamp_private.guard_restore_witness269();

do $$
declare t text;
begin
 foreach t in array array[
  'traffic_stage269','support_delivery_receipts269',
  'pilot_booking_witness269','pilot_restore_witness269'
 ] loop
   execute format('alter table icamp_private.%I enable row level security',t);
   execute format('alter table icamp_private.%I force row level security',t);
   execute format('revoke all on icamp_private.%I from public',t);
   execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',t||'_deny_direct',t);
 end loop;
end $$;
