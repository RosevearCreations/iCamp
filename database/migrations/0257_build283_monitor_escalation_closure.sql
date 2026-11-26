-- Scheduled transport custody is not an operator signature or proof of delivery.
create table icamp_private.monitor_run283 (
 id uuid primary key default gen_random_uuid(),
 sampled_at timestamptz not null default statement_timestamp(),
 evidence_status text not null check(evidence_status in ('CURRENT','HOLD','READBACK_HOLD')),
 delivery_checked integer not null check(delivery_checked between 0 and 20),
 delivery_verified integer not null check(delivery_verified between 0 and delivery_checked)
);
create table icamp_private.escalation_attempt283 (
 id uuid primary key default gen_random_uuid(),
 incident_id uuid not null references icamp_private.recovery_incident282(id) on delete restrict,
 run_id uuid not null references icamp_private.monitor_run283(id) on delete restrict,
 claimed_at timestamptz not null default statement_timestamp(),
 unique(incident_id,run_id)
);
create index escalation_attempt283_incident_time on icamp_private.escalation_attempt283(incident_id,claimed_at);
create table icamp_private.escalation_outcome283 (
 attempt_id uuid primary key references icamp_private.escalation_attempt283(id) on delete restrict,
 status text not null check(status in ('SUBMITTED_DELIVERY_UNVERIFIED','SUBMISSION_HOLD')),
 recorded_at timestamptz not null default statement_timestamp()
);
create table icamp_private.recovery_closure283 (
 incident_id uuid primary key references icamp_private.recovery_incident282(id) on delete restrict,
 recovery_ack_id uuid not null references icamp_private.external_restore_final_ack281(id) on delete restrict,
 reviewed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 closed_at timestamptz not null default statement_timestamp()
);
create function icamp_private.immutable_monitor283()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Build 283 evidence immutable';
end $$;
create function icamp_private.guard_closure283()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if actor is null or actor<>new.reviewed_by or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
   and a.account_state='active' and a.account_type='staff'
 ) or not exists(
  select 1 from icamp_private.recovery_incident282 i
  join icamp_private.provider_alert_delivery282 d on d.incident_id=i.id
  join icamp_private.external_restore_final_ack281 old on old.id=i.ack_id
  join icamp_private.external_restore_final_ack281 fresh on fresh.id=new.recovery_ack_id
  join icamp_private.original_restore_monitor_sample281 m on m.external_ack_id=fresh.id
  join icamp_private.owner_mfa_continuity281 oc on oc.id=fresh.owner_continuity_id
  join icamp_private.auth_sessions s on s.id=oc.session_id
  where i.id=new.incident_id and fresh.id<>old.id and fresh.provider_id=old.provider_id
   and fresh.recorded_at>i.opened_at and fresh.recorded_at>=statement_timestamp()-interval '5 minutes'
   and m.observed_at>=statement_timestamp()-interval '5 minutes'
   and s.assurance_level='aal2' and s.revoked_at is null and s.expires_at>statement_timestamp()
   and s.reauthenticated_at>=statement_timestamp()-interval '15 minutes'
   and actor<>i.opened_by and actor<>d.reviewed_by
   and actor<>fresh.independently_reviewed_by and actor<>m.sampler_user_id
 ) then raise exception 'Independent current recovery and delivery review required';end if;
 return new;
end $$;
create trigger recovery_closure283_guard before insert on icamp_private.recovery_closure283
 for each row execute function icamp_private.guard_closure283();
do $$
declare tab text;
begin
 foreach tab in array array['monitor_run283','escalation_attempt283','escalation_outcome283','recovery_closure283'] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',tab||'_deny_direct',tab);
  execute format('create trigger %I before update or delete on icamp_private.%I for each row execute function icamp_private.immutable_monitor283()',tab||'_immutable',tab);
 end loop;
end $$;
