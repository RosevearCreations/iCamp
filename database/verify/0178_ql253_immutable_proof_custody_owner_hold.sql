do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql253_proof_custody_owner_hold_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 148 QL-253 ledger must enforce row security'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql253_proof_custody_owner_hold_reviews','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql253_proof_custody_owner_hold_reviews','UPDATE,DELETE') then
  raise exception 'Build 148 independent review ledger must be append-only'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql253_proof_custody_owner_hold_reviews'
   and grantee in ('anon','authenticated','service_role')) then
  raise exception 'Build 148 cannot expose custody or owner claims to Data API roles'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql253_proof_custody_owner_hold_reviews'
   and t.tgname='ql253_148_proof_custody_owner_hold_guard' and not t.tgisinternal) then
  raise exception 'Build 148 independent source/custody/owner chain trigger missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql253_proof_custody_owner_hold_reviews'
   and t.tgname='ql253_148_proof_custody_owner_hold_immutable' and not t.tgisinternal) then
  raise exception 'Build 148 immutable audit trigger missing'; end if;
 if exists(select 1 from public.owner_export_ql253_proof_custody_owner_hold_reviews
  where signed_proof_independently_trusted or independent_custody_pin_verified
   or owner_test_authorized or owner_pilot_authorized or dispatch_enabled
   or actual_gateway_test<>'NOT_RUN' or connection_state<>'DISCONNECTED' or gate_state<>'HOLD'
   or allowed_methods<>array['GET']::text[]
   or allowed_paths<>array['/api/integration/v1/health','/api/integration/v1/capabilities']::text[]) then
  raise exception 'Build 148 cannot authorize or simulate real gateway traffic'; end if;
end $$;
