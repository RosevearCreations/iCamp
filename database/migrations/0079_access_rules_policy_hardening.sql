-- iCamp Build 060 advisor hardening
-- Remove duplicate permissive SELECT policy paths while preserving the same
-- authorization model.

drop policy if exists access_zones_manage on public.access_zones;
drop policy if exists access_zone_devices_manage on public.access_zone_devices;
drop policy if exists access_schedules_manage on public.access_schedules;
drop policy if exists access_rules_manage on public.access_rules;

create policy access_zones_create on public.access_zones
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_zones_update on public.access_zones
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_zone_devices_create on public.access_zone_devices
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_zone_devices_delete on public.access_zone_devices
for delete to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_schedules_create on public.access_schedules
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_schedules_update on public.access_schedules
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_rules_create on public.access_rules
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

create policy access_rules_update on public.access_rules
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.rules.manage')
);

comment on policy access_zones_read on public.access_zones is
  'Build 060 single SELECT policy for access zones; management write policies are action-specific to avoid duplicate permissive SELECT evaluation.';

comment on policy access_zone_devices_read on public.access_zone_devices is
  'Build 060 single SELECT policy for zone/device bindings; writes use separate INSERT/DELETE policies.';

comment on policy access_schedules_read on public.access_schedules is
  'Build 060 single SELECT policy for access schedules; management writes use action-specific policies.';

comment on policy access_rules_read on public.access_rules is
  'Build 060 single SELECT policy for access rules; management writes use action-specific policies.';
