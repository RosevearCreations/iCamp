-- iCamp Build 075 verification.
do $verify$
declare
  table_name text;
begin
  foreach table_name in array array[
    'preventive_maintenance_templates',
    'preventive_maintenance_programs'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Build 075 table % is missing', table_name;
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
      raise exception 'Build 075 table % must enable and FORCE RLS', table_name;
    end if;

    if has_table_privilege('icamp_app','public.' || table_name,'DELETE') then
      raise exception 'Build 075 table % must not allow direct delete', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgname='preventive_maintenance_templates_guard_update'
      and not tgisinternal
  ) then
    raise exception 'Build 075 immutable template guard is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='preventive_maintenance_programs_validate'
      and not tgisinternal
  ) then
    raise exception 'Build 075 program validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='preventive_maintenance_programs_guard_update'
      and not tgisinternal
  ) then
    raise exception 'Build 075 immutable program guard is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname='preventive_maintenance_programs_schedule_unique'
  ) then
    raise exception 'Build 075 requires one preventive program per schedule';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class r on r.oid=c.conrelid
    where r.relname='preventive_maintenance_programs'
      and c.contype='f'
      and pg_get_constraintdef(c.oid) ilike '%maintenance_schedules%'
  ) then
    raise exception 'Build 075 must reuse the canonical recurring scheduler';
  end if;

  if exists (select 1 from pg_roles where rolname='anon')
     and has_table_privilege(
       'anon',
       'public.preventive_maintenance_templates',
       'SELECT'
     ) then
    raise exception 'anon direct Build 075 template access must remain denied';
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated')
     and has_table_privilege(
       'authenticated',
       'public.preventive_maintenance_programs',
       'SELECT'
     ) then
    raise exception 'authenticated direct Build 075 program access must remain denied';
  end if;
end
$verify$;
