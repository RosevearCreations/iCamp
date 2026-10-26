do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_reassessment_owner_actions' and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 117 forced owner RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_reassessment_owner_actions','UPDATE,DELETE') then
  raise exception 'Build 117 evidence owner actions must be immutable'; end if;
end $verify$;
