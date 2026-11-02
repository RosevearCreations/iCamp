-- iCamp Build 072 verification.
do $verify$
declare
  table_name text;
begin
  foreach table_name in array array[
    'infrastructure_maintenance_programs',
    'infrastructure_maintenance_inspection_evidence',
    'infrastructure_maintenance_snapshots',
    'infrastructure_maintenance_issue_links'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Build 072 table % is missing', table_name;
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
      raise exception 'Build 072 table % must enable and FORCE RLS', table_name;
    end if;

    if has_table_privilege('icamp_app','public.' || table_name,'DELETE') then
      raise exception 'Build 072 table % must not allow direct delete', table_name;
    end if;
  end loop;

  if has_table_privilege(
    'icamp_app',
    'public.infrastructure_maintenance_inspection_evidence',
    'UPDATE'
  ) then
    raise exception 'Infrastructure maintenance inspection evidence must be append-only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.infrastructure_maintenance_snapshots',
    'UPDATE'
  ) then
    raise exception 'Infrastructure maintenance snapshots must be append-only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.infrastructure_maintenance_issue_links',
    'UPDATE'
  ) then
    raise exception 'Infrastructure maintenance issue links must be append-only';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='infrastructure_maintenance_programs_validate' and not tgisinternal
  ) then
    raise exception 'Build 072 program validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='infrastructure_maintenance_inspection_validate' and not tgisinternal
  ) then
    raise exception 'Build 072 inspection evidence validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='infrastructure_maintenance_snapshots_validate' and not tgisinternal
  ) then
    raise exception 'Build 072 snapshot validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='infrastructure_maintenance_issue_links_validate' and not tgisinternal
  ) then
    raise exception 'Build 072 issue/work-order validation trigger is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon')
     and has_table_privilege(
       'anon',
       'public.infrastructure_maintenance_programs',
       'SELECT'
     ) then
    raise exception 'anon direct Build 072 access must remain denied';
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated')
     and has_table_privilege(
       'authenticated',
       'public.infrastructure_maintenance_snapshots',
       'SELECT'
     ) then
    raise exception 'authenticated direct Build 072 evidence access must remain denied';
  end if;
end
$verify$;
