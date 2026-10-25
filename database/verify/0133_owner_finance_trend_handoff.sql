do $verify$ declare tab text; role_name text; begin
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='icamp_private' and p.proname='is_campground_finance_owner'
   and p.prosecdef) then
  raise exception 'Owner-only RLS authorization helper missing'; end if;
 if (exists(select 1 from pg_roles where rolname='anon')
   and has_function_privilege('anon','icamp_private.is_campground_finance_owner(uuid)','EXECUTE'))
   or (exists(select 1 from pg_roles where rolname='authenticated')
   and has_function_privilege('authenticated','icamp_private.is_campground_finance_owner(uuid)','EXECUTE')) then
  raise exception 'Owner helper must not be exposed to public API roles'; end if;
 foreach tab in array array['permanent_unit_finance_owner_trend_annotations','permanent_unit_finance_owner_handoff_plans'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Finance planning table lacks FORCE RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name)
    and has_table_privilege(role_name,format('public.%I',tab),'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Public owner planning privilege on %: %',tab,role_name; end if;
  end loop;
  if has_table_privilege('icamp_app',format('public.%I',tab),'UPDATE,DELETE') then
   raise exception 'Owner planning ledger must be append only: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Missing immutable trigger for %',tab; end if;
 end loop;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='permanent_unit_finance_owner_handoff_plans'
  and policyname='finance_owner_handoff_insert' and with_check like '%target_campground_id%') then
  raise exception 'Handoff insertion must verify both owner assignments'; end if;
end $verify$;
