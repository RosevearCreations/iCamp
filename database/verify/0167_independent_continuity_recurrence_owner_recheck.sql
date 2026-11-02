do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_continuity_recurrence_audits'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 137 forced RLS missing'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_continuity_recurrence_audits','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_continuity_recurrence_audits','UPDATE,DELETE') then
  raise exception 'Build 137 independent audit must remain append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_continuity_recurrence_audits'
   and t.tgname='continuity_recurrence_recheck_guard' and not t.tgisinternal) then
  raise exception 'Build 137 independent source validation trigger missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_continuity_recurrence_audits'
   and t.tgname='continuity_recurrence_recheck_immutable' and not t.tgisinternal) then
  raise exception 'Build 137 immutable owner audit trigger missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and tablename='owner_export_continuity_recurrence_audits'
  and indexname='continuity_recheck_first_watch_idx') then
  raise exception 'Build 137 first independent watch uniqueness missing'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_continuity_recurrence_audits'
   and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 137 owner audit cannot be exposed to client roles'; end if;
end $verify$;
