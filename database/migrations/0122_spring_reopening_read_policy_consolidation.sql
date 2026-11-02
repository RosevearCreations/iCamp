-- Build 089 follow-up: retain the exact union of existing read permissions
-- while evaluating one permissive policy per shared canonical table.

alter policy accommodations_read on public.accommodations to icamp_app
 using (
  icamp_private.has_campground_permission(campground_id,'accommodation.read') or
  icamp_private.has_campground_permission(campground_id,'accommodation.manage') or
  icamp_private.has_campground_permission(campground_id,'campground.operations.manage') or
  icamp_private.has_campground_permission(campground_id,'visitor.read') or
  icamp_private.has_campground_permission(campground_id,'visitor.register') or
  icamp_private.has_campground_permission(campground_id,'garbage.read') or
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch') or
  icamp_private.has_campground_permission(campground_id,'garbage.tags.sell') or
  icamp_private.has_campground_permission(campground_id,'garbage.tags.redeem') or
  icamp_private.has_campground_permission(campground_id,'winter.readiness.read') or
  icamp_private.has_campground_permission(campground_id,'spring.reopen.read')
 );
drop policy accommodations_winter_readiness_read on public.accommodations;
drop policy accommodations_spring_reopening_read on public.accommodations;

alter policy seasonal_assignments_read on public.seasonal_assignments to icamp_app
 using (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage') or
  icamp_private.has_campground_permission(campground_id,'reservation.read') or
  icamp_private.has_campground_permission(campground_id,'winter.readiness.read') or
  icamp_private.has_campground_permission(campground_id,'spring.reopen.read')
 );
drop policy seasonal_assignments_winter_readiness_read on public.seasonal_assignments;
drop policy seasonal_assignments_spring_reopening_read on public.seasonal_assignments;

alter policy seasonal_assignment_events_read on public.seasonal_assignment_events to icamp_app
 using (
  icamp_private.has_campground_permission(campground_id,'seasonal.manage') or
  icamp_private.has_campground_permission(campground_id,'reservation.read') or
  icamp_private.has_campground_permission(campground_id,'spring.reopen.read')
 );
drop policy seasonal_events_spring_reopening_read on public.seasonal_assignment_events;

alter policy maintenance_work_orders_read on public.maintenance_work_orders to icamp_app
 using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read') or
  icamp_private.has_campground_permission(campground_id,'maintenance.create') or
  icamp_private.has_campground_permission(campground_id,'maintenance.assign') or
  icamp_private.has_campground_permission(campground_id,'maintenance.complete') or
  icamp_private.has_campground_permission(campground_id,'spring.reopen.read')
 );
drop policy work_orders_spring_reopening_read on public.maintenance_work_orders;
