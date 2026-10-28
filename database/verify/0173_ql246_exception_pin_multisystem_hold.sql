do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql246_exception_pin_hold_decisions'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 143 QL-246 HOLD ledger must use forced owner-only RLS'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql246_exception_pin_hold_decisions','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql246_exception_pin_hold_decisions','UPDATE,DELETE') then
  raise exception 'Build 143 source proof records must be immutable'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql246_exception_pin_hold_decisions'
   and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 143 signed source proof exception metadata must not be public'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql246_exception_pin_hold_decisions'
   and t.tgname='ql246_exception_pin_hold_guard' and not t.tgisinternal) then
  raise exception 'Build 143 phase/order and source identity guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql246_exception_pin_hold_decisions'
   and t.tgname='ql246_exception_pin_hold_immutable' and not t.tgisinternal) then
  raise exception 'Build 143 append-only trigger missing'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_ql246_exception_pin_hold_decisions'
   and con.conname='ql246_exception_pin_stage_fields') then
  raise exception 'Build 143 source-proof/challenge stage isolation missing'; end if;
end $$;
