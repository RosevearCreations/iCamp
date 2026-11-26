-- Original provider delivery receipts and recovery escalation custody.
create table icamp_private.recovery_incident282 (
 id uuid primary key default gen_random_uuid(),
 ack_id uuid not null references icamp_private.external_restore_final_ack281(id) on delete restrict,
 reason text not null check(reason in ('OWNER_RECOVERY_CONTINUITY_HOLD','PROVIDER_ACK_FRESHNESS_HOLD','SOURCE_CONTINUITY_HOLD','INDEPENDENT_MONITOR_HOLD')),
 opened_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 opened_at timestamptz not null default statement_timestamp(),
 unique(ack_id,reason)
);
create table icamp_private.provider_alert_delivery282 (
 id uuid primary key default gen_random_uuid(),
 incident_id uuid not null unique references icamp_private.recovery_incident282(id) on delete restrict,
 provider_id text not null,
 event_id text not null check(event_id ~ '^[A-Za-z0-9_-]{16,160}$'),
 signed_body text not null check(char_length(signed_body) between 100 and 2400),
 signature_b64url text not null check(signature_b64url ~ '^[A-Za-z0-9_-]{86}$'),
 reviewed_by uuid not null references icamp_private.user_accounts(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 unique(provider_id,event_id)
);
create function icamp_private.guard_recovery_incident282()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op <> 'INSERT' then raise exception 'Build 282 custody is immutable';end if;
 if actor is null or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  join icamp_private.user_accounts a on a.id=g.user_id
  where g.user_id=actor and g.grant_state='active' and b.binding_state='verified'
   and b.verified_by is not null and b.verified_by<>actor
   and a.account_state='active' and a.account_type='staff'
 ) then raise exception 'Original independent operator required';end if;
 if tg_table_name='recovery_incident282' then
  if actor<>new.opened_by then raise exception 'Incorrect original incident actor';end if;
 else
  if actor<>new.reviewed_by or not exists(
   select 1 from icamp_private.recovery_incident282 i
   join icamp_private.external_restore_final_ack281 x on x.id=i.ack_id
   where i.id=new.incident_id and i.opened_by<>actor
    and x.provider_id=new.provider_id and x.independently_reviewed_by<>actor
  ) then raise exception 'Separate provider delivery reviewer required';end if;
 end if;
 return new;
end $$;
create trigger recovery_incident282_guard before insert or update or delete
 on icamp_private.recovery_incident282 for each row
 execute function icamp_private.guard_recovery_incident282();
create trigger provider_alert_delivery282_guard before insert or update or delete
 on icamp_private.provider_alert_delivery282 for each row
 execute function icamp_private.guard_recovery_incident282();
do $$
declare tab text;
begin
 foreach tab in array array['recovery_incident282','provider_alert_delivery282'] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',tab||'_deny_direct',tab);
 end loop;
end $$;
