do $verify$ declare role_name text; begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
  and c.relname='permanent_unit_finance_recurrence_reviews' and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Recurrence review ledger lacks FORCE RLS'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name)
   and has_table_privilege(role_name,'public.permanent_unit_finance_recurrence_reviews','SELECT,INSERT,UPDATE,DELETE') then
   raise exception 'Public recurrence ledger privilege: %',role_name;
  end if;
 end loop;
 if has_table_privilege('icamp_app','public.permanent_unit_finance_recurrence_reviews','UPDATE,DELETE') then
  raise exception 'Recurrence ledger exposes mutable or public access'; end if;
 if not exists(select 1 from pg_trigger where tgname='permanent_unit_finance_recurrence_reviews_immutable' and not tgisinternal) then
  raise exception 'Recurrence ledger missing append-only trigger'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='icamp_private' and p.proname='finance_recurrence_review_guard' and not p.prosecdef) then
  raise exception 'Invoker-only evidence snapshot guard missing'; end if;
end $verify$;
