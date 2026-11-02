do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_gateway_hold_receipt_reviews'
  and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 141 owner-only forced RLS missing'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_gateway_hold_receipt_reviews','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_gateway_hold_receipt_reviews','UPDATE,DELETE') then
  raise exception 'Build 141 audit must remain insert-only'; end if;
 if exists(select 1 from information_schema.role_table_grants where table_schema='public'
  and table_name='owner_export_gateway_hold_receipt_reviews'
  and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 141 private owner receipts must not reach client roles'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_gateway_hold_receipt_reviews'
   and t.tgname='gateway_hold_receipt_review_guard' and not t.tgisinternal) then
  raise exception 'Build 141 independent source guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_gateway_hold_receipt_reviews'
   and t.tgname='gateway_hold_receipt_review_immutable' and not t.tgisinternal) then
  raise exception 'Build 141 immutable receipt guard missing'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_gateway_hold_receipt_reviews'
   and con.conname='gateway_hold_receipt_reference_truth') then
  raise exception 'Build 141 no-fabricated-receipt constraint missing'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_gateway_hold_receipt_reviews'
   and con.conname='gateway_hold_receipt_outcomes') then
  raise exception 'Build 141 stage-dependent outcomes missing'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_gateway_hold_receipt_reviews'
   and con.conname='gateway_hold_receipt_source_revision_pair') then
  raise exception 'Build 141 iCamp revision and CI URL must be paired'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_gateway_hold_receipt_reviews'
   and not exists(select 1 from pg_constraint con where con.conrelid=c.oid
    and pg_get_constraintdef(con.oid) like '%DISCONNECTED%')) then
  raise exception 'Build 141 DISCONNECTED constraint missing'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='icamp_private' and c.relname='integration_ql243_request_receipts'
  and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 141 must retain private QL-243 replay storage'; end if;
end $$;
