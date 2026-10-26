do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_independent_followup_owner_decisions'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 121 owner handoff forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_independent_followup_owner_decisions','UPDATE,DELETE') then
  raise exception 'Build 121 owner handoff evidence must be immutable'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_independent_followup_owner_decisions'
   and t.tgname='independent_followup_owner_handoff_guard' and not t.tgisinternal) then
  raise exception 'Build 121 independent-to-owner actor guard missing'; end if;
end $verify$;
