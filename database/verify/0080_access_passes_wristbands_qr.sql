-- iCamp Build 061 verification.
do $verify$
declare
  table_name text;
begin
  foreach table_name in array array['access_passes','access_pass_events']
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Build 061 table % is missing', table_name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname=table_name
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'Build 061 table % must enable and FORCE RLS', table_name;
    end if;
  end loop;

  if has_table_privilege('icamp_app','public.access_passes','UPDATE')
    or has_table_privilege('icamp_app','public.access_passes','DELETE') then
    raise exception 'Access pass presentation records must remain immutable';
  end if;

  if has_table_privilege('icamp_app','public.access_pass_events','UPDATE')
    or has_table_privilege('icamp_app','public.access_pass_events','DELETE') then
    raise exception 'Access pass events must remain append-only';
  end if;

  if to_regclass('public.access_passes_visitor_fk_idx') is null
    or to_regclass('public.access_passes_vehicle_fk_idx') is null
    or to_regclass('public.access_pass_events_pass_idx') is null then
    raise exception 'Build 061 scoped foreign-key indexes are missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='visitor_registrations'
      and policyname='visitor_registrations_read'
      and qual like '%access.credential.issue%'
  ) then
    raise exception 'Credential issuers must be able to validate visitor linkage';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='vehicle_passes'
      and policyname='vehicle_passes_read'
      and qual like '%access.credential.issue%'
  ) then
    raise exception 'Credential issuers must be able to validate vehicle-pass linkage';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.access_passes','SELECT')
      or has_table_privilege('anon','public.access_pass_events','SELECT') then
      raise exception 'anon direct Build 061 access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.access_passes','SELECT')
      or has_table_privilege('authenticated','public.access_pass_events','SELECT') then
      raise exception 'authenticated direct Build 061 access must remain denied';
    end if;
  end if;
end
$verify$;
