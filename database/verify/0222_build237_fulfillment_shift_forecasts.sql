-- Verify tenant-specific supervisor-only service window assumptions.
do $verify237$ begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.service_fulfillment_planning_settings'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then raise exception 'Build 237 forced RLS missing'; end if;
  if (select count(*) from pg_policies where schemaname='public'
    and tablename='service_fulfillment_planning_settings') <> 3
  then raise exception 'Build 237 supervisor policies missing'; end if;
  if (select count(*) from pg_trigger where tgname in (
    'service_fulfillment_planning_settings_guard',
    'service_fulfillment_planning_settings_touch') and not tgisinternal) <> 2
  then raise exception 'Build 237 scope/version guards missing'; end if;
  if has_table_privilege('icamp_app', 'public.service_fulfillment_planning_settings', 'DELETE')
  then raise exception 'Build 237 planning policies must not allow deletion'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') and
    has_table_privilege('authenticated', 'public.service_fulfillment_planning_settings', 'SELECT')
  then raise exception 'Build 237 planning data exposed to public auth role'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and
    has_table_privilege('anon', 'public.service_fulfillment_planning_settings', 'SELECT')
  then raise exception 'Build 237 planning data exposed to anonymous role'; end if;
end $verify237$;
