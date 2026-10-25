do $verify$ declare tab text; api_role text; begin
 foreach tab in array array['permanent_unit_sale_cases','permanent_unit_sale_evidence','permanent_unit_sale_decisions','permanent_unit_sale_handoffs'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Sale-transfer table lacks FORCE RLS: %',tab; end if;
  foreach api_role in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=api_role)
    and has_table_privilege(api_role,'public.'||tab,'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Direct Data API grant on private sale-transfer table: % to %',tab,api_role;
   end if;
  end loop;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE') or has_table_privilege('icamp_app','public.'||tab,'DELETE') then
   raise exception 'Sale evidence is not append-only: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Immutable history trigger missing: %',tab; end if;
 end loop;
 foreach tab in array array['permanent_unit_sale_case_validate','permanent_unit_sale_evidence_validate',
  'permanent_unit_sale_decision_validate','permanent_unit_sale_handoff_validate'] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='icamp_private' and p.proname=tab and not p.prosecdef) then
   raise exception 'Invoker validation function missing: %',tab; end if;
 end loop;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='permanent_unit_sale_case_one_inquiry_idx') then
  raise exception 'Inquiry uniqueness gate missing'; end if;
end $verify$;
