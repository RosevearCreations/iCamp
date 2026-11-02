-- Build 083 advisor hardening: cover composite tenant-scoped foreign keys.
create index safety_enforcement_scope_reservation_fk_idx
 on public.safety_enforcement_cases(organization_id,campground_id,reservation_id);
create index safety_enforcement_scope_facility_fk_idx
 on public.safety_enforcement_cases(organization_id,campground_id,facility_id);
create index safety_enforcement_scope_zone_fk_idx
 on public.safety_enforcement_cases(organization_id,campground_id,access_zone_id);
create index safety_enforcement_scope_event_case_fk_idx
 on public.safety_enforcement_events(organization_id,campground_id,case_id);
