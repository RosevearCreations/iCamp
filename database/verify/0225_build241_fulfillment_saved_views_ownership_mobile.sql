do $verify241$ begin
  if not exists (select 1 from pg_class where oid = 'public.service_fulfillment_priority_saved_views'::regclass
    and relrowsecurity and relforcerowsecurity)
  or not exists (select 1 from pg_class where oid = 'public.service_fulfillment_case_owner_events'::regclass
    and relrowsecurity and relforcerowsecurity)
  or not exists (select 1 from pg_class where oid = 'public.service_fulfillment_mobile_field_reports'::regclass
    and relrowsecurity and relforcerowsecurity)
  then raise exception 'Build 241 forced RLS missing'; end if;
  if (select count(*) from pg_policies where schemaname='public'
    and tablename='service_fulfillment_priority_saved_views') <> 3
    or (select count(*) from pg_policies where schemaname='public'
      and tablename='service_fulfillment_case_owner_events') <> 2
    or (select count(*) from pg_policies where schemaname='public'
      and tablename='service_fulfillment_mobile_field_reports') <> 2
  then raise exception 'Build 241 RLS policy count changed'; end if;
  if (select count(*) from pg_trigger where tgname in
    ('service_fulfillment_saved_view_guard','service_fulfillment_case_owner_guard',
    'service_fulfillment_mobile_report_guard') and not tgisinternal) <> 3
  then raise exception 'Build 241 source guards missing'; end if;
  if has_table_privilege('icamp_app','public.service_fulfillment_case_owner_events','UPDATE')
    or has_table_privilege('icamp_app','public.service_fulfillment_case_owner_events','DELETE')
    or has_table_privilege('icamp_app','public.service_fulfillment_mobile_field_reports','UPDATE')
    or has_table_privilege('icamp_app','public.service_fulfillment_mobile_field_reports','DELETE')
  then raise exception 'Build 241 evidence histories must remain immutable'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and (
    has_table_privilege('anon','public.service_fulfillment_priority_saved_views','SELECT')
    or has_table_privilege('anon','public.service_fulfillment_case_owner_events','SELECT')
    or has_table_privilege('anon','public.service_fulfillment_mobile_field_reports','SELECT'))
  then raise exception 'Build 241 private evidence exposed to anon'; end if;
end $verify241$;
