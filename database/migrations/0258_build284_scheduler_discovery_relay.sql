-- Machine discovery is not a human opening or a signed delivery.
create table icamp_private.scheduler_sample284 (
 run_id uuid primary key references icamp_private.monitor_run283(id) on delete restrict,
 sampled_at timestamptz not null default statement_timestamp()
);
create table icamp_private.recovery_discovery284 (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references icamp_private.scheduler_sample284(run_id) on delete restrict,
 ack_id uuid not null references icamp_private.external_restore_final_ack281(id) on delete restrict,
 reason text not null check(reason in ('OWNER_RECOVERY_CONTINUITY_HOLD','PROVIDER_ACK_FRESHNESS_HOLD','SOURCE_CONTINUITY_HOLD','INDEPENDENT_MONITOR_HOLD')),
 discovered_at timestamptz not null default statement_timestamp(),
 unique(ack_id,reason)
);
create table icamp_private.relay_attempt284 (
 attempt_id uuid primary key references icamp_private.escalation_attempt283(id) on delete restrict,
 channel text not null check(channel in ('PRIMARY','SECONDARY_RELAY')),
 recorded_at timestamptz not null default statement_timestamp()
);
do $$
declare tab text;
begin
 foreach tab in array array['scheduler_sample284','recovery_discovery284','relay_attempt284'] loop
  execute format('alter table icamp_private.%I enable row level security',tab);
  execute format('alter table icamp_private.%I force row level security',tab);
  execute format('revoke all on icamp_private.%I from public',tab);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',tab||'_deny_direct',tab);
  execute format('create trigger %I before update or delete on icamp_private.%I for each row execute function icamp_private.immutable_monitor283()',tab||'_immutable',tab);
 end loop;
end $$;
