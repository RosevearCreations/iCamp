-- Fail if the installed database cannot enforce Build 235 invariants.
do $verify235$ begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.service_fulfillment_jobs'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then raise exception 'Build 235 fulfillment FORCE RLS missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'booking_charge_catalog'
      and column_name = 'daily_capacity'
  ) then raise exception 'Build 235 shared capacity missing'; end if;
  if (select count(*) from pg_trigger where tgname in (
    'service_fulfillment_jobs_guard', 'service_fulfillment_jobs_touch_row',
    'booking_service_daily_capacity_guard') and not tgisinternal) <> 3
  then raise exception 'Build 235 capacity / state guards missing'; end if;
  if (select count(*) from pg_policies where schemaname = 'public'
    and tablename = 'service_fulfillment_jobs') <> 2
  then raise exception 'Build 235 role policies missing'; end if;
  if has_table_privilege('icamp_app', 'public.service_fulfillment_jobs', 'INSERT')
  then raise exception 'Build 235 untrusted direct queue insertion allowed'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') and
    has_table_privilege('authenticated', 'public.service_fulfillment_jobs', 'SELECT')
  then raise exception 'Build 235 queue visible to public auth role'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and
    has_table_privilege('anon', 'public.service_fulfillment_jobs', 'SELECT')
  then raise exception 'Build 235 queue visible to anonymous role'; end if;
end $verify235$;
