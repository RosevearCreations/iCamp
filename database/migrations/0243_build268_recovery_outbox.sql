-- iCamp 268: original-tenant booking recovery and durable platform SLA queue.
-- No payment capture, refund, site allocation or guest contact is performed here.
create table icamp_private.booking_recovery268 (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid not null unique references icamp_private.campground_support265(id) on delete restrict,
 reservation_id uuid not null,
 local_owner_user_id uuid not null references icamp_private.user_accounts(id),
 opened_by_user_id uuid not null references icamp_private.user_accounts(id),
 state text not null default 'investigating'
   check (state in ('investigating','provider_review','site_review','guest_followup','closed')),
 next_update_at timestamptz not null,
 outcome text not null default 'unresolved'
   check (outcome in ('unresolved','confirmed','authorized_refund','no_payment')),
 provider_reconciliation_reference text,
 guest_followup_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 version integer not null default 1 check(version>=1),
 foreign key(organization_id,campground_id,reservation_id)
   references public.reservations(organization_id,campground_id,id) on delete restrict
);
create index booking_recovery268_scope_idx
 on icamp_private.booking_recovery268(campground_id,state,next_update_at);
create table icamp_private.booking_recovery_events268 (
 id uuid primary key default gen_random_uuid(),
 recovery_id uuid not null references icamp_private.booking_recovery268(id) on delete restrict,
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 event_kind text not null check(event_kind in
   ('opened','provider_checked','site_checked','guest_contacted','closed','reopened')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 12 and 160),
 recorded_at timestamptz not null default statement_timestamp()
);
create index booking_recovery_events268_case_idx
 on icamp_private.booking_recovery_events268(recovery_id,recorded_at desc);
create table icamp_private.support_sla_outbox268 (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references icamp_private.campground_support265(id) on delete restrict,
 assigned_user_id uuid not null references icamp_private.user_accounts(id),
 alert_tier text not null check(alert_tier in ('critical','priority','routine')),
 delivery_state text not null default 'queued'
   check(delivery_state in ('queued','attempted','acknowledged','blocked')),
 queued_at timestamptz not null default statement_timestamp(),
 attempted_at timestamptz,
 acknowledged_at timestamptz,
 delivery_reference text,
 unique(case_id,alert_tier)
);
create index support_sla_outbox268_status_idx
 on icamp_private.support_sla_outbox268(delivery_state,queued_at);

create function icamp_private.guard_booking_recovery268()
returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if tg_op='DELETE' then raise exception 'Recovery evidence cannot be deleted'; end if;
 if actor is null or not icamp_private.has_campground_permission(new.campground_id,'campground.operations.manage')
 then raise exception 'Active campground manager required'; end if;
 if not exists (
   select 1 from icamp_private.campground_support265 s
   where s.id=new.case_id and s.campground_id=new.campground_id
     and s.organization_id=new.organization_id
 ) then raise exception 'Case and campground scope mismatch'; end if;
 if tg_op='INSERT' then
   if new.opened_by_user_id<>actor or new.state<>'investigating'
      or new.outcome<>'unresolved' or new.version<>1
   then raise exception 'Invalid initial recovery case'; end if;
 else
   if new.case_id<>old.case_id or new.campground_id<>old.campground_id
      or new.organization_id<>old.organization_id
      or new.reservation_id<>old.reservation_id
      or new.opened_by_user_id<>old.opened_by_user_id
      or new.version<>old.version+1
   then raise exception 'Recovery case identity or version cannot change'; end if;
 end if;
 if new.state='closed' and (new.outcome='unresolved'
    or nullif(trim(new.provider_reconciliation_reference),'') is null
    or new.guest_followup_at is null)
 then raise exception 'Verified payment outcome and guest follow-up required for closure'; end if;
 return new;
end $$;
create trigger booking_recovery268_guard before insert or update or delete
 on icamp_private.booking_recovery268 for each row
 execute function icamp_private.guard_booking_recovery268();

create function icamp_private.guard_booking_recovery_events268()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Recovery timeline is immutable'; end if;
 if new.actor_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid
   or not exists(
    select 1 from icamp_private.booking_recovery268 b where b.id=new.recovery_id
    and icamp_private.has_campground_permission(b.campground_id,'campground.operations.manage'))
 then raise exception 'Authorized campground evidence required'; end if;
 return new;
end $$;
create trigger booking_recovery_events268_guard before insert or update or delete
 on icamp_private.booking_recovery_events268 for each row
 execute function icamp_private.guard_booking_recovery_events268();

do $$
declare t text;
begin
 foreach t in array array['booking_recovery268','booking_recovery_events268','support_sla_outbox268']
 loop
  execute format('alter table icamp_private.%I enable row level security',t);
  execute format('alter table icamp_private.%I force row level security',t);
  execute format('revoke all on icamp_private.%I from public',t);
  execute format('create policy %I on icamp_private.%I for all to icamp_app using(false) with check(false)',t||'_deny_direct',t);
 end loop;
end $$;
