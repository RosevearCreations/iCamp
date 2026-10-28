do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql247_test_receipt_hold_watches'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 144 QL-247 owner ledger must enforce RLS'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql247_test_receipt_hold_watches','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql247_test_receipt_hold_watches','UPDATE,DELETE') then
  raise exception 'Build 144 records must be app-owner readable and immutable'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql247_test_receipt_hold_watches'
   and grantee in ('anon','authenticated','service_role')) then
  raise exception 'Build 144 original source proof reference indexes cannot be public'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql247_test_receipt_hold_watches'
   and t.tgname='ql247_test_receipt_hold_guard' and not t.tgisinternal) then
  raise exception 'Build 144 independent review and real receipt validator missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql247_test_receipt_hold_watches'
   and t.tgname='ql247_test_receipt_hold_immutable' and not t.tgisinternal) then
  raise exception 'Build 144 append-only enforcement missing'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_ql247_test_receipt_hold_watches'
   and con.conname='ql247_transport_pair') then
  raise exception 'Build 144 two-commit source/proof identity constraint missing'; end if;
end $$;
