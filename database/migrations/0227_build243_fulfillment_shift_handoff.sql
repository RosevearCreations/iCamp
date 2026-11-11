-- Build 243: append-only cross-shift handoffs. A receiving supervisor's explicit
-- acceptance is paired transactionally with a new source case ownership event.
create table public.service_fulfillment_shift_handoff_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  request_id uuid references public.service_fulfillment_shift_handoff_events(id),
  event_kind text not null check (event_kind in ('request','accept','decline')),
  owner_event_id uuid not null references public.service_fulfillment_case_owner_events(id),
  outgoing_user_id uuid not null references icamp_private.user_accounts(id),
  incoming_user_id uuid not null references icamp_private.user_accounts(id),
  recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
  note text not null check (char_length(trim(note)) between 5 and 300),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id,dispatch_id)
    references public.service_fulfillment_dispatches(organization_id,campground_id,id)
    on delete restrict,
  check ((event_kind='request' and request_id is null)
      or (event_kind in ('accept','decline') and request_id is not null)),
  check (outgoing_user_id <> incoming_user_id),
  unique (request_id)
);
create index service_fulfillment_shift_handoff_latest_idx
  on public.service_fulfillment_shift_handoff_events
  (campground_id,dispatch_id,recorded_at desc,id desc);
create index service_fulfillment_shift_handoff_inbox_idx
  on public.service_fulfillment_shift_handoff_events
  (campground_id,incoming_user_id,event_kind,recorded_at desc);

create function icamp_private.is_fulfillment_supervisor(
  target_user uuid, target_campground uuid
) returns boolean language sql stable security definer set search_path='' as $$
  select (select count(distinct rp.permission_key)=2
    from icamp_private.campground_assignments a
    join icamp_private.campground_assignment_roles ar on ar.assignment_id=a.id
    join icamp_private.roles r on r.id=ar.role_id and r.lifecycle_state='active'
    join icamp_private.role_permissions rp on rp.role_id=r.id
    where a.user_id=target_user and a.campground_id=target_campground
      and a.assignment_state='active' and a.starts_at<=statement_timestamp()
      and (a.ends_at is null or a.ends_at>statement_timestamp())
      and rp.permission_key in ('staff.manage','reservation.modify'))
    and exists(select 1 from icamp_private.user_accounts u where u.id=target_user
      and u.account_type='staff' and u.account_state='active' and u.archived_at is null);
$$;
revoke all on function icamp_private.is_fulfillment_supervisor(uuid,uuid) from public;

create function icamp_private.list_fulfillment_shift_supervisors(target_campground uuid)
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not icamp_private.has_campground_permission(target_campground,'staff.manage')
    or not icamp_private.has_campground_permission(target_campground,'reservation.modify') then
    raise exception 'Campground supervisor role required';
  end if;
  return query select u.id, u.email_normalized from icamp_private.user_accounts u
    join icamp_private.campground_assignments a on a.user_id=u.id
      and a.campground_id=target_campground
    where u.id<>icamp_private.request_user_id()
      and icamp_private.is_fulfillment_supervisor(u.id,target_campground)
    group by u.id,u.email_normalized order by u.email_normalized limit 100;
end;
$$;
revoke all on function icamp_private.list_fulfillment_shift_supervisors(uuid) from public;
grant execute on function icamp_private.list_fulfillment_shift_supervisors(uuid) to icamp_app;

create function icamp_private.guard_service_fulfillment_shift_handoff()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  current_owner record;
  original record;
begin
  if new.recorded_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Authorized campground supervisor required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.dispatch_id::text),
    pg_catalog.hashtext('icamp-shift-handoff'));
  select id, claimed_by_user_id into current_owner
    from public.service_fulfillment_case_owner_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by recorded_at desc,id desc limit 1;
  if new.event_kind='request' then
    if current_owner.id is distinct from new.owner_event_id
      or current_owner.claimed_by_user_id is distinct from new.recorded_by_user_id
      or new.outgoing_user_id is distinct from new.recorded_by_user_id
      or not icamp_private.is_fulfillment_supervisor(new.incoming_user_id,new.campground_id)
      or exists(select 1 from public.service_fulfillment_shift_handoff_events h
        where h.campground_id=new.campground_id and h.dispatch_id=new.dispatch_id
          and h.event_kind='request' and h.owner_event_id=new.owner_event_id
          and not exists(select 1 from public.service_fulfillment_shift_handoff_events d
            where d.request_id=h.id)) then
      raise exception 'Current owner, eligible next supervisor and no pending handoff required';
    end if;
  else
    select * into original from public.service_fulfillment_shift_handoff_events
    where id=new.request_id and event_kind='request';
    if not found or original.organization_id is distinct from new.organization_id
      or original.campground_id is distinct from new.campground_id
      or original.dispatch_id is distinct from new.dispatch_id
      or original.owner_event_id is distinct from new.owner_event_id
      or original.outgoing_user_id is distinct from new.outgoing_user_id
      or original.incoming_user_id is distinct from new.incoming_user_id
      or new.recorded_by_user_id is distinct from new.incoming_user_id
      or current_owner.id is distinct from new.owner_event_id
      or current_owner.claimed_by_user_id is distinct from new.outgoing_user_id
      or not icamp_private.is_fulfillment_supervisor(new.incoming_user_id,new.campground_id)
      or exists(select 1 from public.service_fulfillment_shift_handoff_events d
        where d.request_id=new.request_id) then
      raise exception 'Handoff is stale or not assigned to this receiving supervisor';
    end if;
  end if;
  new.recorded_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_shift_handoff_guard
before insert on public.service_fulfillment_shift_handoff_events
for each row execute function icamp_private.guard_service_fulfillment_shift_handoff();

alter table public.service_fulfillment_shift_handoff_events enable row level security;
alter table public.service_fulfillment_shift_handoff_events force row level security;
revoke all on public.service_fulfillment_shift_handoff_events from public;
do $roles$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.service_fulfillment_shift_handoff_events from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.service_fulfillment_shift_handoff_events from authenticated;
  end if;
end $roles$;
grant select,insert on public.service_fulfillment_shift_handoff_events to icamp_app;
create policy service_fulfillment_shift_handoff_read
on public.service_fulfillment_shift_handoff_events for select to icamp_app
using (icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_shift_handoff_write
on public.service_fulfillment_shift_handoff_events for insert to icamp_app
with check (recorded_by_user_id=icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
