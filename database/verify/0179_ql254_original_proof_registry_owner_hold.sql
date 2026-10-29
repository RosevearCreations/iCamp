do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql254_original_proof_registry_owner_hold_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 149 QL-254 ledger needs forced RLS'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql254_original_proof_registry_owner_hold_reviews','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql254_original_proof_registry_owner_hold_reviews','UPDATE,DELETE') then
  raise exception 'Build 149 original witness ledger must remain append-only'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql254_original_proof_registry_owner_hold_reviews'
   and grantee in ('anon','authenticated','service_role')) then
  raise exception 'QL-254 private registry / owner references cannot be exposed'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql254_original_proof_registry_owner_hold_reviews'
   and t.tgname='ql254_149_original_proof_registry_owner_guard' and not t.tgisinternal) then
  raise exception 'QL-254 independent reviewer guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql254_original_proof_registry_owner_hold_reviews'
   and t.tgname='ql254_149_original_proof_registry_owner_immutable' and not t.tgisinternal) then
  raise exception 'QL-254 source ledger must reject update and delete'; end if;
 if exists(select 1 from public.owner_export_ql254_original_proof_registry_owner_hold_reviews where
  original_public_proof_trusted or private_pin_registry_independently_verified
  or private_custodian_witness_verified or owner_test_authorized or owner_pilot_authorized
  or relay_running or home_endpoint_exposed or dispatch_enabled
  or actual_gateway_test<>'NOT_RUN' or connection_state<>'DISCONNECTED' or gate_state<>'HOLD'
  or allowed_methods<>array['GET']::text[]
  or allowed_paths<>array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]) then
  raise exception 'QL-254 cannot authorize a trial or connect private host'; end if;
end $$;
