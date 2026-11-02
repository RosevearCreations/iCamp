do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_owner_evidence_independent_dispositions'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 126 independent owner-evidence disposition forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_owner_evidence_independent_dispositions','UPDATE,DELETE') then
  raise exception 'Build 126 independent disposition must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_owner_evidence_independent_dispositions'
   and t.tgname='owner_evidence_independent_disposition_guard' and not t.tgisinternal) then
  raise exception 'Build 126 independent disposition guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_owner_evidence_independent_dispositions'
   and t.tgname='owner_evidence_independent_disposition_immutable' and not t.tgisinternal) then
  raise exception 'Build 126 immutable disposition guard missing'; end if;
end $verify$;
