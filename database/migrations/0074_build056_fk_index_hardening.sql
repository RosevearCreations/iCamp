-- iCamp Build 056 advisor hardening.
-- Cover the scoped access credential event foreign key identified by Supabase.

create index access_credential_events_scope_credential_fk_idx
  on public.access_credential_events(
    organization_id,campground_id,credential_id
  );
