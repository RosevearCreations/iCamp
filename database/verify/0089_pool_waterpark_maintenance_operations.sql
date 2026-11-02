-- iCamp Build 069 verification.
do $verify$
declare
  table_name text;
begin
  foreach table_name in array array[
    'aquatic_facility_programs',
    'aquatic_inspection_evidence',
    'aquatic_operation_decisions'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Build 069 table % is missing', table_name;
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
      raise exception 'Build 069 table % must enable and FORCE RLS', table_name;
    end if;

    if has_table_privilege('icamp_app','public.' || table_name,'DELETE') then
      raise exception 'Build 069 table % must not allow direct delete', table_name;
    end if;
  end loop;

  if not exists (
    select 1
    from icamp_private.permission_catalog
    where permission_key='aquatics.reopen'
      and risk_level='high'
  ) then
    raise exception 'Build 069 high-risk aquatics.reopen permission is missing';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.aquatic_inspection_evidence',
    'UPDATE'
  ) then
    raise exception 'Aquatic inspection evidence must be append-only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.aquatic_operation_decisions',
    'UPDATE'
  ) then
    raise exception 'Aquatic operating decisions must be append-only';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='aquatic_facility_programs_validate' and not tgisinternal
  ) then
    raise exception 'Build 069 aquatic program validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='aquatic_operation_decisions_validate' and not tgisinternal
  ) then
    raise exception 'Build 069 reopening safety guard is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon')
     and has_table_privilege(
       'anon',
       'public.aquatic_facility_programs',
       'SELECT'
     ) then
    raise exception 'anon direct Build 069 access must remain denied';
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated')
     and has_table_privilege(
       'authenticated',
       'public.aquatic_operation_decisions',
       'SELECT'
     ) then
    raise exception 'authenticated direct Build 069 decision access must remain denied';
  end if;
end
$verify$;
