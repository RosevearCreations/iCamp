-- Build 238: fail closed when worker receipts or tenant protection disappear.
do $verify238$ begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.service_fulfillment_dispatches'::regclass
      and relrowsecurity and relforcerowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.service_fulfillment_dispatch_acknowledgements'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then raise exception 'Build 238 forced tenant isolation missing'; end if;
  if (select count(*) from pg_policies where schemaname = 'public'
    and tablename = 'service_fulfillment_dispatches') <> 2
    or (select count(*) from pg_policies where schemaname = 'public'
    and tablename = 'service_fulfillment_dispatch_acknowledgements') <> 2
  then raise exception 'Build 238 worker/supervisor RLS policies missing'; end if;
  if (select count(*) from pg_trigger where tgname in (
    'service_fulfillment_dispatches_guard',
    'service_fulfillment_acknowledgements_guard') and not tgisinternal) <> 2
  then raise exception 'Build 238 source/worker guards missing'; end if;
  if has_table_privilege('icamp_app', 'public.service_fulfillment_dispatches', 'UPDATE')
    or has_table_privilege('icamp_app', 'public.service_fulfillment_dispatches', 'DELETE')
    or has_table_privilege('icamp_app', 'public.service_fulfillment_dispatch_acknowledgements', 'UPDATE')
    or has_table_privilege('icamp_app', 'public.service_fulfillment_dispatch_acknowledgements', 'DELETE')
  then raise exception 'Build 238 receipts must be append-only'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') and (
    has_table_privilege('authenticated', 'public.service_fulfillment_dispatches', 'SELECT')
    or has_table_privilege('authenticated', 'public.service_fulfillment_dispatch_acknowledgements', 'SELECT')
  ) then raise exception 'Build 238 exposed to generic authenticated role'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and (
    has_table_privilege('anon', 'public.service_fulfillment_dispatches', 'SELECT')
    or has_table_privilege('anon', 'public.service_fulfillment_dispatch_acknowledgements', 'SELECT')
  ) then raise exception 'Build 238 exposed to anonymous role'; end if;
end $verify238$;
