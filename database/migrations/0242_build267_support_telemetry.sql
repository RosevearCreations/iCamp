-- Build 267: original case ownership, immutable escalations and consent-gated telemetry.
-- Tenant case narratives never enter the shared telemetry stream.
create table icamp_private.support_ownership267 (
  case_id uuid primary key references icamp_private.campground_support265(id) on delete restrict,
  assigned_user_id uuid not null references icamp_private.user_accounts(id),
  assigned_by_user_id uuid not null references icamp_private.user_accounts(id),
  assigned_at timestamptz not null default statement_timestamp(),
  escalation_level integer not null default 0 check (escalation_level between 0 and 3),
  version integer not null default 1 check (version>=1)
);
create table icamp_private.support_events267 (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references icamp_private.campground_support265(id) on delete restrict,
  actor_user_id uuid not null references icamp_private.user_accounts(id),
  assigned_user_id uuid references icamp_private.user_accounts(id),
  action text not null check (action in ('assigned','reassigned','escalated')),
  escalation_level integer not null check (escalation_level between 0 and 3),
  recorded_at timestamptz not null default statement_timestamp()
);
create index support_events267_case_idx on icamp_private.support_events267(case_id,recorded_at desc);
create function icamp_private.guard_support_ownership267()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 candidate uuid;
begin
 if tg_op='DELETE' then raise exception 'Support assignments cannot be deleted'; end if;
 if actor is null or actor <> new.assigned_by_user_id or not exists(
  select 1 from icamp_private.platform_operator_grants g
  join icamp_private.platform_master_owner_bindings b on b.user_id=g.user_id
  where g.user_id=actor and g.grant_state='active'
    and b.binding_state='verified' and b.owner_slot in ('ree','jack')
 ) then raise exception 'Verified platform operator required'; end if;
 select a.id into candidate from icamp_private.user_accounts a
 join icamp_private.platform_operator_grants g on g.user_id=a.id
 where a.id=new.assigned_user_id and a.account_state='active'
   and a.account_type='staff' and g.grant_state='active';
 if candidate is null then raise exception 'Assignee must be active platform operator'; end if;
 if tg_op='INSERT' then
  if new.version<>1 or new.escalation_level<>0 then raise exception 'Invalid initial assignment'; end if;
 else
  if new.case_id<>old.case_id or new.version<>old.version+1 or
     new.escalation_level<old.escalation_level or
     new.escalation_level>old.escalation_level+1 or
     new.assigned_at<old.assigned_at then raise exception 'Invalid assignment transition'; end if;
 end if;
 return new;
end $$;
create trigger guard_support_ownership267 before insert or update or delete
 on icamp_private.support_ownership267 for each row
 execute function icamp_private.guard_support_ownership267();
create function icamp_private.guard_support_events267()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op <> 'INSERT' then raise exception 'Support event receipts are immutable'; end if;
 if new.actor_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid
  or not exists(select 1 from icamp_private.support_ownership267 o
    where o.case_id=new.case_id and o.assigned_by_user_id=new.actor_user_id
      and o.escalation_level=new.escalation_level and o.assigned_user_id=new.assigned_user_id)
 then raise exception 'Original current ownership receipt required'; end if;
 return new;
end $$;
create trigger guard_support_events267 before insert or update or delete
 on icamp_private.support_events267 for each row
 execute function icamp_private.guard_support_events267();

create table icamp_private.telemetry_enrollment267 (
  campground_id uuid primary key references public.campgrounds(id) on delete restrict,
  approved_by_user_id uuid not null references icamp_private.user_accounts(id),
  approved_at timestamptz not null default statement_timestamp(),
  state text not null check(state in ('active','revoked')),
  source_id text not null check(source_id ~ '^[a-z0-9_-]{8,64}$'),
  version integer not null default 1 check(version>=1)
);
create table icamp_private.telemetry_samples267 (
  id uuid primary key default gen_random_uuid(),
  campground_id uuid not null references public.campgrounds(id),
  source_id text not null,
  nonce text not null check(nonce ~ '^[a-zA-Z0-9_-]{16,96}$'),
  observed_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  requests integer not null check(requests between 0 and 10000000),
  errors integer not null check(errors between 0 and requests),
  latency_p95_ms integer not null check(latency_p95_ms between 0 and 600000),
  unique(campground_id,source_id,nonce)
);
create index telemetry_samples267_scope on icamp_private.telemetry_samples267(campground_id,received_at desc);
create function icamp_private.guard_telemetry_samples267()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Telemetry evidence is append-only'; end if;
 if not exists(select 1 from icamp_private.telemetry_enrollment267 e
   where e.campground_id=new.campground_id and e.source_id=new.source_id and e.state='active')
 or new.observed_at>statement_timestamp()+interval '1 minute'
 or new.observed_at<statement_timestamp()-interval '5 minutes'
 then raise exception 'Telemetry source unenrolled or stale'; end if;
 return new;
end $$;
create trigger guard_telemetry_samples267 before insert or update or delete
 on icamp_private.telemetry_samples267 for each row execute function icamp_private.guard_telemetry_samples267();

do $$
declare t text;
begin
 foreach t in array array['support_ownership267','support_events267','telemetry_enrollment267','telemetry_samples267']
 loop
  execute format('alter table icamp_private.%I enable row level security',t);
  execute format('alter table icamp_private.%I force row level security',t);
  execute format('revoke all on icamp_private.%I from public',t);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)', t||'_deny_direct',t);
 end loop;
end $$;
