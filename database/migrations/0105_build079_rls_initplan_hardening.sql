-- Build 079 follow-up: put current_setting itself in a scalar SELECT.
-- Supabase's RLS advisor requires this exact initialization boundary.

alter policy garbage_policies_insert on public.garbage_service_policies
 with check (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
  and updated_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 );
alter policy garbage_policies_update on public.garbage_service_policies
 using (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
 ) with check (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
  and updated_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 );
alter policy garbage_pickups_insert on public.garbage_pickup_requests
 with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id=created_by_user_id
 );
alter policy garbage_pickups_update on public.garbage_pickup_requests
 using (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
 ) with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and updated_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 );
alter policy garbage_events_insert on public.garbage_pickup_events
 with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 );
