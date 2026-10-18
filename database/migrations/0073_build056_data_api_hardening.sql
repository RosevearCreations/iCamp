-- iCamp Build 056 hosted Supabase Data API hardening.
-- Supabase may grant API roles explicitly even when PUBLIC is revoked.

revoke all on table public.access_credentials from anon, authenticated;
revoke all on table public.access_credential_events from anon, authenticated;
