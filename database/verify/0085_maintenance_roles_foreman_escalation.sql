-- iCamp Build 066 verification.
do $verify$
declare
  role_name text;
begin
  if to_regclass('public.maintenance_escalation_policies') is null then
    raise exception 'Build 066 escalation policy table is missing';
  end if;

  if to_regclass('public.maintenance_work_order_escalations') is null then
    raise exception 'Build 066 escalation evidence table is missing';
  end if;

  if to_regprocedure(
    'icamp_private.maintenance_responsibility_rank(uuid,uuid)'
  ) is null then
    raise exception 'Build 066 maintenance responsibility rank function is missing';
  end if;

  if to_regprocedure(
    'icamp_private.maintenance_responsibility_level(uuid,uuid)'
  ) is null then
    raise exception 'Build 066 maintenance responsibility level function is missing';
  end if;

  foreach role_name in array array[
    'maintenance_foreman',
    'maintenance_main_foreman'
  ]
  loop
    if not exists (
      select 1
      from icamp_private.roles
      where role_code = role_name
        and role_kind = 'template'
        and lifecycle_state = 'active'
    ) then
      raise exception 'Build 066 role % is missing', role_name;
    end if;
  end loop;

  if not exists (
    select 1
    from icamp_private.role_permissions rp
    join icamp_private.roles r on r.id = rp.role_id
    where r.role_code = 'maintenance_foreman'
      and rp.permission_key = 'maintenance.triage'
  ) then
    raise exception 'Maintenance foreman must have maintenance.triage';
  end if;

  if exists (
    select 1
    from icamp_private.role_permissions rp
    join icamp_private.roles r on r.id = rp.role_id
    where r.role_code = 'maintenance_foreman'
      and rp.permission_key = 'maintenance.escalate'
  ) then
    raise exception 'Maintenance foreman must not receive main-foreman escalation authority';
  end if;

  if not exists (
    select 1
    from icamp_private.role_permissions rp
    join icamp_private.roles r on r.id = rp.role_id
    where r.role_code = 'maintenance_main_foreman'
      and rp.permission_key = 'maintenance.escalate'
  ) then
    raise exception 'Maintenance main foreman must have maintenance.escalate';
  end if;

  if (
    select count(*)
    from public.maintenance_escalation_policies p
    join public.campgrounds c
      on c.id = p.campground_id
     and c.organization_id = p.organization_id
    where c.lifecycle_state <> 'archived'
  ) <> (
    select count(*) * 5
    from public.campgrounds
    where lifecycle_state <> 'archived'
  ) then
    raise exception 'Every active campground must have five Build 066 escalation policies';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'maintenance_escalation_policies'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ) then
    raise exception 'Build 066 escalation policy table must enable and FORCE RLS';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'maintenance_work_order_escalations'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ) then
    raise exception 'Build 066 escalation evidence table must enable and FORCE RLS';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.maintenance_escalation_policies',
    'INSERT'
  ) then
    raise exception 'Build 066 policy rows must remain canonical seeded records';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.maintenance_escalation_policies',
    'DELETE'
  ) or has_table_privilege(
    'icamp_app',
    'public.maintenance_work_order_escalations',
    'DELETE'
  ) then
    raise exception 'Build 066 policy/evidence records must not allow direct delete';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'maintenance_work_order_escalations_guard_update'
      and not tgisinternal
  ) then
    raise exception 'Build 066 escalation update guard is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'maintenance_work_orders_guard_update'
      and not tgisinternal
  ) then
    raise exception 'Build 066 work-order assignment hierarchy guard is missing';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    if has_table_privilege(
      'anon',
      'public.maintenance_work_order_escalations',
      'SELECT'
    ) then
      raise exception 'anon direct Build 066 escalation access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    if has_table_privilege(
      'authenticated',
      'public.maintenance_work_order_escalations',
      'SELECT'
    ) then
      raise exception 'authenticated direct Build 066 escalation access must remain denied';
    end if;
  end if;
end
$verify$;
