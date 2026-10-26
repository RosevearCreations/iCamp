do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_handoff_independent_closure_audits'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 122 independent closure audit forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_handoff_independent_closure_audits','UPDATE,DELETE') then
  raise exception 'Build 122 independent audits must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_handoff_independent_closure_audits'
   and t.tgname='handoff_independent_closure_audit_guard' and not t.tgisinternal) then
  raise exception 'Build 122 independent auditor guard missing'; end if;
end $verify$;
