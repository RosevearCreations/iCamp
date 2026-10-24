-- Build 082 advisor hardening: keep one selective reservation read policy,
-- preserving every existing staff predicate and adding own active guest stay.
alter policy reservations_read on public.reservations using (
 icamp_private.has_campground_permission(campground_id,'reservation.read')
 or icamp_private.has_campground_permission(campground_id,'reservation.create')
 or icamp_private.has_campground_permission(campground_id,'reservation.modify')
 or icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
 or icamp_private.has_campground_permission(campground_id,'visitor.read')
 or icamp_private.has_campground_permission(campground_id,'visitor.register')
 or (
  guest_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and status in ('confirmed','checked_in')
 )
);
drop policy reservations_guest_owned_active_read on public.reservations;
