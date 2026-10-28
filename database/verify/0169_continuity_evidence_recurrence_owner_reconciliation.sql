do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_continuity_evidence_reconciliations'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 139 owner evidence forced RLS missing'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_continuity_evidence_reconciliations','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_continuity_evidence_reconciliations','UPDATE,DELETE') then
  raise exception 'Build 139 owner reconciliation must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_continuity_evidence_reconciliations'
   and t.tgname='continuity_evidence_reconciliation_guard' and not t.tgisinternal) then
  raise exception 'Build 139 source guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_continuity_evidence_reconciliations'
   and t.tgname='continuity_evidence_reconciliation_immutable' and not t.tgisinternal) then
  raise exception 'Build 139 immutable audit trigger missing'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_continuity_evidence_reconciliations'
   and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 139 owner proof exposed to client role'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='icamp_private' and c.relname='integration_ql243_request_receipts'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'QL-243 request replay ledger forced RLS missing'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='icamp_private' and c.relname='integration_ql243_denial_receipts'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'QL-243 denial ledger forced RLS missing'; end if;
 if exists(select 1 from pg_roles where rolname='anon') and
  has_table_privilege('anon','icamp_private.integration_ql243_request_receipts','SELECT,INSERT,UPDATE,DELETE') then
  raise exception 'QL-243 request ledger exposed to browser roles'; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') and
  has_table_privilege('authenticated','icamp_private.integration_ql243_request_receipts','SELECT,INSERT,UPDATE,DELETE') then
  raise exception 'QL-243 request ledger exposed to browser roles'; end if;
 if has_table_privilege('icamp_app','icamp_private.integration_ql243_request_receipts','UPDATE,DELETE')
  or has_table_privilege('icamp_app','icamp_private.integration_ql243_denial_receipts','UPDATE,DELETE') then
  raise exception 'QL-243 immutable audit unexpectedly mutable'; end if;
end $$;
