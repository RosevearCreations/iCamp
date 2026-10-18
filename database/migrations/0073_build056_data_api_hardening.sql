-- iCamp Build 056 hosted Supabase Data API hardening.
-- Supabase may grant API roles explicitly even when PUBLIC is revoked.
-- Plain PostgreSQL CI does not necessarily define those provider roles.

do $harden$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on table public.access_credentials from anon';
    execute 'revoke all on table public.access_credential_events from anon';
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on table public.access_credentials from authenticated';
    execute 'revoke all on table public.access_credential_events from authenticated';
  end if;
end
$harden$;
