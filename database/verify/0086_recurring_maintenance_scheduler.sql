-- iCamp Build 067 verification.
do $verify$
declare
  role_name text;
begin
  if to_regclass('public.maintenance_schedules') is null then
    raise exception 'Build 067 maintenance schedule table is missing';
  end if;

  if to_regclass('public.maintenance_schedule_occurrences') is null then
    raise exception 'Build 067 occurrence history table is missing';
  end if;

  if to_regprocedure(
    'icamp_private.next_maintenance_occurrence(uuid,timestamp with time zone)'
  ) is null then
    raise exception 'Build 067 next-occurrence function is missing';
  end if;

  if not exists (
    select 1
    from icamp_private.permission_catalog
    where permission_key = 'maintenance.schedule'
  ) then
    raise exception 'Build 067 maintenance.schedule permission is missing';
  end if;

  foreach role_name in array array[
    'maintenance_main_foreman',
    'campground_manager',
    'owner_admin'
  ]
  loop
    if not exists (
      select 1
      from icamp_private.role_permissions rp
      join icamp_private.roles r on r.id = rp.role_id
      where r.role_code = role_name
        and rp.permission_key = 'maintenance.schedule'
    ) then
      raise exception 'Build 067 role % must have maintenance.schedule', role_name;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'maintenance_schedules_sync_job_schedule'
      and not tgisinternal
  ) then
    raise exception 'Build 067 Build-007 synchronization trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public'
      and c.relname='maintenance_schedules'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ) then
    raise exception 'Build 067 schedules must enable and FORCE RLS';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public'
      and c.relname='maintenance_schedule_occurrences'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ) then
    raise exception 'Build 067 occurrences must enable and FORCE RLS';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.maintenance_schedules',
    'DELETE'
  ) or has_table_privilege(
    'icamp_app',
    'public.maintenance_schedule_occurrences',
    'UPDATE'
  ) or has_table_privilege(
    'icamp_app',
    'public.maintenance_schedule_occurrences',
    'DELETE'
  ) then
    raise exception 'Build 067 append/lifecycle records expose an unsafe direct mutation';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.maintenance_schedules','SELECT') then
      raise exception 'anon direct Build 067 schedule access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege(
      'authenticated',
      'public.maintenance_schedule_occurrences',
      'SELECT'
    ) then
      raise exception 'authenticated direct Build 067 occurrence access must remain denied';
    end if;
  end if;
end
$verify$;
