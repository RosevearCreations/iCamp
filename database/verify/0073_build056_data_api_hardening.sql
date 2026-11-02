-- iCamp Build 056 Data API hardening verification.
do $verify$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.access_credentials','SELECT')
      or has_table_privilege('anon','public.access_credentials','INSERT')
      or has_table_privilege('anon','public.access_credentials','UPDATE')
      or has_table_privilege('anon','public.access_credential_events','SELECT')
      or has_table_privilege('anon','public.access_credential_events','INSERT') then
      raise exception 'anon direct access credential privileges must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.access_credentials','SELECT')
      or has_table_privilege('authenticated','public.access_credentials','INSERT')
      or has_table_privilege('authenticated','public.access_credentials','UPDATE')
      or has_table_privilege('authenticated','public.access_credential_events','SELECT')
      or has_table_privilege('authenticated','public.access_credential_events','INSERT') then
      raise exception 'authenticated direct access credential privileges must remain denied';
    end if;
  end if;
end
$verify$;
