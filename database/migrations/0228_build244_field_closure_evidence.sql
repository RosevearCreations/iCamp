-- Build 244. Immutable, tenant-scoped supervisor field closure evidence. A
-- closure_reviewed event is NOT independent on-device acceptance or job release.
create table public.service_fulfillment_field_closure_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  field_report_id uuid not null references public.service_fulfillment_mobile_field_reports(id),
  review_id uuid not null references public.service_fulfillment_supervisor_review_events(id),
  previous_event_id uuid references public.service_fulfillment_field_closure_events(id),
  decision text not null check (decision in ('closure_reviewed','recheck_required')),
  evidence_reference text not null check (evidence_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{4,95}$'),
  note text not null check (char_length(trim(note)) between 8 and 300),
  recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id,dispatch_id)
    references public.service_fulfillment_dispatches(organization_id,campground_id,id)
    on delete restrict,
  unique (dispatch_id,previous_event_id)
);
create unique index service_fulfillment_field_closure_initial_idx
  on public.service_fulfillment_field_closure_events(dispatch_id)
  where previous_event_id is null;
create index service_fulfillment_field_closure_latest_idx
  on public.service_fulfillment_field_closure_events
  (campground_id,dispatch_id,recorded_at desc,id desc);

create function icamp_private.guard_service_fulfillment_field_closure()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  latest_closure uuid;
  latest_report record;
  latest_review record;
begin
  if new.recorded_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Current campground supervisor permission required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.dispatch_id::text),pg_catalog.hashtext('icamp-field-closure'));
  select id into latest_closure from public.service_fulfillment_field_closure_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id order by recorded_at desc,id desc limit 1;
  if new.previous_event_id is distinct from latest_closure then
    raise exception 'Closure evidence is stale; refresh source records';
  end if;
  select id,reported_by_user_id into latest_report
    from public.service_fulfillment_mobile_field_reports
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id order by reported_at desc,id desc limit 1;
  select id,subject_id,decision,reviewed_by_user_id into latest_review
    from public.service_fulfillment_supervisor_review_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id and review_kind='field_device'
    order by reviewed_at desc,id desc limit 1;
  if latest_report.id is distinct from new.field_report_id
    or latest_review.id is distinct from new.review_id
    or latest_review.subject_id is distinct from latest_report.id
    or latest_report.reported_by_user_id is not distinct from new.recorded_by_user_id
    or latest_review.reviewed_by_user_id is not distinct from latest_report.reported_by_user_id
    or (new.decision='closure_reviewed' and latest_review.decision <> 'reviewed_unverified') then
    raise exception 'Current independently reviewed worker report required';
  end if;
  new.recorded_at := statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_field_closure_guard
before insert on public.service_fulfillment_field_closure_events
for each row execute function icamp_private.guard_service_fulfillment_field_closure();

alter table public.service_fulfillment_field_closure_events enable row level security;
alter table public.service_fulfillment_field_closure_events force row level security;
revoke all on public.service_fulfillment_field_closure_events from public;
do $roles$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.service_fulfillment_field_closure_events from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.service_fulfillment_field_closure_events from authenticated;
  end if;
end $roles$;
grant select,insert on public.service_fulfillment_field_closure_events to icamp_app;
create policy service_fulfillment_field_closure_read
on public.service_fulfillment_field_closure_events for select to icamp_app
using (icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_field_closure_write
on public.service_fulfillment_field_closure_events for insert to icamp_app
with check (recorded_by_user_id=icamp_private.request_user_id()
  and icamp_private.has_campground_permission(campground_id,'staff.manage')
  and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
