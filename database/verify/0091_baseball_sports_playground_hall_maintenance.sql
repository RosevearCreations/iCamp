-- iCamp Build 071 verification.
do $verify$
declare
  table_name text;
begin
  foreach table_name in array array[
    'recreation_maintenance_programs',
    'recreation_maintenance_inspection_evidence',
    'recreation_maintenance_snapshots',
    'recreation_maintenance_issue_links'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Build 071 table % is missing', table_name;
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
      raise exception 'Build 071 table % must enable and FORCE RLS', table_name;
    end if;

    if has_table_privilege('icamp_app','public.' || table_name,'DELETE') then
      raise exception 'Build 071 table % must not allow direct delete', table_name;
    end if;
  end loop;

  if has_table_privilege(
    'icamp_app',
    'public.recreation_maintenance_inspection_evidence',
    'UPDATE'
  ) then
    raise exception 'Recreation maintenance inspection evidence must be append-only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.recreation_maintenance_snapshots',
    'UPDATE'
  ) then
    raise exception 'Recreation maintenance snapshots must be append-only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.recreation_maintenance_issue_links',
    'UPDATE'
  ) then
    raise exception 'Recreation maintenance issue links must be append-only';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='recreation_maintenance_programs_validate' and not tgisinternal
  ) then
    raise exception 'Build 071 program validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='recreation_maintenance_inspection_validate' and not tgisinternal
  ) then
    raise exception 'Build 071 inspection evidence validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='recreation_maintenance_snapshots_validate' and not tgisinternal
  ) then
    raise exception 'Build 071 snapshot validation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='recreation_maintenance_issue_links_validate' and not tgisinternal
  ) then
    raise exception 'Build 071 issue/work-order validation trigger is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon')
     and has_table_privilege(
       'anon',
       'public.recreation_maintenance_programs',
       'SELECT'
     ) then
    raise exception 'anon direct Build 071 access must remain denied';
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated')
     and has_table_privilege(
       'authenticated',
       'public.recreation_maintenance_snapshots',
       'SELECT'
     ) then
    raise exception 'authenticated direct Build 071 evidence access must remain denied';
  end if;
end
$verify$;
