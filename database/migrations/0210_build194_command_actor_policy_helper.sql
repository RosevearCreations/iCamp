-- Build 194: one invoker-rights actor lookup, wrapped as a policy initplan.
-- No privileged data access and no change to campground authorization.
create function icamp_private.management_command_actor()
returns uuid
language sql stable security invoker set search_path=''
as $$
  select nullif(current_setting('icamp.user_id',true),'')::uuid;
$$;
revoke all on function icamp_private.management_command_actor() from public;
do $grant194$
begin
 if exists(select 1 from pg_roles where rolname='anon') then
  revoke all on function icamp_private.management_command_actor() from anon;
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then
  revoke all on function icamp_private.management_command_actor() from authenticated;
 end if;
end $grant194$;
grant execute on function icamp_private.management_command_actor() to icamp_app;

alter policy command_views_read on icamp_private.management_command_views
using (user_id=(select icamp_private.management_command_actor())
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
alter policy command_views_insert on icamp_private.management_command_views
with check (user_id=(select icamp_private.management_command_actor())
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
alter policy command_views_update on icamp_private.management_command_views
using (user_id=(select icamp_private.management_command_actor())
  and icamp_private.has_campground_permission(campground_id,'reports.read'))
with check (user_id=(select icamp_private.management_command_actor())
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
alter policy command_views_delete on icamp_private.management_command_views
using (user_id=(select icamp_private.management_command_actor())
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
comment on function icamp_private.management_command_actor() is
  'Invoker-only stable session actor GUC helper, used as statement-level RLS initplan for Build 194 private staff preferences.';
