do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
  and c.relname='permanent_unit_finance_recurrence_reviews' and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Recurrence review ledger lacks FORCE RLS'; end if;
 if has_table_privilege('anon','public.permanent_unit_finance_recurrence_reviews','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('authenticated','public.permanent_unit_finance_recurrence_reviews','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('service_role','public.permanent_unit_finance_recurrence_reviews','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('icamp_app','public.permanent_unit_finance_recurrence_reviews','UPDATE,DELETE') then
  raise exception 'Recurrence ledger exposes mutable or public access'; end if;
 if not exists(select 1 from pg_trigger where tgname='permanent_unit_finance_recurrence_reviews_immutable' and not tgisinternal) then
  raise exception 'Recurrence ledger missing append-only trigger'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='icamp_private' and p.proname='finance_recurrence_review_guard' and not p.prosecdef) then
  raise exception 'Invoker-only evidence snapshot guard missing'; end if;
end $verify$;
