-- iCamp Build 078 advisor hardening.
-- Consolidate Build 077 + Build 078 SELECT authorization into one permissive
-- policy per table so equivalent read paths do not trigger duplicate-policy
-- performance warnings.

drop policy if exists camper_assistance_requests_build078_staff_read
on public.camper_assistance_requests;
drop policy if exists camper_assistance_requests_read
on public.camper_assistance_requests;

create policy camper_assistance_requests_read
on public.camper_assistance_requests
for select
to icamp_app
using (
  guest_user_id = icamp_private.request_user_id()
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'security.incident.manage')
  or icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
  or icamp_private.has_campground_permission(campground_id,'assistance.triage')
  or icamp_private.has_campground_permission(campground_id,'assistance.escalate')
  or icamp_private.has_campground_permission(campground_id,'assistance.communicate')
  or icamp_private.has_campground_permission(campground_id,'assistance.close')
);

drop policy if exists camper_assistance_request_events_build078_staff_read
on public.camper_assistance_request_events;
drop policy if exists camper_assistance_request_events_read
on public.camper_assistance_request_events;

create policy camper_assistance_request_events_read
on public.camper_assistance_request_events
for select
to icamp_app
using (
  exists (
    select 1
    from public.camper_assistance_requests r
    where r.id = camper_assistance_request_events.request_id
      and r.organization_id =
        camper_assistance_request_events.organization_id
      and r.campground_id =
        camper_assistance_request_events.campground_id
      and (
        r.guest_user_id = icamp_private.request_user_id()
        or icamp_private.has_campground_permission(r.campground_id,'reservation.read')
        or icamp_private.has_campground_permission(r.campground_id,'maintenance.read')
        or icamp_private.has_campground_permission(r.campground_id,'security.incident.manage')
        or icamp_private.has_campground_permission(r.campground_id,'campground.operations.manage')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.triage')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.escalate')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.communicate')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.close')
      )
  )
);

drop policy if exists camper_assistance_request_media_build078_staff_read
on public.camper_assistance_request_media;
drop policy if exists camper_assistance_request_media_read
on public.camper_assistance_request_media;

create policy camper_assistance_request_media_read
on public.camper_assistance_request_media
for select
to icamp_app
using (
  exists (
    select 1
    from public.camper_assistance_requests r
    where r.id = camper_assistance_request_media.request_id
      and r.organization_id =
        camper_assistance_request_media.organization_id
      and r.campground_id =
        camper_assistance_request_media.campground_id
      and (
        r.guest_user_id = icamp_private.request_user_id()
        or icamp_private.has_campground_permission(r.campground_id,'reservation.read')
        or icamp_private.has_campground_permission(r.campground_id,'maintenance.read')
        or icamp_private.has_campground_permission(r.campground_id,'security.incident.manage')
        or icamp_private.has_campground_permission(r.campground_id,'campground.operations.manage')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.triage')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.escalate')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.communicate')
        or icamp_private.has_campground_permission(r.campground_id,'assistance.close')
      )
  )
);
