do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_owner_recheck_renewal_watches'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 138 forced RLS missing'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_owner_recheck_renewal_watches','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_owner_recheck_renewal_watches','UPDATE,DELETE') then
  raise exception 'Build 138 renewal watch must remain append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_owner_recheck_renewal_watches'
   and t.tgname='owner_recheck_renewal_watch_guard' and not t.tgisinternal) then
  raise exception 'Build 138 verified evidence guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_owner_recheck_renewal_watches'
   and t.tgname='owner_recheck_renewal_watch_immutable' and not t.tgisinternal) then
  raise exception 'Build 138 immutable audit trigger missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and tablename='owner_export_owner_recheck_renewal_watches'
  and indexname='owner_recheck_renewal_first_watch_idx') then
  raise exception 'Build 138 first renewal uniqueness missing'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_owner_recheck_renewal_watches'
   and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 138 owner evidence cannot be exposed to client roles'; end if;
end $verify$;
