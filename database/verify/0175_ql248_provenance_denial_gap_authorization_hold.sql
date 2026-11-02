do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_ql248_provenance_gap_hold_renewals'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 145 QL-248 owner ledger must enforce RLS'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_ql248_provenance_gap_hold_renewals','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_ql248_provenance_gap_hold_renewals','UPDATE,DELETE') then
  raise exception 'Build 145 records must be owner-readable and append-only'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_ql248_provenance_gap_hold_renewals'
   and grantee in ('anon','authenticated','service_role')) then
  raise exception 'Build 145 source proof references must not be public'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql248_provenance_gap_hold_renewals'
   and t.tgname='ql248_provenance_gap_hold_guard' and not t.tgisinternal) then
  raise exception 'Build 145 independent provenance/gap review trigger missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql248_provenance_gap_hold_renewals'
   and t.tgname='ql248_provenance_gap_hold_immutable' and not t.tgisinternal) then
  raise exception 'Build 145 append-only trigger missing'; end if;
 if not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
  where c.relname='owner_export_ql248_provenance_gap_hold_renewals'
   and con.conname='ql248_transport_pair') then
  raise exception 'Build 145 distinct two-SHA provenance constraint missing'; end if;
end $$;
