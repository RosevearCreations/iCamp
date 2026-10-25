do $verify$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_owner_handoff_outcomes','permanent_unit_finance_owner_handoff_resolutions'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Owner resolution ledger missing forced RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name)
    and has_table_privilege(role_name,format('public.%I',tab),'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Public owner resolution privilege: % %',tab,role_name; end if;
  end loop;
  if has_table_privilege('icamp_app',format('public.%I',tab),'UPDATE,DELETE') then
   raise exception 'Outcome/resolution ledger cannot be modified: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Outcome/resolution ledger missing immutable trigger: %',tab; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=tab
   and policyname=tab||'_read' and qual like '%source_campground_id%'
   and qual like '%target_campground_id%') then
   raise exception 'Dual-campground owner RLS missing: %',tab; end if;
 end loop;
 if not exists(select 1 from pg_constraint where conname='permanent_unit_finance_owner_handoff_resolutions_plan_id_key'
  and contype='u') then
  raise exception 'Only one administrative resolution may be recorded per plan'; end if;
end $verify$;
