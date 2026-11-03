-- Build 197 follow-up: cache each per-request actor lookup once per statement.
-- Campground authorization remains row-scoped; no broader read or write grant.
create function icamp_private.guest_privacy_actor()
returns uuid language sql stable security invoker set search_path='' as $$
  select nullif(current_setting('icamp.user_id',true),'')::uuid;
$$;
revoke all on function icamp_private.guest_privacy_actor() from public;
do $restrict$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on function icamp_private.guest_privacy_actor() from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on function icamp_private.guest_privacy_actor() from authenticated;
  end if;
end $restrict$;
grant execute on function icamp_private.guest_privacy_actor() to icamp_app;

alter policy guest_privacy_requests_read on icamp_private.guest_privacy_requests
using (guest_user_id=(select icamp_private.guest_privacy_actor())
  or icamp_private.has_campground_permission(campground_id,'guest.manage'));
alter policy guest_privacy_requests_insert on icamp_private.guest_privacy_requests
with check (guest_user_id=(select icamp_private.guest_privacy_actor())
  and icamp_private.guest_privacy_has_scope(organization_id,campground_id));
alter policy guest_privacy_events_read on icamp_private.guest_privacy_request_events
using (exists(select 1 from icamp_private.guest_privacy_requests r
  where r.id=request_id and r.organization_id=organization_id and r.campground_id=campground_id
  and (r.guest_user_id=(select icamp_private.guest_privacy_actor())
    or icamp_private.has_campground_permission(campground_id,'guest.manage'))));
alter policy guest_privacy_events_insert on icamp_private.guest_privacy_request_events
with check (actor_user_id=(select icamp_private.guest_privacy_actor())
  and exists(select 1 from icamp_private.guest_privacy_requests r
    where r.id=request_id and r.organization_id=organization_id and r.campground_id=campground_id
    and ((event_kind='submitted' and r.guest_user_id=actor_user_id)
      or (event_kind<>'submitted' and icamp_private.has_campground_permission(campground_id,'guest.manage')))));
comment on function icamp_private.guest_privacy_actor() is
  'Build 197: invoker-only actor GUC helper with a one-per-statement RLS initplan.';
