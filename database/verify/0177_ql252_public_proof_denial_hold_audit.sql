do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql252_proof_denial_hold_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 147 source/denial HOLD ledger must enforce RLS'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql252_proof_denial_hold_reviews','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql252_proof_denial_hold_reviews','UPDATE,DELETE') then
  raise exception 'Build 147 owner ledger must be readable and immutable'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql252_proof_denial_hold_reviews'
   and grantee in ('anon','authenticated','service_role')) then
  raise exception 'Build 147 cannot leak source or owner evidence through public roles'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql252_proof_denial_hold_reviews'
   and t.tgname='ql252_147_proof_denial_hold_guard' and not t.tgisinternal) then
  raise exception 'Build 147 independent review guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql252_proof_denial_hold_reviews'
   and t.tgname='ql252_147_proof_denial_hold_immutable' and not t.tgisinternal) then
  raise exception 'Build 147 append-only gate missing'; end if;
end $$;
