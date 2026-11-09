-- Fail closed if Build 236 staff-load and exception isolation are missing.
do $verify236$ begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.service_fulfillment_assignments'::regclass
      and relrowsecurity and relforcerowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.service_fulfillment_exception_reviews'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then raise exception 'Build 236 FORCE RLS missing'; end if;
  if (select count(*) from pg_trigger where tgname in (
    'service_fulfillment_assignments_guard', 'service_fulfillment_assignments_touch',
    'service_fulfillment_exception_reviews_guard') and not tgisinternal) <> 3
  then raise exception 'Build 236 scope or revision guards missing'; end if;
  if (select count(*) from pg_policies where schemaname = 'public'
    and tablename = 'service_fulfillment_assignments') <> 3
    or (select count(*) from pg_policies where schemaname = 'public'
    and tablename = 'service_fulfillment_exception_reviews') <> 2
  then raise exception 'Build 236 role policies missing'; end if;
  if has_table_privilege('icamp_app', 'public.service_fulfillment_assignments', 'DELETE')
    or has_table_privilege('icamp_app', 'public.service_fulfillment_exception_reviews', 'UPDATE')
    or has_table_privilege('icamp_app', 'public.service_fulfillment_exception_reviews', 'DELETE')
  then raise exception 'Build 236 immutable history or assignment protection missing'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') and (
    has_table_privilege('authenticated', 'public.service_fulfillment_assignments', 'SELECT')
    or has_table_privilege('authenticated', 'public.service_fulfillment_exception_reviews', 'SELECT')
  ) then raise exception 'Build 236 private staff work visible to authenticated role'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and (
    has_table_privilege('anon', 'public.service_fulfillment_assignments', 'SELECT')
    or has_table_privilege('anon', 'public.service_fulfillment_exception_reviews', 'SELECT')
  ) then raise exception 'Build 236 private staff work visible to anonymous role'; end if;
end $verify236$;
