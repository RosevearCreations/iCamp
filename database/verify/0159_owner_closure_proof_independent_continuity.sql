do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_owner_decision_independent_continuity_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 129 forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_owner_decision_independent_continuity_reviews','UPDATE,DELETE') then
  raise exception 'Build 129 evidence must remain append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_owner_decision_independent_continuity_reviews'
   and t.tgname='owner_decision_independent_continuity_guard' and not t.tgisinternal) then
  raise exception 'Build 129 independent continuity guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_owner_decision_independent_continuity_reviews'
   and t.tgname='owner_decision_independent_continuity_immutable' and not t.tgisinternal) then
  raise exception 'Build 129 append-only trigger missing'; end if;
end $verify$;
