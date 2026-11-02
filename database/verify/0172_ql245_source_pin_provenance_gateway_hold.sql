do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql245_source_pin_hold_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 142 owner source/pin HOLD review forced RLS missing'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql245_source_pin_hold_reviews','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql245_source_pin_hold_reviews','UPDATE,DELETE') then
  raise exception 'Build 142 owner source/pin records must be immutable'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql245_source_pin_hold_reviews'
   and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 142 owner source/pin receipts must stay private'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql245_source_pin_hold_reviews'
   and t.tgname='ql245_source_pin_hold_guard' and not t.tgisinternal) then
  raise exception 'Build 142 independent source/pin guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql245_source_pin_hold_reviews'
   and t.tgname='ql245_source_pin_hold_immutable' and not t.tgisinternal) then
  raise exception 'Build 142 append-only guard missing'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_ql245_source_pin_hold_reviews'
   and con.conname='ql245_source_pin_metadata_only') then
  raise exception 'Build 142 pin/source metadata stage isolation missing'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_ql245_source_pin_hold_reviews'
   and con.conname='ql245_source_pin_pin_pair') then
  raise exception 'Build 142 public SPKI fingerprint comparison pair missing'; end if;
end $$;
