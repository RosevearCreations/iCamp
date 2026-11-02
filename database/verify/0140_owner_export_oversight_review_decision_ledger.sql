do $verify$ declare tab text; role_name text; begin
 foreach tab in array array['owner_export_oversight_reviews','owner_export_oversight_decisions'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Owner oversight audit requires forced RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name)
    and has_table_privilege(role_name,format('public.%I',tab),'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Unexpected public role privilege on %',tab; end if;
  end loop;
  if has_table_privilege('icamp_app',format('public.%I',tab),'UPDATE,DELETE') then
   raise exception 'Owner oversight evidence must remain append-only: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Owner oversight immutable trigger missing: %',tab; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=tab
   and policyname=tab||'_read' and qual like '%source_campground_id%'
   and qual like '%target_campground_id%') then
   raise exception 'Both campground permissions are required: %',tab; end if;
 end loop;
 if position('cases_observed' in pg_get_functiondef('icamp_private.owner_export_oversight_review_guard()'::regprocedure))=0
  or position('repeat_receipts_observed' in pg_get_functiondef('icamp_private.owner_export_oversight_review_guard()'::regprocedure))=0
  or position('90 days' in pg_get_functiondef('icamp_private.owner_export_oversight_review_guard()'::regprocedure))=0 then
  raise exception 'Database-derived oversight snapshots and bounded next review are required'; end if;
 if position('109109' in pg_get_functiondef('icamp_private.owner_export_oversight_decision_guard()'::regprocedure))=0
  or position('basis_case_id' in pg_get_functiondef('icamp_private.owner_export_oversight_decision_guard()'::regprocedure))=0
  or position('closed_no_action' in pg_get_functiondef('icamp_private.owner_export_oversight_decision_guard()'::regprocedure))=0 then
  raise exception 'Decision concurrency, cited evidence and final-state guards are required'; end if;
end $verify$;
