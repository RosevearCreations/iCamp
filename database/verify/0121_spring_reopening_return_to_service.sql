do $verify$ declare tab text; api_role text; begin
 foreach tab in array array['spring_reopening_templates','spring_reopening_inspections',
  'spring_reopening_observations','spring_reopening_decisions'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Spring reopening evidence table lacks FORCE RLS: %',tab; end if;
  foreach api_role in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=api_role) then
    if has_table_privilege(api_role,'public.'||tab,'SELECT,INSERT,UPDATE,DELETE') then
     raise exception 'Data API grant on protected spring table % to %',tab,api_role;
    end if;
   end if;
  end loop;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE')
   or has_table_privilege('icamp_app','public.'||tab,'DELETE') then
   raise exception 'Append-only spring evidence table can be mutated: %',tab; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='seasonal_assignments_require_spring_reopening' and not tgisinternal) then
  raise exception 'Canonical winter-closed assignment reopening gate is missing'; end if;
 if not exists(select 1 from pg_trigger where tgname='spring_reopening_decision_validate' and not tgisinternal) then
  raise exception 'Independent spring approval gate is missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='spring_reopening_inspections_assignment_fk_idx')
  or not exists(select 1 from pg_indexes where schemaname='public' and indexname='spring_reopening_decisions_inspection_fk_idx') then
  raise exception 'Spring reopening scoped FK indexes are missing'; end if;
 if not exists(select 1 from icamp_private.permission_catalog where permission_key='spring.reopen.approve') then
  raise exception 'Spring reopening approval permission is missing'; end if;
end $verify$;
