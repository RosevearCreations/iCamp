-- iCamp Build 065 verification.
do $verify$
declare
  name text;
begin
  foreach name in array array[
    'maintenance_work_orders',
    'maintenance_work_order_status_events',
    'maintenance_work_order_notes',
    'maintenance_work_order_media',
    'maintenance_work_order_materials',
    'maintenance_work_order_labor'
  ]
  loop
    if to_regclass('public.' || name) is null then
      raise exception 'Build 065 table % is missing', name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = name
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'Build 065 table % must enable and FORCE RLS', name;
    end if;

    if has_table_privilege('icamp_app', 'public.' || name, 'DELETE') then
      raise exception 'Build 065 evidence table % must not allow direct delete', name;
    end if;
  end loop;

  if has_table_privilege(
    'icamp_app',
    'public.maintenance_work_order_status_events',
    'INSERT'
  ) then
    raise exception 'Status-event rows must be written by the canonical server transaction';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'maintenance_work_orders_guard_update'
      and not tgisinternal
  ) then
    raise exception 'Build 065 work-order update guard is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance_work_orders'
      and policyname = 'maintenance_work_orders_insert'
  ) then
    raise exception 'Build 065 work-order insert policy is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_work_orders_category_fk'
  ) then
    raise exception 'Work orders must reuse Build 064 maintenance categories';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_work_orders_priority_fk'
  ) then
    raise exception 'Work orders must reuse Build 064 priority policies';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_work_order_media_asset_fk'
  ) then
    raise exception 'Work-order media must reuse Build 008 secure-media assets';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    foreach name in array array[
      'maintenance_work_orders',
      'maintenance_work_order_status_events',
      'maintenance_work_order_notes',
      'maintenance_work_order_media',
      'maintenance_work_order_materials',
      'maintenance_work_order_labor'
    ]
    loop
      if has_table_privilege('anon', 'public.' || name, 'SELECT') then
        raise exception 'anon direct Build 065 access must remain denied for %', name;
      end if;
    end loop;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    foreach name in array array[
      'maintenance_work_orders',
      'maintenance_work_order_status_events',
      'maintenance_work_order_notes',
      'maintenance_work_order_media',
      'maintenance_work_order_materials',
      'maintenance_work_order_labor'
    ]
    loop
      if has_table_privilege('authenticated', 'public.' || name, 'SELECT') then
        raise exception 'authenticated direct Build 065 access must remain denied for %', name;
      end if;
    end loop;
  end if;
end
$verify$;
