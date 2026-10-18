-- iCamp Build 060 verification.
do $verify$
declare
  table_name text;
begin
  foreach table_name in array array[
    'access_zones','access_zone_devices','access_schedules','access_rules'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Build 060 table % is missing', table_name;
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
      raise exception 'Build 060 table % must enable and FORCE RLS', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from icamp_private.permission_catalog
    where permission_key='access.rules.manage'
      and risk_level='elevated'
  ) then
    raise exception 'Build 060 access.rules.manage permission is missing';
  end if;

  if not exists (
    select 1
    from icamp_private.roles r
    join icamp_private.role_permissions rp on rp.role_id=r.id
    where r.role_kind='template'
      and r.role_code='security'
      and rp.permission_key='access.rules.manage'
  ) then
    raise exception 'Security role must receive access.rules.manage';
  end if;

  if to_regclass('public.access_zone_devices_device_fk_idx') is null then
    raise exception 'Build 060 device binding FK index is missing';
  end if;

  if to_regclass('public.access_rules_schedule_fk_idx') is null then
    raise exception 'Build 060 schedule FK index is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.access_zones','SELECT')
      or has_table_privilege('anon','public.access_rules','SELECT') then
      raise exception 'anon direct Build 060 access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.access_zones','SELECT')
      or has_table_privilege('authenticated','public.access_rules','SELECT') then
      raise exception 'authenticated direct Build 060 access must remain denied';
    end if;
  end if;
end
$verify$;
