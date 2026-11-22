-- Build 272: verified original fields require independently cross-linked source evidence.
-- No staff login bootstrap, payment, booking, message send, or backup restore is performed.
create table icamp_private.owner_login_witness272 (
 id uuid primary key default gen_random_uuid(),
 subject_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 session_id uuid not null references icamp_private.auth_sessions(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null default statement_timestamp(),
 unique(subject_user_id,session_id)
);
create function icamp_private.guard_owner_login_witness272()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Owner login witness immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or actor=new.subject_user_id
   or not exists(
    select 1 from icamp_private.platform_operator_grants g
    join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
    join icamp_private.user_accounts a on a.id=g.user_id
     where g.user_id=actor and g.grant_state='active'
      and b.binding_state='verified' and b.verified_by<>b.user_id
      and a.account_state='active' and a.account_type='staff'
   ) or not exists(
    select 1 from icamp_private.auth_sessions s
    join icamp_private.user_accounts a on a.id=s.user_id
    join icamp_private.password_credentials p on p.user_id=a.id
    join icamp_private.platform_operator_grants g on g.user_id=a.id
    join icamp_private.platform_master_owner_bindings b on b.user_id=a.id
    where s.id=new.session_id and s.user_id=new.subject_user_id
      and a.username_normalized='rosevear' and a.account_type='staff'
      and a.account_state='active' and a.mfa_required
      and a.email_verified_at is not null
      and a.email_normalized not like '%%.invalid'
      and g.grant_state='active' and b.binding_state='verified'
      and b.verified_by is not null and b.verified_by<>b.user_id
      and s.assurance_level='aal2' and s.revoked_at is null
      and s.expires_at>statement_timestamp()
      and exists(select 1 from icamp_private.mfa_factors f
        where f.user_id=a.id and f.factor_state='verified')
   )
 then raise exception 'Independent platform reviewer and actual active original MFA session required';end if;
 return new;
end $$;
create trigger owner_login_witness272_guard before insert or update or delete
 on icamp_private.owner_login_witness272 for each row
 execute function icamp_private.guard_owner_login_witness272();

create table icamp_private.provider_booking_acceptance272 (
 id uuid primary key default gen_random_uuid(),
 recovery_id uuid not null unique references icamp_private.booking_recovery268(id) on delete restrict,
 campground_id uuid not null references public.campgrounds(id) on delete restrict,
 trace_id uuid not null references icamp_private.provider_trace270(id) on delete restrict,
 processor_witness_id uuid not null references icamp_private.pilot_booking_witness269(id) on delete restrict,
 site_witness_id uuid not null references icamp_private.pilot_booking_witness269(id) on delete restrict,
 delivery_witness_id uuid not null references icamp_private.pilot_booking_witness269(id) on delete restrict,
 guest_witness_id uuid not null references icamp_private.pilot_booking_witness269(id) on delete restrict,
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default statement_timestamp()
);
create index provider_booking_acceptance272_scope on
 icamp_private.provider_booking_acceptance272(campground_id,reviewed_at desc);
create function icamp_private.guard_provider_booking272()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Provider booking acceptance immutable';end if;
 if actor is null or actor<>new.reviewer_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'campground.operations.manage')
   or not exists(
    select 1 from icamp_private.booking_recovery268 r
    join icamp_private.provider_trace270 t
      on t.recovery_id=r.id and t.campground_id=r.campground_id
    where r.id=new.recovery_id and r.campground_id=new.campground_id
      and r.local_owner_user_id<>actor
      and t.id=new.trace_id and t.result='provider_match'
      and t.actor_user_id<>actor
   ) or not exists(
    select 1 from icamp_private.pilot_booking_witness269 p
    join icamp_private.pilot_booking_witness269 s on
      s.recovery_id=p.recovery_id and s.campground_id=p.campground_id
    join icamp_private.pilot_booking_witness269 d on
      d.recovery_id=p.recovery_id and d.campground_id=p.campground_id
    join icamp_private.pilot_booking_witness269 g on
      g.recovery_id=p.recovery_id and g.campground_id=p.campground_id
    where p.id=new.processor_witness_id and p.stage='processor_settlement'
      and s.id=new.site_witness_id and s.stage='site_allocation'
      and d.id=new.delivery_witness_id and d.stage='confirmation_delivery'
      and g.id=new.guest_witness_id and g.stage='guest_ack'
      and p.recovery_id=new.recovery_id and p.campground_id=new.campground_id
   ) or not exists(
    select 1 from icamp_private.source_pair_proofs271 sp
     where sp.campground_id=new.campground_id and sp.source_kind='payments'
      and sp.received_at>statement_timestamp()-interval '24 hours'
   )
 then raise exception 'Original tenant, distinct reviewer, provider pair and all source witnesses required';end if;
 return new;
end $$;
create trigger provider_booking_acceptance272_guard before insert or update or delete
 on icamp_private.provider_booking_acceptance272 for each row
 execute function icamp_private.guard_provider_booking272();

create table icamp_private.comms_incident_review272 (
 id uuid primary key default gen_random_uuid(),
 outbox_id uuid not null unique references icamp_private.support_sla_outbox268(id) on delete restrict,
 attempt_id uuid not null references icamp_private.support_delivery_attempts270(id) on delete restrict,
 delivered_receipt_id uuid not null references icamp_private.support_delivery_receipts269(id) on delete restrict,
 source_pair_id uuid not null references icamp_private.source_pair_proofs271(id) on delete restrict,
 master_kind text not null check(master_kind in ('rosevear-comms-hub','ai-data-platform')),
 external_ack_sha256 text not null check(external_ack_sha256 ~ '^[a-f0-9]{64}$'),
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 reviewed_at timestamptz not null default statement_timestamp()
);
create index comms_incident_review272_recent on
 icamp_private.comms_incident_review272(reviewed_at desc);
create function icamp_private.guard_comms_incident_review272()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Cross-master incident review immutable';end if;
 if actor is null or actor<>new.reviewer_user_id
  or not exists(
   select 1 from icamp_private.platform_operator_grants a
   join icamp_private.platform_master_owner_bindings b on b.user_id=a.user_id
   where a.user_id=actor and a.grant_state='active' and b.binding_state='verified'
     and b.verified_by<>b.user_id
  ) or not exists(
   select 1 from icamp_private.support_delivery_attempts270 a
   join icamp_private.support_delivery_receipts269 d on d.outbox_id=a.outbox_id
   join icamp_private.support_sla_outbox268 o on o.id=a.outbox_id
   join icamp_private.campground_support265 c on c.id=o.case_id
   join icamp_private.source_pair_proofs271 s on s.source_kind='comms'
     and s.campground_id=c.campground_id and s.source_id=a.source_id
     and s.received_at>statement_timestamp()-interval '24 hours'
   where a.id=new.attempt_id and a.outbox_id=new.outbox_id
    and a.attempt_status='accepted' and d.id=new.delivered_receipt_id
    and d.event_kind='delivered' and s.id=new.source_pair_id
    and o.assigned_user_id<>actor and o.delivery_state in ('attempted','acknowledged')
  )
 then raise exception 'Original signed Comms delivery, durable attempt and distinct platform reviewer required';end if;
 return new;
end $$;
create trigger comms_incident_review272_guard before insert or update or delete
 on icamp_private.comms_incident_review272 for each row
 execute function icamp_private.guard_comms_incident_review272();

create table icamp_private.restore_dryrun_review272 (
 id uuid primary key default gen_random_uuid(),
 backup_sha256 text not null unique check(backup_sha256 ~ '^[a-f0-9]{64}$'),
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.guard_restore_dryrun272()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
declare kind text;
declare matching integer:=0;
begin
 if tg_op<>'INSERT' then raise exception 'Dry-run review immutable';end if;
 if actor is null or actor<>new.reviewer_user_id or not exists(
    select 1 from icamp_private.platform_operator_grants g
    join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
    where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
      and b.verified_by<>b.user_id
 ) or not exists(
   select 1 from icamp_private.pilot_restore_witness269 w
    where w.original_backup_digest_sha256=new.backup_sha256
     and w.witness_kind='independent_review' and w.actor_user_id<>actor
 ) then raise exception 'Independent original backup witness required';end if;
 foreach kind in array array[
  'tenant_isolation','reservation_integrity','payment_ledger','service_health'
 ] loop
  if exists(
    select 1 from icamp_private.restore_replay271 o
    join icamp_private.restore_replay271 i on
      i.original_backup_sha256=o.original_backup_sha256
      and i.evidence_kind=o.evidence_kind
      and i.source_fingerprint_sha256=o.source_fingerprint_sha256
    join icamp_private.restore_replay271 p on
      p.original_backup_sha256=o.original_backup_sha256
      and p.evidence_kind=o.evidence_kind
      and p.source_fingerprint_sha256=o.source_fingerprint_sha256
    where o.original_backup_sha256=new.backup_sha256
      and o.evidence_kind=kind and o.snapshot_kind='original'
      and i.snapshot_kind='isolated' and p.snapshot_kind='production_readback'
      and o.actor_user_id<>i.actor_user_id
      and i.actor_user_id<>p.actor_user_id
  ) then matching:=matching+1;end if;
 end loop;
 if matching<>4 then raise exception 'All four separate original, isolated and readback fingerprints required';end if;
 return new;
end $$;
create trigger restore_dryrun_review272_guard before insert or update or delete
 on icamp_private.restore_dryrun_review272 for each row
 execute function icamp_private.guard_restore_dryrun272();
do $$
declare tab text;
begin
 foreach tab in array array[
 'owner_login_witness272','provider_booking_acceptance272',
 'comms_incident_review272','restore_dryrun_review272'
 ] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',tab||'_deny_direct',tab);
 end loop;
end $$;
