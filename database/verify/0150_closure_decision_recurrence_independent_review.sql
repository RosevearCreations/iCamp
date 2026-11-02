do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_closure_followup_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 120 independent review forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_closure_followup_reviews','UPDATE,DELETE') then
  raise exception 'Build 120 reviews must be immutable'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_closure_followup_reviews'
   and t.tgname='closure_decision_independent_review_guard' and not t.tgisinternal) then
  raise exception 'Build 120 independent review guard missing'; end if;
end $verify$;
