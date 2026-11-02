-- Build 079 hosted Supabase Security/Performance Advisor hardening.
-- Trigger functions use no unqualified SQL object references.
alter function icamp_private.guard_garbage_pickup_update()
 set search_path = '';
alter function icamp_private.reject_garbage_event_mutation()
 set search_path = '';

alter policy garbage_policies_insert on public.garbage_service_policies
 with check (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
  and updated_by_user_id=(select nullif(current_setting('icamp.user_id',true),''))::uuid
 );
alter policy garbage_policies_update on public.garbage_service_policies
 using (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
 ) with check (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
  and updated_by_user_id=(select nullif(current_setting('icamp.user_id',true),''))::uuid
 );
alter policy garbage_pickups_insert on public.garbage_pickup_requests
 with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and created_by_user_id=(select nullif(current_setting('icamp.user_id',true),''))::uuid
  and updated_by_user_id=created_by_user_id
 );
alter policy garbage_pickups_update on public.garbage_pickup_requests
 using (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
 ) with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and updated_by_user_id=(select nullif(current_setting('icamp.user_id',true),''))::uuid
 );
alter policy garbage_events_insert on public.garbage_pickup_events
 with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and actor_user_id=(select nullif(current_setting('icamp.user_id',true),''))::uuid
 );
