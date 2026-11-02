-- Build 189 hosted advisory hardening: evaluate the trusted actor setting once
-- per statement rather than per row. Policies and permissions are unchanged.
alter policy maintenance_offline_sync_conflicts_read
on public.maintenance_offline_sync_conflicts using (
  actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and (
    icamp_private.has_campground_permission(campground_id,'maintenance.read')
    or icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
    or icamp_private.has_campground_permission(campground_id,'inspection.perform')
    or icamp_private.has_campground_permission(campground_id,'maintenance.offline.media')
  )
);

alter policy maintenance_offline_sync_conflicts_insert
on public.maintenance_offline_sync_conflicts with check (
  actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and (
    (operation_kind='inspection_result' and icamp_private.has_campground_permission(campground_id,'inspection.perform'))
    or (operation_kind='work_order_media' and icamp_private.has_campground_permission(campground_id,'maintenance.offline.media'))
    or (operation_kind='work_order_note' and (
      icamp_private.has_campground_permission(campground_id,'maintenance.create')
      or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
      or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
    ))
  )
);
