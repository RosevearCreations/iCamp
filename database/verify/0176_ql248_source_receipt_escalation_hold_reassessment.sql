do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql248_source_receipt_exception_reassessments'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 146 QL-248 ledger must enforce owner-only RLS'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql248_source_receipt_exception_reassessments','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql248_source_receipt_exception_reassessments','UPDATE,DELETE') then
  raise exception 'Build 146 must be app-owner readable and append-only'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql248_source_receipt_exception_reassessments'
   and grantee in ('anon','authenticated','service_role')) then
  raise exception 'Build 146 original source evidence must not be public'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql248_source_receipt_exception_reassessments'
   and t.tgname='ql248_146_source_receipt_hold_guard' and not t.tgisinternal) then
  raise exception 'Build 146 root/independent-review gate missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql248_source_receipt_exception_reassessments'
   and t.tgname='ql248_146_source_receipt_hold_immutable' and not t.tgisinternal) then
  raise exception 'Build 146 immutable enforcement missing'; end if;
end $$;
