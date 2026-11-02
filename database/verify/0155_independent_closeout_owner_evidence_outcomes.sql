do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_independent_closeout_owner_outcomes'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 125 owner evidence outcome forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_independent_closeout_owner_outcomes','UPDATE,DELETE') then
  raise exception 'Build 125 owner evidence outcomes must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_independent_closeout_owner_outcomes'
   and t.tgname='independent_closeout_owner_outcome_guard' and not t.tgisinternal) then
  raise exception 'Build 125 independent closeout outcome guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_independent_closeout_owner_outcomes'
   and t.tgname='independent_closeout_owner_outcome_immutable' and not t.tgisinternal) then
  raise exception 'Build 125 immutable outcome guard missing'; end if;
end $verify$;
