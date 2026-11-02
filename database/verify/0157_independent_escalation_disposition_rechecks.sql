do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_independent_disposition_rechecks'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 127 independent disposition recheck forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_independent_disposition_rechecks','UPDATE,DELETE') then
  raise exception 'Build 127 independent disposition recheck must be immutable'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_independent_disposition_rechecks'
   and t.tgname='independent_disposition_recheck_guard' and not t.tgisinternal) then
  raise exception 'Build 127 independent recheck guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_independent_disposition_rechecks'
   and t.tgname='independent_disposition_recheck_immutable' and not t.tgisinternal) then
  raise exception 'Build 127 append-only recheck guard missing'; end if;
end $verify$;
