do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_verified_closure_monitors'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 133 forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_verified_closure_monitors','UPDATE,DELETE') then
  raise exception 'Build 133 receipts must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_verified_closure_monitors'
   and t.tgname='verified_closure_monitor_guard' and not t.tgisinternal) then
  raise exception 'Build 133 verified closure source-link guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_verified_closure_monitors'
   and t.tgname='verified_closure_monitor_immutable' and not t.tgisinternal) then
  raise exception 'Build 133 append-only trigger missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and indexname='verified_closure_monitor_first_idx') then
  raise exception 'Build 133 first closure monitoring must not duplicate'; end if;
end $verify$;
