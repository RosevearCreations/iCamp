-- iCamp Build 064 verification.
do $verify$
declare
  name text;
begin
  foreach name in array array[
    'maintenance_categories',
    'maintenance_priority_policies'
  ]
  loop
    if to_regclass('public.' || name) is null then
      raise exception 'Build 064 table % is missing', name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname=name
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'Build 064 table % must enable and FORCE RLS', name;
    end if;
  end loop;

  if has_table_privilege('icamp_app','public.maintenance_categories','DELETE')
     or has_table_privilege('icamp_app','public.maintenance_priority_policies','DELETE') then
    raise exception 'Build 064 maintenance configuration must not be directly deleted';
  end if;

  if has_table_privilege('icamp_app','public.maintenance_priority_policies','INSERT') then
    raise exception 'Priority rows are seeded canonically and must not be inserted through icamp_app';
  end if;

  if to_regprocedure(
    'icamp_private.seed_maintenance_taxonomy_for_campground(uuid,uuid)'
  ) is null then
    raise exception 'Build 064 maintenance taxonomy seed function is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='campgrounds_seed_maintenance_taxonomy'
      and not tgisinternal
  ) then
    raise exception 'Future campground maintenance taxonomy seed trigger is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='maintenance_categories'
      and policyname='maintenance_categories_insert'
  ) then
    raise exception 'Maintenance category insert policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='maintenance_priority_policies'
      and policyname='maintenance_priority_policies_update'
  ) then
    raise exception 'Maintenance priority update policy is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.maintenance_categories','SELECT')
       or has_table_privilege('anon','public.maintenance_priority_policies','SELECT') then
      raise exception 'anon direct Build 064 access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.maintenance_categories','SELECT')
       or has_table_privilege('authenticated','public.maintenance_priority_policies','SELECT') then
      raise exception 'authenticated direct Build 064 access must remain denied';
    end if;
  end if;
end
$verify$;
