-- iCamp Build 068 verification.
do $verify$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inspection_templates',
    'inspection_template_versions',
    'inspection_template_items',
    'inspection_occurrences',
    'inspection_results',
    'inspection_signoffs',
    'inspection_corrective_actions'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Build 068 table % is missing', table_name;
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
      raise exception 'Build 068 table % must enable and FORCE RLS', table_name;
    end if;

    if has_table_privilege('icamp_app','public.' || table_name,'DELETE') then
      raise exception 'Build 068 table % must not allow direct delete', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from icamp_private.permission_catalog
    where permission_key='inspection.template.manage'
  ) then
    raise exception 'Build 068 inspection.template.manage permission is missing';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.inspection_template_items',
    'UPDATE'
  ) then
    raise exception 'Published checklist item history must not be directly editable';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.inspection_signoffs',
    'UPDATE'
  ) then
    raise exception 'Inspection sign-off evidence must be append-only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.inspection_corrective_actions',
    'UPDATE'
  ) then
    raise exception 'Inspection corrective-action links must be append-only';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='inspection_template_versions_guard_update'
      and not tgisinternal
  ) then
    raise exception 'Build 068 template-version immutability guard is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='inspection_occurrences_guard_update'
      and not tgisinternal
  ) then
    raise exception 'Build 068 occurrence lifecycle guard is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='inspection_signoffs_guard_insert'
      and not tgisinternal
  ) then
    raise exception 'Build 068 independent sign-off guard is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.inspection_templates','SELECT') then
      raise exception 'anon direct Build 068 inspection access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege(
      'authenticated',
      'public.inspection_results',
      'SELECT'
    ) then
      raise exception 'authenticated direct Build 068 result access must remain denied';
    end if;
  end if;
end
$verify$;
