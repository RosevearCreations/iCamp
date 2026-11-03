-- Build 194 performance hardening: execute the actor GUC lookup once per statement.
-- Actor/campground report permission and FORCE RLS remain unchanged.
alter policy command_views_read on icamp_private.management_command_views
using (user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
alter policy command_views_insert on icamp_private.management_command_views
with check (user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
alter policy command_views_update on icamp_private.management_command_views
using (user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
  and icamp_private.has_campground_permission(campground_id,'reports.read'))
with check (user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
alter policy command_views_delete on icamp_private.management_command_views
using (user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
  and icamp_private.has_campground_permission(campground_id,'reports.read'));
