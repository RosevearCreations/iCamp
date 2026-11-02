do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_escalation_resolution_renewals'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 135 renewal ledger must enforce RLS'; end if;
 if not has_table_privilege('icamp_app','public.owner_export_escalation_resolution_renewals','SELECT,INSERT')
  or has_table_privilege('icamp_app','public.owner_export_escalation_resolution_renewals','UPDATE,DELETE') then
  raise exception 'Build 135 must be readable and append-only for scoped owners'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_escalation_resolution_renewals'
   and t.tgname='escalation_resolution_renewal_guard' and not t.tgisinternal) then
  raise exception 'Build 135 independent source guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_escalation_resolution_renewals'
   and t.tgname='escalation_resolution_renewal_immutable' and not t.tgisinternal) then
  raise exception 'Build 135 append-only trigger missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and tablename='owner_export_escalation_resolution_renewals'
  and indexname='escalation_resolution_first_renewal_idx') then
  raise exception 'Build 135 first follow-up uniqueness missing'; end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name='owner_export_escalation_resolution_renewals'
   and grantee in('anon','authenticated','service_role')) then
  raise exception 'Build 135 audit evidence must not be exposed to client roles'; end if;
end $verify$;
