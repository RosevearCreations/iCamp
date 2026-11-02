do $verify$ declare name text; begin
 foreach name in array array['owner_export_reconciliation_exception_reviews','owner_export_reconciliation_closure_rechecks'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=name and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Build 118 forced owner RLS missing: %',name; end if;
  if has_table_privilege('icamp_app',format('public.%I',name),'UPDATE,DELETE') then
   raise exception 'Build 118 owner audit records must remain immutable: %',name; end if;
 end loop;
end $verify$;
