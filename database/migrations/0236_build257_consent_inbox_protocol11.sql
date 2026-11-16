-- iCamp Build 257: source-bound inbound contact inbox and role-isolated tasks.
-- No sending, tenant PII sharing, inferred consent or cross-app CONNECTED.
create table public.icamp_contact_inbox257 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  endpoint_id uuid not null,
  provider_event_id uuid not null references icamp_private.communication_provider_events(id),
  event_digest_sha256 text not null check (event_digest_sha256 ~ '^[a-f0-9]{64}$'),
  channel text not null check (channel in ('sms','mms','voice','dtmf','speech')),
  contact_kind text not null check (contact_kind in
    ('general_request','staff_transfer','booking_question','consent_help')),
  purpose text not null check (purpose in ('operational','transactional')),
  assigned_role text not null check (assigned_role in
    ('front_desk','communications_reviewer','campground_owner')),
  protocol_version text not null default '1.1' check (protocol_version in ('1.0','1.1')),
  state text not null default 'source_review_hold'
    check (state='source_review_hold'),
  created_by_user_id uuid not null references icamp_private.user_accounts(id),
  created_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  foreign key (campground_id,endpoint_id)
    references icamp_private.communication_endpoints(campground_id,id) on delete restrict,
  unique (campground_id,provider_event_id),
  unique (campground_id,event_digest_sha256),
  unique (campground_id,id)
);
create index icamp_contact_inbox257_scoped
  on public.icamp_contact_inbox257 (campground_id,created_at desc,id desc);

create table public.icamp_contact_task_actions257 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  inbox_id uuid not null,
  action text not null check (action in ('acknowledge','escalate','resolve')),
  action_digest_sha256 text not null check (action_digest_sha256 ~ '^[a-f0-9]{64}$'),
  acted_by_user_id uuid not null references icamp_private.user_accounts(id),
  acted_at timestamptz not null default statement_timestamp(),
  decision text not null default 'local_task_only'
    check (decision='local_task_only'),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  foreign key (campground_id,inbox_id)
    references public.icamp_contact_inbox257(campground_id,id) on delete restrict,
  unique (campground_id,action_digest_sha256)
);
create index icamp_contact_task_actions257_recent
  on public.icamp_contact_task_actions257 (campground_id,inbox_id,acted_at desc,id desc);

create table public.icamp_contact_master_handoff257 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  task_action_id uuid not null references public.icamp_contact_task_actions257(id),
  target_app text not null default 'rosevear-comms-hub'
    check (target_app='rosevear-comms-hub'),
  protocol_version text not null default '1.1' check (protocol_version='1.1'),
  state text not null default 'hold_undelivered'
    check (state='hold_undelivered'),
  created_by_user_id uuid not null references icamp_private.user_accounts(id),
  created_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  unique (task_action_id,target_app)
);

create function icamp_private.guard_contact_intake257()
returns trigger language plpgsql security definer set search_path='' as $$
declare source record;
begin
  if new.created_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'communications.manage')
  then raise exception 'Current local communications manager required'; end if;
  select d.organization_id,d.campground_id,d.endpoint_id,d.channel,
         p.provider_key,p.provider_event_id,
         e.endpoint_kind,e.lifecycle_state
  into source
  from icamp_private.communication_provider_events p
  join icamp_private.communication_dispatches d on d.id=p.dispatch_id
  join icamp_private.communication_endpoints e
    on e.id=d.endpoint_id and e.campground_id=d.campground_id
  where p.id=new.provider_event_id and d.direction='inbound'
    and p.channel=new.channel and d.channel=new.channel;
  if source.organization_id is distinct from new.organization_id
    or source.campground_id is distinct from new.campground_id
    or source.endpoint_id is distinct from new.endpoint_id
    or source.lifecycle_state is distinct from 'active'
    or (new.channel in ('sms','mms','voice','dtmf','speech')
        and source.endpoint_kind is distinct from 'phone')
  then raise exception 'Original tenant-scoped inbound provider event required'; end if;
  if new.contact_kind='consent_help' and new.channel not in ('sms','mms')
  then raise exception 'Consent help requires messaging source'; end if;
  if new.assigned_role='campground_owner'
    and not icamp_private.has_current_campground_owner_admin(new.campground_id)
  then raise exception 'Owner-only task assignment requires owner'; end if;
  new.created_at:=statement_timestamp();
  new.state:='source_review_hold';
  return new;
end;
$$;
create trigger icamp_contact_intake257_guard
before insert on public.icamp_contact_inbox257
for each row execute function icamp_private.guard_contact_intake257();

create function icamp_private.guard_contact_action257()
returns trigger language plpgsql security definer set search_path='' as $$
declare inbox record;
begin
  if new.acted_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'communications.read')
  then raise exception 'Current scoped staff reader required'; end if;
  select organization_id,campground_id,assigned_role into inbox
  from public.icamp_contact_inbox257 where id=new.inbox_id;
  if inbox.campground_id is distinct from new.campground_id
    or inbox.organization_id is distinct from new.organization_id
  then raise exception 'Cross-tenant contact action denied'; end if;
  if inbox.assigned_role='communications_reviewer'
    and not icamp_private.has_campground_permission(new.campground_id,'communications.manage')
  then raise exception 'Communications reviewer permission required'; end if;
  if inbox.assigned_role='campground_owner'
    and not icamp_private.has_current_campground_owner_admin(new.campground_id)
  then raise exception 'Owner contact review required'; end if;
  if new.action in ('resolve','escalate')
    and not icamp_private.has_campground_permission(new.campground_id,'communications.manage')
  then raise exception 'Scoped communications manager required'; end if;
  if new.action='resolve'
    and not (icamp_private.has_current_campground_owner_admin(new.campground_id)
      or icamp_private.has_campground_permission(new.campground_id,'campground.operations.manage'))
  then raise exception 'Supervisor resolution required'; end if;
  if exists (
    select 1 from public.icamp_contact_task_actions257
    where inbox_id=new.inbox_id and action='resolve'
  ) then raise exception 'Resolved contact cannot receive new task action'; end if;
  new.acted_at:=statement_timestamp();
  new.decision:='local_task_only';
  return new;
end;
$$;
create trigger icamp_contact_action257_guard
before insert on public.icamp_contact_task_actions257
for each row execute function icamp_private.guard_contact_action257();

create function icamp_private.guard_contact_handoff257()
returns trigger language plpgsql security definer set search_path='' as $$
declare task record;
begin
  if new.created_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'communications.manage')
  then raise exception 'Local Master-handoff reviewer required'; end if;
  select organization_id,campground_id,action into task
    from public.icamp_contact_task_actions257 where id=new.task_action_id;
  if task.organization_id is distinct from new.organization_id
    or task.campground_id is distinct from new.campground_id
    or task.action<>'escalate'
  then raise exception 'Source-bound scoped escalation required'; end if;
  new.target_app:='rosevear-comms-hub';
  new.state:='hold_undelivered';
  new.protocol_version:='1.1';
  new.created_at:=statement_timestamp();
  return new;
end;
$$;
create trigger icamp_contact_handoff257_guard
before insert on public.icamp_contact_master_handoff257
for each row execute function icamp_private.guard_contact_handoff257();

do $secure$ declare item text;
begin
  foreach item in array array[
    'icamp_contact_inbox257','icamp_contact_task_actions257',
    'icamp_contact_master_handoff257'
  ] loop
    execute format('alter table public.%I enable row level security',item);
    execute format('alter table public.%I force row level security',item);
    execute format('revoke all on public.%I from public',item);
    if exists(select 1 from pg_roles where rolname='anon') then
      execute format('revoke all on public.%I from anon',item);
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then
      execute format('revoke all on public.%I from authenticated',item);
    end if;
    execute format('grant select,insert on public.%I to icamp_app',item);
    execute format(
      'create policy %I on public.%I for select to icamp_app using (
        icamp_private.has_campground_permission(campground_id,''communications.read''))',
      item||'_select',item);
    execute format(
      'create policy %I on public.%I for insert to icamp_app with check (
        icamp_private.has_campground_permission(campground_id,''communications.read''))',
      item||'_insert',item);
  end loop;
end $secure$;

-- Restrictive policies combine with base tenant permission (AND), never OR.
create policy icamp_contact_inbox257_role_select
  on public.icamp_contact_inbox257 as restrictive for select to icamp_app
  using (
    assigned_role='front_desk'
    or (assigned_role='communications_reviewer'
      and icamp_private.has_campground_permission(campground_id,'communications.manage'))
    or (assigned_role='campground_owner'
      and icamp_private.has_current_campground_owner_admin(campground_id))
  );
create policy icamp_contact_task_actions257_role_select
  on public.icamp_contact_task_actions257 as restrictive for select to icamp_app
  using (
    exists (select 1 from public.icamp_contact_inbox257 i
      where i.id=icamp_contact_task_actions257.inbox_id
        and i.campground_id=icamp_contact_task_actions257.campground_id)
  );
create policy icamp_contact_master_handoff257_role_select
  on public.icamp_contact_master_handoff257 as restrictive for select to icamp_app
  using (
    icamp_private.has_campground_permission(campground_id,'communications.manage')
  );
