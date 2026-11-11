-- Build 242. Append-only campground-private supervisor case follow-up and
-- device report review. A review is NOT independent field acceptance.
create table public.service_fulfillment_supervisor_review_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  subject_id uuid not null,
  previous_event_id uuid references public.service_fulfillment_supervisor_review_events(id),
  review_kind text not null check (review_kind in ('case_followup','field_device')),
  decision text not null,
  note text not null check (char_length(trim(note)) between 5 and 300),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id,dispatch_id)
    references public.service_fulfillment_dispatches(organization_id,campground_id,id)
    on delete restrict,
  check ((review_kind = 'case_followup' and decision in
    ('pending_worker','supervisor_recheck','escalation_requested','followup_resolved'))
    or (review_kind = 'field_device' and decision in
    ('needs_retest','blocker_escalated','reviewed_unverified'))),
  unique (dispatch_id,review_kind,previous_event_id)
);
create unique index service_fulfillment_supervisor_review_initial_idx
  on public.service_fulfillment_supervisor_review_events(dispatch_id,review_kind)
  where previous_event_id is null;
create index service_fulfillment_supervisor_review_latest_idx
  on public.service_fulfillment_supervisor_review_events
  (campground_id,dispatch_id,review_kind,reviewed_at desc,id desc);

create function icamp_private.guard_service_fulfillment_supervisor_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  latest_id uuid;
  current_id uuid;
  current_actor uuid;
begin
  if new.reviewed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Only a campground supervisor can record source reviews';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.dispatch_id::text),pg_catalog.hashtext(new.review_kind));
  select id into latest_id from public.service_fulfillment_supervisor_review_events
    where campground_id=new.campground_id and dispatch_id=new.dispatch_id
      and review_kind=new.review_kind
    order by reviewed_at desc,id desc limit 1;
  if new.previous_event_id is distinct from latest_id then
    raise exception 'Review history changed. Refresh this case';
  end if;
  if new.review_kind = 'case_followup' then
    select id,claimed_by_user_id into current_id,current_actor
      from public.service_fulfillment_case_owner_events
      where organization_id=new.organization_id and campground_id=new.campground_id
        and dispatch_id=new.dispatch_id
      order by recorded_at desc,id desc limit 1;
    if current_id is distinct from new.subject_id
      or current_actor is distinct from new.reviewed_by_user_id then
      raise exception 'Claim current ownership before follow-up';
    end if;
  else
    select id,reported_by_user_id into current_id,current_actor
      from public.service_fulfillment_mobile_field_reports
      where organization_id=new.organization_id and campground_id=new.campground_id
        and dispatch_id=new.dispatch_id
      order by reported_at desc,id desc limit 1;
    if current_id is distinct from new.subject_id
      or current_actor is null
      or current_actor is not distinct from new.reviewed_by_user_id then
      raise exception 'Review a current report independently of its worker author';
    end if;
  end if;
  new.reviewed_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_supervisor_review_guard
before insert on public.service_fulfillment_supervisor_review_events
for each row execute function icamp_private.guard_service_fulfillment_supervisor_review();

alter table public.service_fulfillment_supervisor_review_events enable row level security;
alter table public.service_fulfillment_supervisor_review_events force row level security;
revoke all on public.service_fulfillment_supervisor_review_events from public;
do $roles$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.service_fulfillment_supervisor_review_events from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.service_fulfillment_supervisor_review_events from authenticated;
  end if;
end $roles$;
grant select,insert on public.service_fulfillment_supervisor_review_events to icamp_app;
create policy service_fulfillment_supervisor_review_read
on public.service_fulfillment_supervisor_review_events for select to icamp_app
using (icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_supervisor_review_insert
on public.service_fulfillment_supervisor_review_events for insert to icamp_app
with check (reviewed_by_user_id=icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
