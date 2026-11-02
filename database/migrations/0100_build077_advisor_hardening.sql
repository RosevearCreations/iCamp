-- iCamp Build 077 advisor hardening.
-- Cover the composite request foreign keys reported by Supabase Performance Advisor.

create index camper_assistance_request_events_scope_request_fk_idx
  on public.camper_assistance_request_events(
    organization_id,
    campground_id,
    request_id
  );

create index camper_assistance_request_media_scope_request_fk_idx
  on public.camper_assistance_request_media(
    organization_id,
    campground_id,
    request_id
  );
