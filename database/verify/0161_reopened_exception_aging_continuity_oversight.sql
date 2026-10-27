do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_reopened_exception_aging_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 131 forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_reopened_exception_aging_reviews','UPDATE,DELETE') then
  raise exception 'Build 131 independent aging receipts must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_reopened_exception_aging_reviews'
   and t.tgname='reopened_exception_aging_guard' and not t.tgisinternal) then
  raise exception 'Build 131 source linkage and independent review guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_reopened_exception_aging_reviews'
   and t.tgname='reopened_exception_aging_immutable' and not t.tgisinternal) then
  raise exception 'Build 131 append-only guard missing'; end if;
 if not exists(select 1 from pg_indexes
  where schemaname='public' and indexname='reopened_aging_first_reassessment_idx') then
  raise exception 'Build 131 duplicate initial reassessment gate missing'; end if;
end $verify$;
