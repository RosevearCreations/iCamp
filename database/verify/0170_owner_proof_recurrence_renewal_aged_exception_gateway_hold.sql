do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on c.relnamespace=n.oid
  where n.nspname='public' and c.relname='owner_export_proof_renewal_gate_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 140 owner proof gateway audit forced RLS missing'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_proof_renewal_gate_reviews','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_proof_renewal_gate_reviews','UPDATE,DELETE') then
  raise exception 'Build 140 audit must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_proof_renewal_gate_reviews'
   and t.tgname='owner_proof_gateway_review_guard' and not t.tgisinternal) then
  raise exception 'Build 140 independent provenance guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_proof_renewal_gate_reviews'
   and t.tgname='owner_proof_gateway_review_immutable' and not t.tgisinternal) then
  raise exception 'Build 140 immutable receipt guard missing'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_proof_renewal_gate_reviews'
   and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 140 owner evidence must not be exposed to client roles'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_proof_renewal_gate_reviews'
   and con.conname='owner_proof_gateway_metadata_only') then
  raise exception 'Build 140 prohibits gateway evidence on unrelated stages'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_proof_renewal_gate_reviews'
   and pg_get_constraintdef(con.oid) like '%HOLD%') then
  raise exception 'Build 140 gateway HOLD constraint missing'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on c.relnamespace=n.oid
  where n.nspname='icamp_private' and c.relname='integration_ql243_request_receipts'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 140 must retain QL-243 private replay ledger'; end if;
end $$;
