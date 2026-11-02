-- iCamp Build 055 advisor hardening.
-- Cover the composite host-accommodation foreign key identified by Supabase.

create index visitor_registrations_scope_accommodation_fk_idx
  on public.visitor_registrations(
    organization_id,campground_id,host_accommodation_id
  );
