do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_closure_audit_owner_signoffs'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 123 closure audit owner sign-off forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_closure_audit_owner_signoffs','UPDATE,DELETE') then
  raise exception 'Build 123 closure audit owner sign-offs must remain append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_closure_audit_owner_signoffs'
   and t.tgname='closure_audit_owner_signoff_guard' and not t.tgisinternal) then
  raise exception 'Build 123 owner sign-off separation guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_closure_audit_owner_signoffs'
   and t.tgname='closure_audit_owner_signoff_immutable' and not t.tgisinternal) then
  raise exception 'Build 123 immutable sign-off guard missing'; end if;
end $verify$;
