do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_renewal_freshness_decisions'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 136 forced RLS missing'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_renewal_freshness_decisions','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_renewal_freshness_decisions','UPDATE,DELETE') then
  raise exception 'Build 136 owner audit must remain append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_renewal_freshness_decisions'
   and t.tgname='renewal_freshness_decision_guard' and not t.tgisinternal) then
  raise exception 'Build 136 source-comparison guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_renewal_freshness_decisions'
   and t.tgname='renewal_freshness_decision_immutable' and not t.tgisinternal) then
  raise exception 'Build 136 immutable audit trigger missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and tablename='owner_export_renewal_freshness_decisions'
  and indexname='renewal_freshness_first_audit_idx') then
  raise exception 'Build 136 first comparison uniqueness missing'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_renewal_freshness_decisions'
   and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 136 owner evidence cannot be exposed to client roles'; end if;
end $verify$;
