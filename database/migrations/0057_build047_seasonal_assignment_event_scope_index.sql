-- iCamp Build 047 hardening
-- Cover the composite seasonal-assignment lifecycle-event scope foreign key.

create index seasonal_assignment_events_scope_fk_idx
  on public.seasonal_assignment_events(organization_id,campground_id,assignment_id);
