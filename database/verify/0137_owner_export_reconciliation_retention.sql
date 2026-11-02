do $verify$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_owner_export_reconciliations','permanent_unit_finance_owner_export_retention_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Owner export reconciliation/retention table missing forced RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name)
    and has_table_privilege(role_name,format('public.%I',tab),'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Unexpected public access to owner export audit ledger: %',tab; end if;
  end loop;
  if has_table_privilege('icamp_app',format('public.%I',tab),'UPDATE,DELETE') then
   raise exception 'Owner export audit entries must remain immutable: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Missing audit immutability trigger on %',tab; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=tab
   and policyname=tab||'_read' and qual like '%source_campground_id%' and qual like '%target_campground_id%') then
   raise exception 'Both campground owner permissions are required for %',tab; end if;
 end loop;
 if position('accepted_by_user_id=new.reconciled_by_user_id' in
    pg_get_functiondef('icamp_private.finance_owner_export_reconciliation_guard()'::regprocedure))=0
  or position('export_sha256' in pg_get_functiondef('icamp_private.finance_owner_export_reconciliation_guard()'::regprocedure))=0 then
  raise exception 'Independent reviewer and exact digest guard missing'; end if;
 if position('180 days' in pg_get_functiondef('icamp_private.finance_owner_export_retention_guard()'::regprocedure))=0
  or position('copy_disposed' in pg_get_functiondef('icamp_private.finance_owner_export_retention_guard()'::regprocedure))=0 then
  raise exception 'Bounded retention and disposal lifecycle guard missing'; end if;
end $verify$;
