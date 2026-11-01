-- Build 179: enable guest-owned, append-only in-app case replies.
-- Existing staff case events and request-level validated media remain canonical.
alter table public.camper_assistance_case_events
  drop constraint camper_assistance_case_events_event_kind_check;
alter table public.camper_assistance_case_events
  add constraint camper_assistance_case_events_event_kind_check
  check (event_kind in (
    'triaged','assigned','escalated','escalation_acknowledged',
    'escalation_resolved','guest_message','guest_reply','staff_note','closed'
  ));

alter table public.camper_assistance_case_events
  drop constraint camper_assistance_case_events_visibility_check;
alter table public.camper_assistance_case_events
  add constraint camper_assistance_case_events_visibility_check
  check (not guest_visible or event_kind in ('guest_message','guest_reply','closed'));

create unique index camper_assistance_guest_reply_idempotency_idx
  on public.camper_assistance_case_events(case_id,(metadata->>'clientMessageId'))
  where event_kind='guest_reply';

create function icamp_private.build179_guard_guest_reply()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.event_kind <> 'guest_reply' then
    return new;
  end if;
  if new.actor_user_id is distinct from icamp_private.request_user_id()
     or new.source_channel <> 'web'
     or new.contact_channel <> 'in_app'
     or not new.guest_visible
     or new.metadata->>'deliveryMode' <> 'in_app_only'
     or coalesce(new.metadata->>'clientMessageId','') !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Only authenticated guest-owned in-app replies are accepted';
  end if;
  if not exists (
    select 1 from public.camper_assistance_cases c
    join public.camper_assistance_requests r
      on r.id=c.request_id
     and r.organization_id=c.organization_id
     and r.campground_id=c.campground_id
    where c.id=new.case_id
      and c.organization_id=new.organization_id
      and c.campground_id=new.campground_id
      and c.case_state<>'closed'
      and r.guest_user_id=new.actor_user_id
  ) then
    raise exception 'Guest reply requires own open assistance case';
  end if;
  return new;
end $$;

revoke all on function icamp_private.build179_guard_guest_reply() from public;
create trigger build179_guard_guest_reply before insert
  on public.camper_assistance_case_events
  for each row execute function icamp_private.build179_guard_guest_reply();

create policy camper_assistance_case_guest_reply_insert
on public.camper_assistance_case_events
for insert to icamp_app with check (
  event_kind='guest_reply'
  and guest_visible
  and contact_channel='in_app'
  and source_channel='web'
  and actor_user_id=icamp_private.request_user_id()
  and metadata->>'deliveryMode'='in_app_only'
  and exists (
    select 1 from public.camper_assistance_cases c
    join public.camper_assistance_requests r
      on r.id=c.request_id
     and r.organization_id=c.organization_id
     and r.campground_id=c.campground_id
    where c.id=camper_assistance_case_events.case_id
      and c.organization_id=camper_assistance_case_events.organization_id
      and c.campground_id=camper_assistance_case_events.campground_id
      and c.case_state<>'closed'
      and r.guest_user_id=icamp_private.request_user_id()
  )
);
