-- iCamp Build 273 — original source and consumer custody; no payment/role mutations.
create table icamp_private.source_enrollment_review273 (
 id uuid primary key default gen_random_uuid(),
 source_pair_id uuid not null unique references icamp_private.source_pair_proofs271(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 approval_sha256 text not null check(approval_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_source_enrollment273()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Original source enrollment review immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  where g.user_id=actor and g.grant_state='active'
   and b.binding_state='verified' and b.verified_by<>b.user_id
 ) or not exists(
  select 1 from icamp_private.source_pair_proofs271 p
   join public.campgrounds c on c.id=p.campground_id
  where p.id=new.source_pair_id and c.lifecycle_state='active'
    and lower(c.name)='camp rosevear'
    and p.received_at>statement_timestamp()-interval '24 hours'
 ) then raise exception 'Independent original source enrollment review required';end if;
 return new;
end $$;
create trigger source_enrollment273_guard before insert or update or delete
 on icamp_private.source_enrollment_review273 for each row
 execute function icamp_private.guard_source_enrollment273();

create table icamp_private.consumer_ack273 (
 id uuid primary key default gen_random_uuid(),
 campground_id uuid not null references public.campgrounds(id) on delete restrict,
 source_pair_id uuid not null references icamp_private.source_pair_proofs271(id) on delete restrict,
 event_kind text not null check(event_kind in ('booking','comms')),
 subject_id uuid not null,
 source_id text not null check(source_id ~ '^[a-z0-9_-]{8,64}$'),
 provider_event_id text not null check(char_length(trim(provider_event_id)) between 16 and 160),
 nonce text not null check(nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null,
 received_at timestamptz not null default statement_timestamp(),
 unique(source_id,provider_event_id),
 unique(source_id,nonce),
 unique(event_kind,subject_id)
);
create index consumer_ack273_scope on icamp_private.consumer_ack273
 (campground_id,event_kind,received_at desc);
create function icamp_private.guard_consumer_ack273()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Original signed consumer receipts immutable';end if;
 if new.observed_at<statement_timestamp()-interval '2 minutes'
    or new.observed_at>statement_timestamp()+interval '1 minute'
    or not exists(
     select 1 from icamp_private.source_pair_proofs271 p
      join icamp_private.source_enrollment_review273 r on r.source_pair_id=p.id
      join public.campgrounds c on c.id=p.campground_id
      where p.id=new.source_pair_id and p.campground_id=new.campground_id
       and p.source_id=new.source_id and c.lifecycle_state='active'
       and p.received_at>statement_timestamp()-interval '24 hours'
       and p.source_kind=case new.event_kind
         when 'booking' then 'payments' else 'comms' end
    )
 then raise exception 'Original enrolled signed source and fresh receipt required';end if;
 if new.event_kind='booking' and not exists(
  select 1 from icamp_private.provider_booking_acceptance272 b
   where b.recovery_id=new.subject_id and b.campground_id=new.campground_id
 ) then raise exception 'Original same-tenant provider and guest chain required';end if;
 if new.event_kind='comms' and not exists(
  select 1 from icamp_private.comms_incident_review272 i
   join icamp_private.support_sla_outbox268 o on o.id=i.outbox_id
   join icamp_private.campground_support265 c on c.id=o.case_id
   where i.outbox_id=new.subject_id and c.campground_id=new.campground_id
 ) then raise exception 'Original same-campground Comms provider delivery required';end if;
 return new;
end $$;
create trigger consumer_ack273_guard before insert or update or delete
 on icamp_private.consumer_ack273 for each row
 execute function icamp_private.guard_consumer_ack273();

create table icamp_private.incident_ack_closure273 (
 id uuid primary key default gen_random_uuid(),
 outbox_id uuid not null unique references icamp_private.support_sla_outbox268(id) on delete restrict,
 consumer_ack_id uuid not null unique references icamp_private.consumer_ack273(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 external_case_digest_sha256 text not null check(external_case_digest_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_incident_ack_closure273()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Cross-master case closure evidence immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
   join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
   where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
     and b.verified_by<>b.user_id
 ) or not exists(
  select 1 from icamp_private.consumer_ack273 a
  join icamp_private.support_sla_outbox268 o on o.id=a.subject_id
  join icamp_private.campground_support265 c on c.id=o.case_id
  join icamp_private.comms_incident_review272 i on i.outbox_id=o.id
   where a.id=new.consumer_ack_id and a.event_kind='comms'
     and o.id=new.outbox_id and c.status='resolved'
     and o.assigned_user_id<>actor and i.reviewer_user_id<>actor
 ) then raise exception 'Genuine resolved original case, independent ACK and distinct operators required';end if;
 return new;
end $$;
create trigger incident_ack_closure273_guard before insert or update or delete
 on icamp_private.incident_ack_closure273 for each row
 execute function icamp_private.guard_incident_ack_closure273();

create table icamp_private.restore_provider_attestation273 (
 id uuid primary key default gen_random_uuid(),
 restore_review_id uuid not null unique references icamp_private.restore_dryrun_review272(id) on delete restrict,
 provider_id text not null check(provider_id ~ '^[a-z0-9_-]{8,64}$'),
 provider_event_id text not null check(char_length(trim(provider_event_id)) between 16 and 160),
 nonce text not null check(nonce ~ '^[A-Za-z0-9_-]{16,96}$'),
 attestation_sha256 text not null check(attestation_sha256 ~ '^[a-f0-9]{64}$'),
 source_host_sha256 text not null check(source_host_sha256 ~ '^[a-f0-9]{64}$'),
 isolated_host_sha256 text not null check(isolated_host_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null,
 recorded_at timestamptz not null default statement_timestamp(),
 unique(provider_id,provider_event_id),
 unique(provider_id,nonce),
 check(source_host_sha256<>isolated_host_sha256)
);
create function icamp_private.guard_restore_provider_attestation273()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Original provider host attestation immutable';end if;
 if new.observed_at<statement_timestamp()-interval '5 minutes'
   or new.observed_at>statement_timestamp()+interval '1 minute'
   or not exists(
    select 1 from icamp_private.restore_dryrun_review272 d
     join icamp_private.pilot_restore_witness269 w
      on w.original_backup_digest_sha256=d.backup_sha256
      and w.witness_kind='independent_review'
    where d.id=new.restore_review_id and w.actor_user_id<>d.reviewer_user_id
   )
 then raise exception 'Original independent isolated restore review required';end if;
 return new;
end $$;
create trigger restore_provider_attestation273_guard before insert or update or delete
 on icamp_private.restore_provider_attestation273 for each row
 execute function icamp_private.guard_restore_provider_attestation273();

do $$
declare tab text;
begin
 foreach tab in array array[
  'source_enrollment_review273','consumer_ack273',
  'incident_ack_closure273','restore_provider_attestation273'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',tab||'_deny_direct',tab);
 end loop;
end $$;
