-- Build 082 guest My Stay integration: grant read of an owned active stay
-- through icamp_app so published-rule RLS can validate the current guest.
-- No direct API role access, guest writes, or other guests' stays are exposed.
create policy reservations_guest_owned_active_read
 on public.reservations for select to icamp_app
 using (
  guest_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and status in ('confirmed','checked_in')
 );
