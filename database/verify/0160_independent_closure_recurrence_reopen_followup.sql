do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_closure_recurrence_events'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 130 forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_closure_recurrence_events','UPDATE,DELETE') then
  raise exception 'Build 130 evidence events must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_closure_recurrence_events'
   and t.tgname='closure_recurrence_event_guard' and not t.tgisinternal) then
  raise exception 'Build 130 recurrence source guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_closure_recurrence_events'
   and t.tgname='closure_recurrence_event_immutable' and not t.tgisinternal) then
  raise exception 'Build 130 append-only guard missing'; end if;
end $verify$;
