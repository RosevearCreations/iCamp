do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql255_six_app_proof_witness_relay_hold_reviews'
  and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'QL-255 owner ledger requires forced RLS'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews','UPDATE,DELETE') then
  raise exception 'QL-255 requires owner-only append-only access'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql255_six_app_proof_witness_relay_hold_reviews'
  and grantee in ('anon','authenticated','service_role')) then
  raise exception 'QL-255 private witness indexes must not be public'; end if;
 if (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql255_six_app_proof_witness_relay_hold_reviews' and not t.tgisinternal)<>3 then
  raise exception 'QL-255 owner chain and immutable triggers required'; end if;
 if exists(select 1 from public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews where
  source_proof_independently_trusted or custody_privately_verified
  or witness_real_world_identity_verified or owner_test_authorized or owner_pilot_authorized
  or relay_installed or relay_running or home_endpoint_exposed or dispatch_enabled
  or actual_gateway_test<>'NOT_RUN' or connection_state<>'DISCONNECTED' or gate_state<>'HOLD'
  or allowed_methods<>array['GET']::text[] or allowed_paths<>
   array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]) then
  raise exception 'QL-255 cannot connect private relay or authorize TEST'; end if;
end $$;
