do $verify$ declare tab text; role_name text; begin
 foreach tab in array array['owner_export_exception_cases','owner_export_exception_outcomes','owner_export_exception_reviews'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Owner export exception audit requires forced RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name)
    and has_table_privilege(role_name,format('public.%I',tab),'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Unintended external role access to owner export exceptions: %',tab; end if;
  end loop;
  if has_table_privilege('icamp_app',format('public.%I',tab),'UPDATE,DELETE') then
   raise exception 'Owner exception audit evidence must remain append-only: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Owner exception immutability guard missing: %',tab; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=tab
   and policyname=tab||'_read' and qual like '%source_campground_id%' and qual like '%target_campground_id%') then
   raise exception 'Both campground owner permissions are required: %',tab; end if;
 end loop;
 if position('90 days' in pg_get_functiondef('icamp_private.owner_export_exception_case_guard()'::regprocedure))=0
  or position('reconciliation_missing' in pg_get_functiondef('icamp_private.owner_export_exception_case_guard()'::regprocedure))=0
  or position('one unresolved' in lower(pg_get_functiondef('icamp_private.owner_export_exception_case_guard()'::regprocedure)))=0 then
  raise exception 'Exception detection, bounded due dates and single open case guard are required'; end if;
 if position('review_ready' in pg_get_functiondef('icamp_private.owner_export_exception_outcome_guard()'::regprocedure))=0
  or position('original exception must be corrected' in lower(pg_get_functiondef('icamp_private.owner_export_exception_outcome_guard()'::regprocedure)))=0 then
  raise exception 'Corrective source evidence required for review-ready outcome'; end if;
 if position('new.reviewed_by_user_id=outcome.recorded_by_user_id' in pg_get_functiondef('icamp_private.owner_export_exception_review_guard()'::regprocedure))=0
  or position('is distinct from' in pg_get_functiondef('icamp_private.owner_export_exception_review_guard()'::regprocedure))=0 then
  raise exception 'Independent reviewer identity and cited evidence freshness checks are required'; end if;
end $verify$;
